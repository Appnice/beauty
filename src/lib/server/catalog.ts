// Salon set-up: stylists, services, who does what, weekly schedules, opening hours.
import type { Sql } from 'postgres';
import { forbidden, invalid, notFound } from './errors.ts';
import { normalizePhone } from './phone.ts';
import { can, type Actor } from './policy.ts';
import { hhmm } from './time.ts';
import { hashPassword } from './auth.ts';
import { inTx } from './db.ts';

export interface StaffRow {
  id: string;
  salon_id: string;
  name: string;
  role: 'manager' | 'stylist';
  phone: string | null;
  color: string;
  active: boolean;
  sort: number;
}

export interface ServiceRow {
  id: string;
  salon_id: string;
  name: string;
  duration_min: number;
  price_grosze: number | null;
  buffer_min: number;
  active: boolean;
  sort: number;
}

export interface StaffServiceRow {
  staff_id: string;
  service_id: string;
  duration_min: number | null;
}

export interface ScheduleItem {
  staffId: string;
  weekday: number;
  starts: string;
  ends: string;
}

export interface HoursItem {
  weekday: number;
  opens: string;
  closes: string;
}

const STAFF_COLS = ['id', 'salon_id', 'name', 'role', 'phone', 'color', 'active', 'sort'] as const;

// ---------- read (public parts have no actor) ----------

export async function listServices(sql: Sql, salonId: string, activeOnly = true): Promise<ServiceRow[]> {
  return sql<ServiceRow[]>`
    select id, salon_id, name, duration_min, price_grosze, buffer_min, active, sort from service
    where salon_id = ${salonId} ${activeOnly ? sql`and active` : sql``} order by sort, name`;
}

export async function getService(sql: Sql, salonId: string, id: string): Promise<ServiceRow | null> {
  const [s] = await sql<ServiceRow[]>`
    select id, salon_id, name, duration_min, price_grosze, buffer_min, active, sort from service
    where salon_id = ${salonId} and id = ${id}::uuid`;
  return s ?? null;
}

/** Active staff of a salon. Phones are only for the panel; the public page uses publicStaff(). */
export async function listStaff(sql: Sql, salonId: string): Promise<StaffRow[]> {
  return sql<
    StaffRow[]
  >`select ${sql([...STAFF_COLS])} from staff where salon_id = ${salonId} order by sort, name`;
}

export async function getStaff(sql: Sql, salonId: string, id: string): Promise<StaffRow | null> {
  const [s] = await sql<StaffRow[]>`
    select ${sql([...STAFF_COLS])} from staff where salon_id = ${salonId} and id = ${id}::uuid`;
  return s ?? null;
}

export async function staffServices(sql: Sql, salonId: string): Promise<StaffServiceRow[]> {
  return sql<StaffServiceRow[]>`
    select staff_id, service_id, duration_min from staff_service where salon_id = ${salonId}`;
}

export async function schedules(sql: Sql, salonId: string, staffId?: string): Promise<ScheduleItem[]> {
  const rows = await sql<{ staff_id: string; weekday: number; starts: string; ends: string }[]>`
    select staff_id, weekday, starts::text, ends::text from schedule
    where salon_id = ${salonId} ${staffId ? sql`and staff_id = ${staffId}::uuid` : sql``}
    order by weekday, starts`;
  return rows.map((r) => ({
    staffId: r.staff_id,
    weekday: r.weekday,
    starts: hhmm(r.starts),
    ends: hhmm(r.ends)
  }));
}

export async function openingHours(sql: Sql, salonId: string): Promise<HoursItem[]> {
  const rows = await sql<{ weekday: number; opens: string; closes: string }[]>`
    select weekday, opens::text, closes::text from opening_hours where salon_id = ${salonId} order by weekday`;
  return rows.map((r) => ({ weekday: r.weekday, opens: hhmm(r.opens), closes: hhmm(r.closes) }));
}

/** What the public booking page may show: names, colours, services. No phones. */
export async function publicCatalog(sql: Sql, salonId: string) {
  const [services, staff, links, hours] = await Promise.all([
    listServices(sql, salonId),
    listStaff(sql, salonId),
    staffServices(sql, salonId),
    openingHours(sql, salonId)
  ]);
  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.duration_min,
      priceGrosze: s.price_grosze
    })),
    staff: staff
      .filter((s) => s.active && links.some((l) => l.staff_id === s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        services: links.filter((l) => l.staff_id === s.id).map((l) => l.service_id)
      })),
    openingHours: hours
  };
}

// ---------- write (manager only) ----------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkTimes(starts: string, ends: string) {
  if (!TIME_RE.test(starts) || !TIME_RE.test(ends) || starts >= ends)
    throw invalid('Podaj poprawne godziny.');
}

export interface StaffInput {
  name: string;
  /** Empty or null = no phone yet (the person cannot log in until the manager adds one). */
  phone?: string | null;
  role?: 'manager' | 'stylist';
  color?: string;
  password?: string;
  sort?: number;
  active?: boolean;
}

export async function createStaff(
  sql: Sql,
  actor: Actor,
  salonId: string,
  input: StaffInput
): Promise<StaffRow> {
  if (!can(actor, 'staff:write', { salonId })) throw forbidden();
  return insertStaff(sql, salonId, input);
}

/** Without a policy check: used by salon creation and the seed. */
export async function insertStaff(sql: Sql, salonId: string, input: StaffInput): Promise<StaffRow> {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw invalid('Podaj poprawny numer telefonu.');
  if (!input.name.trim()) throw invalid('Podaj imię.');
  const hash = input.password ? await hashPassword(input.password) : null;
  const [s] = await sql<StaffRow[]>`
    insert into staff (salon_id, name, role, phone, color, password_hash, sort)
    values (${salonId}, ${input.name.trim()}, ${input.role ?? 'stylist'}, ${phone}, ${input.color ?? '#B5838D'},
            ${hash}, ${input.sort ?? 0})
    returning ${sql([...STAFF_COLS])}`;
  return s;
}

export async function updateStaff(
  sql: Sql,
  actor: Actor,
  salonId: string,
  id: string,
  input: Partial<StaffInput>
): Promise<StaffRow> {
  if (!can(actor, 'staff:write', { salonId })) throw forbidden();
  const cur = await getStaff(sql, salonId, id);
  if (!cur) throw notFound();
  const phone = input.phone === undefined ? cur.phone : input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw invalid('Podaj poprawny numer telefonu.');
  const hash = input.password ? await hashPassword(input.password) : null;
  const [s] = await sql<StaffRow[]>`
    update staff set name = ${input.name?.trim() || cur.name}, phone = ${phone},
      role = ${input.role ?? cur.role}, color = ${input.color ?? cur.color}, sort = ${input.sort ?? cur.sort},
      active = ${input.active ?? cur.active}, password_hash = coalesce(${hash}, password_hash)
    where salon_id = ${salonId} and id = ${id}::uuid
    returning ${sql([...STAFF_COLS])}`;
  return s;
}

export interface ServiceInput {
  name: string;
  durationMin: number;
  priceGrosze?: number | null;
  bufferMin?: number;
  sort?: number;
  active?: boolean;
}

export async function createService(sql: Sql, actor: Actor, salonId: string, input: ServiceInput) {
  if (!can(actor, 'service:write', { salonId })) throw forbidden();
  return insertService(sql, salonId, input);
}

export async function insertService(sql: Sql, salonId: string, input: ServiceInput): Promise<ServiceRow> {
  if (!input.name.trim()) throw invalid('Podaj nazwę usługi.');
  const [s] = await sql<ServiceRow[]>`
    insert into service (salon_id, name, duration_min, price_grosze, buffer_min, sort)
    values (${salonId}, ${input.name.trim()}, ${input.durationMin}, ${input.priceGrosze ?? null},
            ${input.bufferMin ?? 0}, ${input.sort ?? 0})
    returning id, salon_id, name, duration_min, price_grosze, buffer_min, active, sort`;
  return s;
}

export async function updateService(
  sql: Sql,
  actor: Actor,
  salonId: string,
  id: string,
  input: Partial<ServiceInput>
): Promise<ServiceRow> {
  if (!can(actor, 'service:write', { salonId })) throw forbidden();
  const cur = await getService(sql, salonId, id);
  if (!cur) throw notFound();
  const [s] = await sql<ServiceRow[]>`
    update service set name = ${input.name?.trim() || cur.name},
      duration_min = ${input.durationMin ?? cur.duration_min},
      price_grosze = ${input.priceGrosze === undefined ? cur.price_grosze : input.priceGrosze},
      buffer_min = ${input.bufferMin ?? cur.buffer_min}, sort = ${input.sort ?? cur.sort},
      active = ${input.active ?? cur.active}
    where salon_id = ${salonId} and id = ${id}::uuid
    returning id, salon_id, name, duration_min, price_grosze, buffer_min, active, sort`;
  return s;
}

/** Replace the services a stylist does (with optional own durations). */
export async function setStaffServices(
  sql: Sql,
  actor: Actor | null,
  salonId: string,
  staffId: string,
  items: { serviceId: string; durationMin?: number | null }[]
): Promise<void> {
  if (actor && !can(actor, 'staff:write', { salonId })) throw forbidden();
  if (!(await getStaff(sql, salonId, staffId))) throw notFound();
  await inTx(sql, async (tx) => {
    await tx`delete from staff_service where salon_id = ${salonId} and staff_id = ${staffId}::uuid`;
    for (const it of items) {
      await tx`insert into staff_service (salon_id, staff_id, service_id, duration_min)
        values (${salonId}, ${staffId}, ${it.serviceId}, ${it.durationMin ?? null})`;
    }
  });
}

/** Replace the weekly schedule of a stylist. */
export async function setSchedule(
  sql: Sql,
  actor: Actor | null,
  salonId: string,
  staffId: string,
  items: { weekday: number; starts: string; ends: string }[]
): Promise<void> {
  if (actor && !can(actor, 'schedule:write', { salonId, staffId })) throw forbidden();
  if (!(await getStaff(sql, salonId, staffId))) throw notFound();
  for (const it of items) checkTimes(it.starts, it.ends);
  await inTx(sql, async (tx) => {
    await tx`delete from schedule where salon_id = ${salonId} and staff_id = ${staffId}::uuid`;
    for (const it of items) {
      await tx`insert into schedule (salon_id, staff_id, weekday, starts, ends)
        values (${salonId}, ${staffId}, ${it.weekday}, ${it.starts}, ${it.ends})`;
    }
  });
}

/** Schedules the actor may read: all for a manager, only her own for a stylist. */
export async function readSchedules(sql: Sql, actor: Actor, salonId: string, staffId?: string) {
  if (actor.role !== 'manager') {
    if (staffId && staffId !== actor.staffId) throw forbidden();
    staffId = actor.staffId;
  }
  if (!can(actor, 'schedule:read', { salonId, staffId: staffId ?? null })) throw forbidden();
  return schedules(sql, salonId, staffId);
}

export async function setOpeningHours(sql: Sql, actor: Actor | null, salonId: string, items: HoursItem[]) {
  if (actor && !can(actor, 'salon:write', { salonId })) throw forbidden();
  for (const it of items) checkTimes(it.opens, it.closes);
  await inTx(sql, async (tx) => {
    await tx`delete from opening_hours where salon_id = ${salonId}`;
    for (const it of items) {
      await tx`insert into opening_hours (salon_id, weekday, opens, closes)
        values (${salonId}, ${it.weekday}, ${it.opens}, ${it.closes})`;
    }
  });
}
