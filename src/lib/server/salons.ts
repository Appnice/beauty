// Salon creation ("Załóż salon"), sign-up rules and salon settings.
import type { Sql } from 'postgres';
import { env, flag } from './env.ts';
import { AppError, forbidden, invalid } from './errors.ts';
import {
  insertService,
  insertStaff,
  setOpeningHours,
  setSchedule,
  setStaffServices,
  type HoursItem
} from './catalog.ts';
import { inTx, pgCode } from './db.ts';
import { phoneFromSignupToken } from './auth.ts';
import { can, type Actor } from './policy.ts';
import { isValidSlug, salonById, TEAM_SIZES, type Salon, type SalonStatus, type TeamSize } from './tenant.ts';
import { MAX_PENDING, notifyAdmin, pendingCount } from './approval.ts';
import { normalizePhone } from './phone.ts';

export interface AboutSalon {
  city: string;
  street: string;
  teamSize: TeamSize;
  link: string;
  about: string;
}

export const ONE_PER_PHONE = () => new AppError('CONFLICT', 'Ten numer ma już salon. Zaloguj się.');
export const TOO_MANY = () => new AppError('RATE_LIMITED', 'Dużo zgłoszeń. Spróbuj jutro.');
export const MAX_SIGNUPS_PER_IP_DAY = 3;

/** A link to the salon: a web address (with or without https://) or an @handle. Empty is fine. */
export function validLink(raw: string): boolean {
  const v = raw.trim();
  if (v === '') return true;
  if (v.startsWith('@')) return /^@[A-Za-z0-9._]{2,30}$/.test(v);
  if (/\s/.test(v)) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function validTeamSize(v: string): v is TeamSize {
  return (TEAM_SIZES as readonly string[]).includes(v);
}

/** One salon per phone number (the demo salon does not count). */
export async function phoneHasSalon(sql: Sql, phone: string): Promise<boolean> {
  const [r] = await sql`select 1 from salon where phone = ${phone} and not is_demo`;
  return !!r;
}

/** Throws when a new sign-up from this IP or in total is over the limits. */
export async function checkSignupLimits(sql: Sql, ip: string): Promise<void> {
  if (flag('SINGLE_SALON')) return;
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from salon where signup_ip = ${ip} and created_at > now() - interval '1 day'`;
  if (r.n >= MAX_SIGNUPS_PER_IP_DAY) throw TOO_MANY();
  if ((await pendingCount(sql)) >= MAX_PENDING) throw TOO_MANY();
}

export interface NewSalonInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string | null;
  confirmationMode?: 'auto' | 'manual';
  isDemo?: boolean;
  /** Default 'active'. The hosted sign-up creates 'pending' salons. */
  status?: SalonStatus;
  about?: AboutSalon;
  signupIp?: string | null;
  openingHours: HoursItem[];
  manager: {
    name: string;
    phone: string;
    password: string;
    color?: string;
    /** Set when the manager also works on the floor: she then gets a calendar column. */
    services?: { key: string; durationMin?: number | null }[];
  };
  services: {
    key?: string;
    name: string;
    durationMin: number;
    priceGrosze?: number | null;
    bufferMin?: number;
  }[];
  stylists: {
    name: string;
    phone?: string | null;
    color?: string;
    /** service keys (or names) with an optional own duration */
    services: { key: string; durationMin?: number | null }[];
    /** weekly hours; empty = the salon opening hours */
    schedule?: { weekday: number; starts: string; ends: string }[];
  }[];
}

/** Create a salon with its manager, services, stylists and schedules in one transaction. */
export async function createSalon(sql: Sql, input: NewSalonInput): Promise<Salon> {
  const slug = input.slug.trim().toLowerCase();
  if (!isValidSlug(slug)) throw invalid('Ten adres jest niedostępny. Użyj małych liter, cyfr i myślników.');
  if (!input.name.trim()) throw invalid('Podaj nazwę salonu.');
  if (input.manager.password.length < 8) throw invalid('Hasło musi mieć co najmniej 8 znaków.');
  const a = input.about;
  try {
    return await inTx(sql, async (t) => {
      const [salon] = await t<Salon[]>`
        insert into salon (slug, name, address, phone, confirmation_mode, is_demo, status, city, street,
                           team_size, link, about, signup_ip, submitted_at)
        values (${slug}, ${input.name.trim()}, ${input.address ?? ''}, ${input.phone ?? null},
                ${input.confirmationMode ?? 'auto'}, ${input.isDemo ?? false}, ${input.status ?? 'active'},
                ${a?.city ?? ''}, ${a?.street ?? ''}, ${a?.teamSize ?? null}, ${a?.link ?? ''}, ${a?.about ?? ''},
                ${input.signupIp ?? null}, ${a ? new Date().toISOString() : null}::timestamptz)
        returning *`;
      await setOpeningHours(t, null, salon.id, input.openingHours);
      const manager = await insertStaff(t, salon.id, {
        name: input.manager.name,
        phone: input.manager.phone,
        password: input.manager.password,
        color: input.manager.color,
        role: 'manager',
        sort: 0
      });
      const byKey = new Map<string, string>();
      for (const [i, s] of input.services.entries()) {
        const row = await insertService(t, salon.id, { ...s, sort: i });
        byKey.set(s.key ?? s.name, row.id);
      }
      const linkServices = (list: { key: string; durationMin?: number | null }[]) =>
        list.map((x) => {
          const id = byKey.get(x.key);
          if (!id) throw invalid(`Nieznana usługa: ${x.key}`);
          return { serviceId: id, durationMin: x.durationMin ?? null };
        });
      const hoursAsSchedule = input.openingHours.map((h) => ({
        weekday: h.weekday,
        starts: h.opens,
        ends: h.closes
      }));
      if (input.manager.services) {
        await setStaffServices(t, null, salon.id, manager.id, linkServices(input.manager.services));
        await setSchedule(t, null, salon.id, manager.id, hoursAsSchedule);
      }
      for (const [i, st] of input.stylists.entries()) {
        const row = await insertStaff(t, salon.id, {
          name: st.name,
          phone: st.phone,
          color: st.color,
          sort: i + 1
        });
        await setStaffServices(t, null, salon.id, row.id, linkServices(st.services));
        await setSchedule(t, null, salon.id, row.id, st.schedule ?? hoursAsSchedule);
      }
      return salon;
    });
  } catch (e) {
    if (
      pgCode(e) === '23505' &&
      String((e as { constraint_name?: string }).constraint_name) === 'salon_phone_once'
    )
      throw ONE_PER_PHONE();
    if (pgCode(e) === '23505') throw new AppError('CONFLICT', 'Ten adres salonu jest już zajęty.');
    throw e;
  }
}

/** Calendar colours (the dot colour is stored; the panel maps it to the soft card colours). */
export const PERSON_COLORS = ['#C2577F', '#4F7CB8', '#5E8C57', '#C08A3E', '#8A6BB8', '#3E8C8C'];

/**
 * Is "Załóż salon" open, and does it need an invite code?
 * Hosted (default): open to anyone; SIGNUP_CODE, when set, adds an invite code field.
 * SINGLE_SALON=on: the first salon needs no code, then sign-up closes.
 */
export async function signupState(
  sql: Sql
): Promise<{ open: boolean; needsCode: boolean; full: boolean; approval: boolean }> {
  if (flag('SINGLE_SALON')) {
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from salon where not is_demo`;
    return { open: r.n === 0, needsCode: false, full: false, approval: false };
  }
  return {
    open: true,
    needsCode: env('SIGNUP_CODE') !== '',
    full: (await pendingCount(sql)) >= MAX_PENDING,
    approval: true
  };
}

const PL: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

/** "Studio Óla & Ewa" -> "studio-ola-ewa". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL[c])
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** The salon address for a name: the slug, or slug-2, slug-3... when it is taken or reserved. */
export async function freeSlug(sql: Sql, name: string): Promise<string> {
  const base = slugify(name) || 'salon';
  for (let i = 1; i < 100; i++) {
    const cand = i === 1 ? base : `${base.slice(0, 37)}-${i}`;
    if (!isValidSlug(cand)) continue;
    const [r] = await sql`select 1 from salon where slug = ${cand}`;
    if (!r) return cand;
  }
  throw new AppError('CONFLICT', 'Ten adres salonu jest już zajęty.');
}

export interface WizardInput {
  code?: string;
  /** Hidden field: a person never fills it, a bot does. */
  website?: string;
  phoneToken: string;
  name: string;
  slug: string;
  password: string;
  city: string;
  street: string;
  teamSize: string;
  link: string;
  about: string;
  /** team[0] is the owner. Each person is a calendar column and does every ticked service. */
  team: { name: string }[];
  services: { name: string; durationMin: number }[];
  openingHours: HoursItem[];
}

/**
 * "Załóż salon": the wizard. Returns the salon and the owner (manager) staff id, or null for a filled
 * honeypot (the route then answers like a success and stores nothing).
 * Check order: honeypot, invite code, phone token, one salon per phone, 3 per IP a day, 30 pending in total.
 */
export async function signup(
  sql: Sql,
  w: WizardInput,
  ip = 'unknown'
): Promise<{ salon: Salon; managerId: string } | null> {
  if ((w.website ?? '').trim() !== '') return null;
  const st = await signupState(sql);
  if (!st.open) throw new AppError('FORBIDDEN', 'Zakładanie nowych salonów jest zamknięte.');
  if (st.needsCode && (w.code ?? '').trim() !== env('SIGNUP_CODE'))
    throw new AppError('FORBIDDEN', 'Nieprawidłowy kod zaproszenia.');
  const phone = phoneFromSignupToken(w.phoneToken);
  if (!phone) throw new AppError('BAD_CODE', 'Potwierdź numer telefonu kodem z SMS.');
  if (await phoneHasSalon(sql, phone)) throw ONE_PER_PHONE();
  await checkSignupLimits(sql, ip);
  if (!w.city.trim()) throw invalid('Podaj miejscowość.');
  if (!validTeamSize(w.teamSize)) throw invalid('Zaznacz, ile osób pracuje.');
  if (!w.about.trim()) throw invalid('Napisz, czym się zajmujecie.');
  if (!validLink(w.link)) throw invalid('Sprawdź link. Wpisz adres strony albo @nazwę.');
  if (w.team.length === 0) throw invalid('Dodaj co najmniej jedną osobę.');
  if (w.services.length === 0) throw invalid('Zaznacz co najmniej jedną usługę.');
  if (w.openingHours.length === 0) throw invalid('Salon musi być otwarty co najmniej jeden dzień.');
  const single = flag('SINGLE_SALON');
  const services = w.services.map((s, i) => ({ key: `s${i}`, name: s.name, durationMin: s.durationMin }));
  const all = services.map((s) => ({ key: s.key }));
  const [owner, ...others] = w.team;
  const salon = await createSalon(sql, {
    name: w.name,
    slug: w.slug,
    phone,
    address: [w.street.trim(), w.city.trim()].filter(Boolean).join(', '),
    confirmationMode: 'auto',
    isDemo: false,
    status: single ? 'active' : 'pending',
    about: {
      city: w.city.trim(),
      street: w.street.trim(),
      teamSize: w.teamSize,
      link: w.link.trim(),
      about: w.about.trim()
    },
    signupIp: ip,
    openingHours: w.openingHours,
    manager: { name: owner.name, phone, password: w.password, color: PERSON_COLORS[0], services: all },
    services,
    stylists: others.map((p, i) => ({
      name: p.name,
      phone: null,
      color: PERSON_COLORS[(i + 1) % PERSON_COLORS.length],
      services: all
    }))
  });
  const [m] = await sql<{ id: string }[]>`
    select id from staff where salon_id = ${salon.id} and role = 'manager' order by sort limit 1`;
  if (!single) await notifyAdmin(sql, salon);
  return { salon, managerId: m.id };
}

/** Before the SMS code of step 1: refuse a phone that already has a salon, and a full queue. */
export async function checkSignupPhone(sql: Sql, rawPhone: string, ip: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  if (phone && (await phoneHasSalon(sql, phone))) throw ONE_PER_PHONE();
  await checkSignupLimits(sql, ip);
}

export interface SalonSettings {
  name?: string;
  address?: string;
  phone?: string | null;
  confirmationMode?: 'auto' | 'manual';
  managerReminderHours?: number;
  showPrices?: boolean;
}

export async function updateSettings(
  sql: Sql,
  actor: Actor,
  salonId: string,
  s: SalonSettings
): Promise<Salon> {
  if (!can(actor, 'salon:write', { salonId })) throw forbidden();
  const cur = await salonById(sql, salonId);
  if (!cur) throw forbidden();
  const [salon] = await sql<Salon[]>`
    update salon set name = ${s.name?.trim() || cur.name}, address = ${s.address ?? cur.address},
      phone = ${s.phone === undefined ? cur.phone : s.phone},
      confirmation_mode = ${s.confirmationMode ?? cur.confirmation_mode},
      manager_reminder_hours = ${s.managerReminderHours ?? cur.manager_reminder_hours},
      show_prices = ${s.showPrices ?? cur.show_prices}
    where id = ${salonId} returning *`;
  return salon;
}
