// Every outgoing message is a notification row (type, status, cost), so the panel can count SMS per salon.
import type { Sql } from 'postgres';
import { pgCode } from './db.ts';
import { env } from './env.ts';
import { AppError } from './errors.ts';
import { smsProvider } from './sms/index.ts';

export type NotificationType =
  | 'kod_klient' // phone check code for a client
  | 'kod_logowania' // staff login code
  | 'potwierdzenie' // visit confirmed
  | 'oczekuje' // online booking waits for the manager
  | 'przypomnienie' // reminder the day before
  | 'odwolanie' // visit cancelled by the salon
  | 'odrzucenie' // the salon declined a waiting online booking
  | 'menadzerka' // reminder to the manager about waiting bookings
  | 'admin_nowy_salon' // the platform admin: a new salon waits
  | 'salon_przyjety' // the owner: the salon is accepted
  | 'salon_odrzucony'; // the owner: the salon is rejected

export interface NotifyInput {
  salonId: string;
  type: NotificationType;
  to: string;
  body: string;
  visitId?: string | null;
  staffId?: string | null;
}

export interface NotificationRow {
  id: string;
  salon_id: string;
  visit_id: string | null;
  staff_id: string | null;
  type: string;
  channel: string;
  to_phone: string;
  body: string;
  status: string;
  provider: string;
  provider_id: string | null;
  cost_grosze: number;
  error: string | null;
  created_at: Date;
  sent_at: Date | null;
}

/** SMS package per salon per month (SMS_MONTHLY_LIMIT, default 300). */
export function monthlyLimit(): number {
  return Number(env('SMS_MONTHLY_LIMIT', '300')) || 300;
}

/** The first instant of this month and of the next one in the salon zone (the SMS counter window). */
export function monthWindow(tz = 'Europe/Warsaw', now: Temporal.Instant = Temporal.Now.instant()) {
  const first = now.toZonedDateTimeISO(tz).toPlainDate().with({ day: 1 });
  const at = (d: Temporal.PlainDate) => d.toZonedDateTime({ timeZone: tz }).toInstant().toString();
  return { since: at(first), until: at(first.add({ months: 1 })) };
}

export const CLIENT_LIMIT_MSG = 'Salon nie może teraz wysłać SMS-a. Zadzwoń do salonu.';
export const STAFF_LIMIT_MSG = 'Limit SMS w tym miesiącu się skończył. Zaloguj się hasłem.';

/**
 * Send one SMS and keep it as a notification row. Over the monthly package of the salon a code request fails
 * with a Polish message (the person waits for it on screen); any other SMS gets a row with status 'limit'
 * and is not sent.
 */
export async function sendSms(sql: Sql, n: NotifyInput): Promise<NotificationRow> {
  const provider = smsProvider();
  const [salon] = await sql<{ timezone: string }[]>`select timezone from salon where id = ${n.salonId}`;
  const win = monthWindow(salon?.timezone);
  const used = await smsCounter(sql, n.salonId, win.since, win.until);
  const over = used.count >= monthlyLimit();
  if (over && n.type === 'kod_klient') throw new AppError('RATE_LIMITED', CLIENT_LIMIT_MSG);
  if (over && n.type === 'kod_logowania') throw new AppError('RATE_LIMITED', STAFF_LIMIT_MSG);
  const [row] = await sql<NotificationRow[]>`
    insert into notification (salon_id, visit_id, staff_id, type, channel, to_phone, body, status, provider)
    values (${n.salonId}, ${n.visitId ?? null}, ${n.staffId ?? null}, ${n.type}, 'sms', ${n.to}, ${n.body},
            ${over ? 'limit' : 'queued'}, ${provider.name})
    returning *`;
  if (over) return row;
  const r = await provider.send({ to: n.to, body: n.body });
  const [done] = await sql<NotificationRow[]>`
    update notification set status = ${r.status}, provider_id = ${r.providerId ?? null},
      cost_grosze = ${r.costGrosze}, error = ${r.error ?? null},
      sent_at = case when ${r.status} = 'failed' then null else now() end
    where id = ${row.id} returning *`;
  return done;
}

/** sendSms for the reminders: a second one of the same visit, type (and manager) is skipped (null). */
export async function sendOnce(sql: Sql, n: NotifyInput): Promise<NotificationRow | null> {
  try {
    return await sendSms(sql, n);
  } catch (e) {
    if (pgCode(e) === '23505') return null; // the unique index notification_once: already sent
    throw e;
  }
}

export interface SmsCounter {
  count: number;
  cost_grosze: number;
}

/** SMS count and cost of a salon since a date (the panel counter). Rows over the limit were not sent. */
export async function smsCounter(
  sql: Sql,
  salonId: string,
  since: string,
  until?: string
): Promise<SmsCounter> {
  const [r] = await sql<{ count: number; cost_grosze: number }[]>`
    select count(*)::int as count, coalesce(sum(cost_grosze), 0)::int as cost_grosze
    from notification where salon_id = ${salonId} and channel = 'sms' and status <> 'limit' and created_at >= ${since}::timestamptz
      ${until ? sql`and created_at < ${until}::timestamptz` : sql``}`;
  return r;
}
