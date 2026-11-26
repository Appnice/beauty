// Salon approval on the hosted instance: the admin notice, the admin list, accept, reject and the purge
// of rejected salons after 30 days. Every admin action writes one admin_audit row.
import type { Sql } from 'postgres';
import { env, publicUrl, quiet } from './env.ts';
import { AppError, notFound } from './errors.ts';
import { sendSms } from './notify.ts';
import { normalizePhone } from './phone.ts';
import { T, texts } from './sms/templates.ts';
import type { Salon, SalonStatus } from './tenant.ts';
import { systemClock, type Clock } from './time.ts';

export const PURGE_AFTER_DAYS = 30;
export const MAX_PENDING = 30;

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number }>;

let notifyFetch: FetchLike = (url, init) => fetch(url, init);

/** Tests swap the HTTP call to ADMIN_NOTIFY_URL. */
export function useNotifyFetch(f: FetchLike | null): void {
  notifyFetch = f ?? ((url, init) => fetch(url, init));
}

/**
 * Tell the platform admin about a new salon: one SMS to ADMIN_PHONE (a notification row of that salon, so it
 * counts like any SMS) and, when ADMIN_NOTIFY_URL is set, one POST of a plain-text line (an ntfy topic).
 * A failing notice never fails the sign-up.
 */
export async function notifyAdmin(sql: Sql, salon: Salon): Promise<{ sms: boolean; post: boolean }> {
  const line = T.admin_nowy_salon(salon.name, salon.city, `${publicUrl()}/admin`);
  const out = { sms: false, post: false };
  const phone = normalizePhone(env('ADMIN_PHONE'));
  if (phone) {
    try {
      await sendSms(sql, { salonId: salon.id, type: 'admin_nowy_salon', to: phone, body: line });
      out.sms = true;
    } catch (e) {
      console.error('[admin] SMS failed', e);
    }
  }
  const url = env('ADMIN_NOTIFY_URL');
  if (url) {
    try {
      const r = await notifyFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain; charset=utf-8', title: 'beauty' },
        body: line
      });
      out.post = r.ok;
      if (!r.ok) console.error(`[admin] notice POST answered ${r.status}`);
    } catch (e) {
      console.error('[admin] notice POST failed', e);
    }
  }
  if (!quiet()) console.info(`[admin] ${line}`);
  return out;
}

export interface AdminSalon {
  id: string;
  slug: string;
  name: string;
  city: string;
  street: string;
  about: string;
  team_size: string | null;
  phone: string | null;
  link: string;
  status: SalonStatus;
  reject_reason: string;
  submitted_at: Date | null;
  decided_at: Date | null;
  created_at: Date;
}

/** Salons of one status for /admin, newest sign-up first, and the count of each status. */
export async function listForAdmin(
  sql: Sql,
  status: SalonStatus
): Promise<{ salons: AdminSalon[]; counts: Record<SalonStatus, number> }> {
  const salons = await sql<AdminSalon[]>`
    select id, slug, name, city, street, about, team_size, phone, link, status, reject_reason,
      submitted_at, decided_at, created_at
    from salon where not is_demo and status = ${status} and submitted_at is not null
    order by ${status === 'pending' ? sql`submitted_at` : sql`decided_at`} desc nulls last
    limit 200`;
  const rows = await sql<{ status: SalonStatus; n: number }[]>`
    select status, count(*)::int as n from salon
    where not is_demo and submitted_at is not null group by status`;
  const counts: Record<SalonStatus, number> = { pending: 0, active: 0, rejected: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return { salons, counts };
}

/** Pending salons in total (the 30 cap of the wizard). */
export async function pendingCount(sql: Sql): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from salon where status = 'pending'`;
  return r.n;
}

async function audit(
  sql: Sql,
  s: { id: string; slug: string; name: string },
  action: 'accept' | 'reject' | 'purge',
  reason = '',
  ip: string | null = null
): Promise<void> {
  await sql`insert into admin_audit (salon_id, salon_slug, salon_name, action, reason, ip)
    values (${s.id}, ${s.slug}, ${s.name}, ${action}, ${reason}, ${ip})`;
}

async function decide(
  sql: Sql,
  id: string,
  to: 'active' | 'rejected',
  reason: string,
  now: Temporal.Instant
) {
  const [s] = await sql<Salon[]>`
    update salon set status = ${to}, decided_at = ${now.toString()}::timestamptz, reject_reason = ${reason}
    where id = ${id}::uuid and status = 'pending' and not is_demo returning *`;
  if (s) return s;
  const [cur] = await sql`select status from salon where id = ${id}::uuid`;
  if (!cur) throw notFound('Nie ma takiego salonu.');
  throw new AppError('CONFLICT', 'Ten salon jest już rozpatrzony.');
}

/** "Akceptuj": the booking page and the client SMS go on; one SMS to the owner. */
export async function accept(sql: Sql, id: string, ip: string | null = null, clock: Clock = systemClock) {
  const s = await decide(sql, id, 'active', '', clock());
  await audit(sql, s, 'accept', '', ip);
  if (s.phone) {
    await sendSms(sql, {
      salonId: s.id,
      type: 'salon_przyjety',
      to: s.phone,
      body: texts(s.lang).salon_przyjety(`${publicUrl()}/${s.slug}`)
    });
  }
  return s;
}

/** "Odrzuć": one optional reason, one SMS to the owner, the owner can no longer log in. */
export async function reject(
  sql: Sql,
  id: string,
  reason = '',
  ip: string | null = null,
  clock: Clock = systemClock
) {
  const why = reason.trim().slice(0, 300);
  const s = await decide(sql, id, 'rejected', why, clock());
  await audit(sql, s, 'reject', why, ip);
  await sql`delete from session where salon_id = ${s.id}`;
  if (s.phone) {
    await sendSms(sql, {
      salonId: s.id,
      type: 'salon_odrzucony',
      to: s.phone,
      body: texts(s.lang).salon_odrzucony(s.name, why)
    });
  }
  return s;
}

/** Delete rejected salons (and all their data) 30 days after the decision. Returns the deleted slugs. */
export async function purgeRejected(sql: Sql, now: Temporal.Instant = systemClock()): Promise<string[]> {
  const cutoff = now.subtract({ hours: 24 * PURGE_AFTER_DAYS }).toString();
  const old = await sql<{ id: string; slug: string; name: string }[]>`
    select id, slug, name from salon
    where status = 'rejected' and not is_demo and decided_at <= ${cutoff}::timestamptz`;
  for (const s of old) {
    await sql.begin(async (tx) => {
      await tx`delete from salon where id = ${s.id}::uuid`;
      await audit(tx as unknown as Sql, s, 'purge');
    });
  }
  return old.map((s) => s.slug);
}
