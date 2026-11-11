// Visit lifecycle: oczekuje -> potwierdzona -> zakonczona | nieobecnosc; oczekuje | potwierdzona -> odwolana.
// Reception visits are confirmed at once; online visits follow the salon confirmation mode.
// The database (EXCLUDE on staff + time range) is the guard against double booking.
import type { Sql } from 'postgres';
import { availability, freeStaffAt, type AvailabilityInput, type Slot } from './availability.ts';
import { getService, openingHours, schedules, type ServiceRow } from './catalog.ts';
import { pgCode, retryDeadlock } from './db.ts';
import { AppError, forbidden, invalid, notFound } from './errors.ts';
import { can, type Actor } from './policy.ts';
import { enqueue, QUEUES } from './queue.ts';
import type { Salon } from './tenant.ts';
import { systemClock, toInstant, zonedInstant, type Clock } from './time.ts';

export type VisitStatus = 'oczekuje' | 'potwierdzona' | 'odwolana' | 'nieobecnosc' | 'zakonczona';
export type VisitSource = 'online' | 'recepcja';
export const ACTIVE: VisitStatus[] = ['oczekuje', 'potwierdzona'];

/** Shown in every view instead of the name of a client erased on request (RODO). */
export const ERASED_NAME = 'Usunięty klient';

export interface VisitRow {
  id: string;
  salon_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  starts_at: Date;
  ends_at: Date;
  blocked_until: Date;
  status: VisitStatus;
  source: VisitSource;
  price_grosze: number | null;
  note: string;
  created_at: Date;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by: 'klient' | 'salon' | null;
}

export interface VisitView extends VisitRow {
  client_name: string;
  client_phone: string | null;
  service_name: string;
  staff_name: string;
}

const termTaken = () => new AppError('TERM_TAKEN', 'Ten termin jest już zajęty. Wybierz inny.');
const termUnavailable = () => new AppError('TERM_UNAVAILABLE', 'Ten termin nie jest dostępny. Wybierz inny.');

// ---------- availability from the database ----------

interface StaffForService {
  id: string;
  duration_min: number | null;
}

async function staffForService(sql: Sql, salonId: string, serviceId: string): Promise<StaffForService[]> {
  return sql<StaffForService[]>`
    select st.id, ss.duration_min from staff_service ss
    join staff st on st.id = ss.staff_id and st.salon_id = ss.salon_id
    where ss.salon_id = ${salonId} and ss.service_id = ${serviceId}::uuid and st.active
    order by st.sort, st.name`;
}

/** Everything the pure engine needs for one service and a date range. */
export async function availabilityInput(
  sql: Sql,
  salon: Salon,
  q: {
    serviceId: string;
    staffId?: string | null;
    from: Temporal.PlainDate;
    days: number;
    now: Temporal.Instant;
  },
  service?: ServiceRow | null
): Promise<AvailabilityInput> {
  const svc = service ?? (await getService(sql, salon.id, q.serviceId));
  if (!svc || !svc.active) throw notFound('Nie ma takiej usługi.');
  const staff = await staffForService(sql, salon.id, svc.id);
  const winFrom = zonedInstant(q.from, '00:00', salon.timezone).toString();
  const winTo = zonedInstant(q.from.add({ days: q.days + 1 }), '00:00', salon.timezone).toString();
  const busy = await sql<{ staff_id: string; s: Date; e: Date }[]>`
    select staff_id, starts_at as s, ends_at as e from block
      where salon_id = ${salon.id} and starts_at < ${winTo}::timestamptz and ends_at > ${winFrom}::timestamptz
    union all
    select staff_id, starts_at, blocked_until from visit
      where salon_id = ${salon.id} and status in ('oczekuje', 'potwierdzona')
        and starts_at < ${winTo}::timestamptz and blocked_until > ${winFrom}::timestamptz`;
  return {
    tz: salon.timezone,
    now: q.now,
    from: q.from,
    days: q.days,
    service: { id: svc.id, durationMin: svc.duration_min, bufferMin: svc.buffer_min },
    staff: staff.map((s) => ({ id: s.id, durationMin: s.duration_min })),
    staffId: q.staffId ?? null,
    openingHours: await openingHours(sql, salon.id),
    schedules: await schedules(sql, salon.id),
    busy: busy.map((b) => ({ staffId: b.staff_id, start: toInstant(b.s), end: toInstant(b.e) }))
  };
}

export async function freeSlots(
  sql: Sql,
  salon: Salon,
  q: { serviceId: string; staffId?: string | null; from: Temporal.PlainDate; days: number },
  clock: Clock = systemClock
): Promise<Slot[]> {
  const days = Math.min(Math.max(q.days, 1), 31);
  return availability(await availabilityInput(sql, salon, { ...q, days, now: clock() }));
}

// ---------- create ----------

export interface CreateVisitInput {
  source: VisitSource;
  clientId: string;
  serviceId: string;
  staffId?: string | null; // null = "obojętnie"
  start: string; // ISO instant
  note?: string;
}

export async function createVisit(
  sql: Sql,
  salon: Salon,
  actor: Actor | null,
  input: CreateVisitInput,
  clock: Clock = systemClock
): Promise<VisitRow> {
  if (input.source === 'recepcja' && !can(actor, 'visit:write', { salonId: salon.id })) throw forbidden();
  let start: Temporal.Instant;
  try {
    start = Temporal.Instant.from(input.start);
  } catch {
    throw invalid('Podaj poprawny termin.');
  }
  const service = await getService(sql, salon.id, input.serviceId);
  if (!service || !service.active) throw notFound('Nie ma takiej usługi.');
  const [client] =
    await sql`select id from client where salon_id = ${salon.id} and id = ${input.clientId}::uuid`;
  if (!client) throw notFound('Nie ma takiego klienta.');

  const now = clock();
  let staffId = input.staffId ?? null;
  if (input.source === 'online' || !staffId) {
    // Online: only a start the engine offers. Reception with "obojętnie": the first free stylist.
    const avail = await availabilityInput(
      sql,
      salon,
      {
        serviceId: service.id,
        staffId,
        from: start.toZonedDateTimeISO(salon.timezone).toPlainDate(),
        days: 1,
        now
      },
      service
    );
    const free = freeStaffAt(avail, start);
    if (free.length === 0) throw termUnavailable();
    staffId = free[0];
  }

  const [link] = await sql<{ duration_min: number | null; active: boolean }[]>`
    select ss.duration_min, st.active from staff st
    left join staff_service ss on ss.staff_id = st.id and ss.salon_id = st.salon_id and ss.service_id = ${service.id}
    where st.salon_id = ${salon.id} and st.id = ${staffId}::uuid`;
  if (!link || !link.active) throw notFound('Nie ma takiej osoby w zespole.');
  const duration = link.duration_min ?? service.duration_min;
  const end = start.add({ minutes: duration });
  const blockedUntil = end.add({ minutes: service.buffer_min });

  const status: VisitStatus =
    input.source === 'recepcja' || salon.confirmation_mode === 'auto' ? 'potwierdzona' : 'oczekuje';

  let visit: VisitRow;
  try {
    [visit] = await retryDeadlock(
      () => sql<VisitRow[]>`
      insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until, status,
                         source, price_grosze, note, created_by, confirmed_at)
      values (${salon.id}, ${input.clientId}, ${staffId}, ${service.id}, ${start.toString()}::timestamptz,
              ${end.toString()}::timestamptz, ${blockedUntil.toString()}::timestamptz, ${status}, ${input.source},
              ${service.price_grosze}, ${input.note ?? ''}, ${actor?.staffId ?? null},
              ${status === 'potwierdzona' ? now.toString() : null}::timestamptz)
      returning *`
    );
  } catch (e) {
    if (pgCode(e) === '23P01') throw termTaken();
    throw e;
  }
  await planNotifications(salon, visit, { created: true });
  return visit;
}

/** Queue the SMS jobs that follow a visit change. */
async function planNotifications(
  salon: Salon,
  v: VisitRow,
  what: { created?: boolean; confirmed?: boolean; moved?: boolean }
): Promise<void> {
  const data = {
    visitId: v.id,
    salonId: salon.id,
    startsAt: toInstant(v.starts_at).toString(),
    status: v.status
  };
  // Online bookings get a confirmation (or "waits for the salon"); a moved visit tells the client the new time.
  if (what.moved || (v.source === 'online' && (what.created || what.confirmed))) {
    await enqueue(QUEUES.confirmation, data);
  }
  // The day-before reminder and the manager reminder come from the sms-sweep cron (jobs.ts sweepReminders),
  // so a moved or cancelled visit needs no clean-up and each reminder goes out once.
}

// ---------- read ----------

const VIEW = (sql: Sql) => sql`
  select v.*, case when c.erased_at is null then c.name else ${ERASED_NAME} end as client_name,
    c.phone as client_phone, s.name as service_name, st.name as staff_name
  from visit v
  join client c on c.id = v.client_id and c.salon_id = v.salon_id
  join service s on s.id = v.service_id and s.salon_id = v.salon_id
  join staff st on st.id = v.staff_id and st.salon_id = v.salon_id`;

export async function visitById(sql: Sql, salonId: string, id: string): Promise<VisitView | null> {
  const [v] = await sql<VisitView[]>`${VIEW(sql)} where v.salon_id = ${salonId} and v.id = ${id}::uuid`;
  return v ?? null;
}

export async function getVisit(sql: Sql, actor: Actor, salonId: string, id: string): Promise<VisitView> {
  const v = await visitById(sql, salonId, id);
  if (!v) throw notFound('Nie ma takiej wizyty.');
  if (!can(actor, 'visit:read', { salonId, staffId: v.staff_id })) throw forbidden();
  return v;
}

/** Visits in a time range. A stylist sees only her own. */
export async function listVisits(
  sql: Sql,
  actor: Actor,
  salonId: string,
  q: { from: string; to: string; staffId?: string; status?: VisitStatus }
): Promise<VisitView[]> {
  let staffId = q.staffId;
  if (actor.role !== 'manager') {
    if (staffId && staffId !== actor.staffId) throw forbidden();
    staffId = actor.staffId;
  }
  if (!can(actor, 'visit:read', { salonId, staffId: staffId ?? null })) throw forbidden();
  return sql<VisitView[]>`${VIEW(sql)}
    where v.salon_id = ${salonId} and v.starts_at < ${q.to}::timestamptz and v.ends_at > ${q.from}::timestamptz
      ${staffId ? sql`and v.staff_id = ${staffId}::uuid` : sql``}
      ${q.status ? sql`and v.status = ${q.status}` : sql``}
    order by v.starts_at`;
}

/** Online bookings that wait for the manager. */
export async function pendingVisits(sql: Sql, actor: Actor, salonId: string): Promise<VisitView[]> {
  if (!can(actor, 'visit:write', { salonId })) throw forbidden();
  return sql<VisitView[]>`${VIEW(sql)}
    where v.salon_id = ${salonId} and v.status = 'oczekuje' order by v.created_at`;
}

// ---------- status changes ----------

export type VisitAction = 'confirm' | 'cancel' | 'no_show' | 'finish';

const TRANSITIONS: Record<VisitAction, { from: VisitStatus[]; to: VisitStatus }> = {
  confirm: { from: ['oczekuje'], to: 'potwierdzona' },
  cancel: { from: ['oczekuje', 'potwierdzona'], to: 'odwolana' },
  no_show: { from: ['potwierdzona'], to: 'nieobecnosc' },
  finish: { from: ['potwierdzona'], to: 'zakonczona' }
};

async function transition(
  sql: Sql,
  salon: Salon,
  id: string,
  action: VisitAction,
  by: 'klient' | 'salon',
  now: Temporal.Instant
): Promise<VisitRow> {
  const t = TRANSITIONS[action];
  const [v] = await sql<VisitRow[]>`
    update visit set status = ${t.to},
      confirmed_at = case when ${t.to} = 'potwierdzona' then ${now.toString()}::timestamptz else confirmed_at end,
      cancelled_at = case when ${t.to} = 'odwolana' then ${now.toString()}::timestamptz else cancelled_at end,
      cancelled_by = case when ${t.to} = 'odwolana' then ${by} else cancelled_by end
    where salon_id = ${salon.id} and id = ${id}::uuid and status in ${sql(t.from)}
    returning *`;
  if (!v) {
    const cur = await visitById(sql, salon.id, id);
    if (!cur) throw notFound('Nie ma takiej wizyty.');
    throw new AppError('CONFLICT', 'Tej wizyty nie można już zmienić.');
  }
  return v;
}

export async function changeVisitStatus(
  sql: Sql,
  salon: Salon,
  actor: Actor,
  id: string,
  action: VisitAction,
  clock: Clock = systemClock
): Promise<VisitRow> {
  const cur = await visitById(sql, salon.id, id);
  if (!cur) throw notFound('Nie ma takiej wizyty.');
  if (!can(actor, 'visit:write', { salonId: salon.id, staffId: cur.staff_id })) throw forbidden();
  const now = clock();
  if (
    (action === 'no_show' || action === 'finish') &&
    Temporal.Instant.compare(toInstant(cur.starts_at), now) > 0
  ) {
    throw invalid('Ta wizyta jeszcze się nie zaczęła.');
  }
  const v = await transition(sql, salon, id, action, 'salon', now);
  const data = { visitId: v.id, salonId: salon.id, startsAt: toInstant(v.starts_at).toString() };
  if (action === 'confirm') await planNotifications(salon, v, { confirmed: true });
  if (action === 'cancel' && Temporal.Instant.compare(toInstant(v.starts_at), now) > 0) {
    await enqueue(QUEUES.cancellation, data);
  }
  return v;
}

/** The client cancels from the signed link, until the salon's cut-off (default 2 h before the start). */
export async function cancelByClient(
  sql: Sql,
  salon: Salon,
  id: string,
  clock: Clock = systemClock
): Promise<VisitRow> {
  const now = clock();
  const cur = await visitById(sql, salon.id, id);
  if (!cur) throw notFound('Nie znaleziono wizyty.');
  if (Temporal.Instant.compare(toInstant(cur.starts_at), now) <= 0) {
    throw new AppError('CONFLICT', 'Ta wizyta już się zaczęła. Zadzwoń do salonu.');
  }
  const until = toInstant(cur.starts_at).subtract({ hours: salon.cancel_cutoff_hours ?? 2 });
  if (Temporal.Instant.compare(now, until) >= 0) {
    throw new AppError('CONFLICT', 'Na odwołanie jest już za późno. Zadzwoń do salonu.');
  }
  return transition(sql, salon, id, 'cancel', 'klient', now);
}

/** Move a visit (drag in the calendar): new start and/or stylist. The DB guard still applies. */
export async function moveVisit(
  sql: Sql,
  salon: Salon,
  actor: Actor,
  id: string,
  input: { start: string; staffId?: string },
  _clock: Clock = systemClock // kept for callers; a move plans no timed job any more
): Promise<VisitRow> {
  const cur = await visitById(sql, salon.id, id);
  if (!cur) throw notFound('Nie ma takiej wizyty.');
  if (!can(actor, 'visit:write', { salonId: salon.id, staffId: cur.staff_id })) throw forbidden();
  if (!ACTIVE.includes(cur.status)) throw new AppError('CONFLICT', 'Tej wizyty nie można już przesunąć.');
  const staffId = input.staffId ?? cur.staff_id;
  const service = await getService(sql, salon.id, cur.service_id);
  if (!service) throw notFound();
  const [link] = await sql<{ duration_min: number | null }[]>`
    select ss.duration_min from staff st
    left join staff_service ss on ss.staff_id = st.id and ss.salon_id = st.salon_id and ss.service_id = ${service.id}
    where st.salon_id = ${salon.id} and st.id = ${staffId}::uuid and st.active`;
  if (!link) throw notFound('Nie ma takiej osoby w zespole.');
  const start = Temporal.Instant.from(input.start);
  const end = start.add({ minutes: link.duration_min ?? service.duration_min });
  const blockedUntil = end.add({ minutes: service.buffer_min });
  let v: VisitRow;
  try {
    [v] = await retryDeadlock(
      () => sql<VisitRow[]>`
      update visit set staff_id = ${staffId}, starts_at = ${start.toString()}::timestamptz,
        ends_at = ${end.toString()}::timestamptz, blocked_until = ${blockedUntil.toString()}::timestamptz
      where salon_id = ${salon.id} and id = ${id}::uuid returning *`
    );
  } catch (e) {
    if (pgCode(e) === '23P01') throw termTaken();
    throw e;
  }
  await planNotifications(salon, v, { moved: true });
  return v;
}

/** The note on a visit (the visit card in the panel). Manager only. */
export async function setVisitNote(
  sql: Sql,
  salon: Salon,
  actor: Actor,
  id: string,
  note: string
): Promise<VisitRow> {
  const cur = await visitById(sql, salon.id, id);
  if (!cur) throw notFound('Nie ma takiej wizyty.');
  if (!can(actor, 'visit:write', { salonId: salon.id, staffId: cur.staff_id })) throw forbidden();
  const [v] = await sql<VisitRow[]>`
    update visit set note = ${note.trim()} where salon_id = ${salon.id} and id = ${id}::uuid returning *`;
  return v;
}
