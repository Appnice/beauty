// Online booking by a client with no account: name + phone, the phone is verified by an SMS code.
import type { Sql } from 'postgres';
import {
  BOOKING_TOKEN_MIN,
  bookingToken,
  checkCode,
  issueCode,
  phoneFromBookingToken,
  visitIdFromToken,
  visitToken,
  type IssuedCode
} from './auth.ts';
import { upsertVerifiedClient } from './clients.ts';
import { invalid, notFound } from './errors.ts';
import { normalizePhone } from './phone.ts';
import { clientSmsAllowed, type Salon } from './tenant.ts';
import { AppError } from './errors.ts';
import { systemClock, toInstant, type Clock } from './time.ts';
import { cancelByClient, createVisit, visitById, type VisitRow, type VisitStatus } from './visits.ts';

export const SOON = 'Zapisy online wkrótce';

/** Online booking only in an accepted salon (a pending one sends no SMS to clients). */
export function requireOnline(salon: Salon): void {
  if (!clientSmsAllowed(salon)) throw new AppError('FORBIDDEN', `${SOON}.`);
}

export async function requestBookingCode(
  sql: Sql,
  salon: Salon,
  phone: string,
  ip?: string
): Promise<IssuedCode> {
  requireOnline(salon);
  return issueCode(sql, salon, phone, 'client_verify', ip);
}

/** Online bookings one phone may make in one salon in 24 hours. */
export const BOOKINGS_PER_DAY = 3;

/** Check the SMS code and return a signed phone token (30 min): a taken time can be booked again with no new code. */
export async function verifyBookingCode(
  sql: Sql,
  salon: Salon,
  rawPhone: string,
  code: string
): Promise<{ phone: string; phoneToken: string }> {
  requireOnline(salon);
  const phone = normalizePhone(rawPhone);
  if (!phone) throw invalid('Podaj poprawny numer telefonu.');
  await checkCode(sql, salon.id, phone, 'client_verify', code);
  return { phone, phoneToken: bookingToken(salon.id, phone, Date.now() + BOOKING_TOKEN_MIN * 60_000) };
}

export interface BookInput {
  serviceId: string;
  staffId?: string | null;
  start: string;
  name: string;
  phone: string;
  /** The SMS code, or a phoneToken from verifyBookingCode(). */
  code?: string;
  phoneToken?: string;
  note?: string;
}

export interface Booked {
  visit: VisitRow;
  token: string;
}

export async function book(
  sql: Sql,
  salon: Salon,
  input: BookInput,
  clock: Clock = systemClock
): Promise<Booked> {
  requireOnline(salon);
  const phone = normalizePhone(input.phone);
  if (!phone) throw invalid('Podaj poprawny numer telefonu.');
  const name = input.name.trim();
  if (name.length < 2) throw invalid('Podaj imię.');
  let phoneToken = input.phoneToken ?? '';
  if (!phoneToken || phoneFromBookingToken(phoneToken, salon.id) !== phone) {
    if (!input.code) throw new AppError('BAD_CODE', 'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.');
    phoneToken = (await verifyBookingCode(sql, salon, phone, input.code)).phoneToken;
  }
  const [n] = await sql<{ n: number }[]>`
    select count(*)::int as n from visit v join client c on c.id = v.client_id and c.salon_id = v.salon_id
    where v.salon_id = ${salon.id} and c.phone = ${phone} and v.source = 'online'
      and v.created_at > now() - interval '24 hours'`;
  if (n.n >= BOOKINGS_PER_DAY) {
    throw new AppError('RATE_LIMITED', 'Masz już 3 rezerwacje na dziś. Zadzwoń do salonu.');
  }
  const client = await upsertVerifiedClient(sql, salon.id, name, phone);
  let visit: VisitRow;
  try {
    visit = await createVisit(
      sql,
      salon,
      null,
      {
        source: 'online',
        clientId: client.id,
        serviceId: input.serviceId,
        staffId: input.staffId ?? null,
        start: input.start,
        note: input.note
      },
      clock
    );
  } catch (e) {
    // The time went while the client typed: she keeps her verified phone and picks again, with no new code.
    if (e instanceof AppError && (e.code === 'TERM_TAKEN' || e.code === 'TERM_UNAVAILABLE')) {
      throw new AppError(e.code, 'Ten termin jest już zajęty. Wybierz inny.', { phoneToken });
    }
    throw e;
  }
  return { visit, token: visitToken(visit.id) };
}

export interface VisitStatusView {
  status: VisitStatus;
  start: string;
  end: string;
  service: string;
  serviceId: string;
  staff: string;
  staffId: string;
  clientName: string;
  canCancel: boolean;
  /** Last moment the client may cancel online (start minus the salon cut-off). */
  cancelUntil: string;
}

const NO_VISIT = 'Nie znaleziono wizyty.';

/** Last moment to cancel from the link: the start minus the salon's cut-off hours (default 2). */
export function cancelDeadline(salon: Pick<Salon, 'cancel_cutoff_hours'>, startsAt: Date): Temporal.Instant {
  return toInstant(startsAt).subtract({ hours: salon.cancel_cutoff_hours ?? 2 });
}

export async function visitStatusByToken(
  sql: Sql,
  salon: Salon,
  token: string,
  clock: Clock = systemClock
): Promise<VisitStatusView> {
  const id = visitIdFromToken(token);
  const v = id ? await visitById(sql, salon.id, id) : null;
  if (!v) throw notFound(NO_VISIT);
  const until = cancelDeadline(salon, v.starts_at);
  return {
    status: v.status,
    start: v.starts_at.toISOString(),
    end: v.ends_at.toISOString(),
    service: v.service_name,
    serviceId: v.service_id,
    staff: v.staff_name,
    staffId: v.staff_id,
    clientName: v.client_name,
    canCancel:
      Temporal.Instant.compare(clock(), until) < 0 &&
      (v.status === 'oczekuje' || v.status === 'potwierdzona'),
    cancelUntil: until.toString()
  };
}

export async function cancelByToken(sql: Sql, salon: Salon, token: string, clock: Clock = systemClock) {
  const id = visitIdFromToken(token);
  if (!id) throw notFound(NO_VISIT);
  return cancelByClient(sql, salon, id, clock);
}

/** The short SMS link /w/<token>: the salon slug of a valid token, or null. Nothing else leaves this function. */
export async function slugForVisitToken(sql: Sql, token: string): Promise<string | null> {
  const id = visitIdFromToken(token);
  if (!id) return null;
  const [r] = await sql<{ slug: string }[]>`
    select s.slug from visit v join salon s on s.id = v.salon_id where v.id = ${id}::uuid and s.status <> 'rejected'`;
  return r?.slug ?? null;
}

function icsTime(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsText(s: string): string {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
}

/** "Dodaj do kalendarza": one VEVENT (UTC times) for the visit behind a signed link. */
export async function visitIcs(sql: Sql, salon: Salon, token: string, url: string): Promise<string> {
  const id = visitIdFromToken(token);
  const v = id ? await visitById(sql, salon.id, id) : null;
  if (!v) throw notFound(NO_VISIT);
  const where = [salon.street, salon.city].filter(Boolean).join(', ') || salon.address;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//beauty//zapisy//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${v.id}@beauty`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(v.starts_at)}`,
    `DTEND:${icsTime(v.ends_at)}`,
    `SUMMARY:${icsText(`${v.service_name} · ${salon.name}`)}`,
    ...(where ? [`LOCATION:${icsText(where)}`] : []),
    `URL:${url}`,
    v.status === 'odwolana' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}
