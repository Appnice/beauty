// Background job handlers. Each handler reads the visit again and does nothing when the job is stale
// (visit cancelled, moved, or already decided), so queued jobs never need to be cancelled.
// The day-before reminder and the manager reminder come from one cron sweep (sweepReminders), not from
// delayed jobs: the unique index notification_once lets each go out once, and the sweep keeps quiet hours.
import type { Sql } from 'postgres';
import { visitToken } from './auth.ts';
import { publicUrl, quiet } from './env.ts';
import { sendOnce, sendSms, type NotificationRow } from './notify.ts';
import { getBoss, QUEUES, type VisitJob } from './queue.ts';
import { pruneDemo } from './seed.ts';
import { smsWhen, texts } from './sms/templates.ts';
import { clientSmsAllowed, salonById, type Salon } from './tenant.ts';
import { purgeRejected } from './approval.ts';
import { systemClock, toInstant, type Clock } from './time.ts';
import { visitById, type VisitView } from './visits.ts';

/** The short link in an SMS (about 75 characters): /w/<token> sends a 302 to the visit status page. */
export function statusLink(_salon: Salon, visitId: string): string {
  return `${publicUrl()}/w/${visitToken(visitId)}`;
}

export function bookingLink(salon: Salon): string {
  return `${publicUrl()}/${salon.slug}`;
}

async function load(sql: Sql, job: VisitJob): Promise<{ salon: Salon; v: VisitView } | null> {
  const salon = await salonById(sql, job.salonId);
  if (!salon || !clientSmsAllowed(salon)) return null; // a pending salon sends no SMS to clients
  const v = await visitById(sql, salon.id, job.visitId);
  if (!v) return null;
  if (job.startsAt && v.starts_at.getTime() !== toInstant(job.startsAt).epochMilliseconds) return null; // moved
  // decided since (a "waits" job that runs after the owner confirmed): the job of the decision sends the SMS
  if (job.status && job.status !== v.status) return null;
  return { salon, v };
}

/** Confirmation after booking or after the manager confirms; "waits" text in manual mode. */
export async function handleConfirmation(sql: Sql, job: VisitJob): Promise<NotificationRow | null> {
  const x = await load(sql, job);
  const to = x?.v.client_phone;
  if (!x || !to) return null;
  const { salon, v } = x;
  const when = smsWhen(v.starts_at, salon.timezone, salon.lang);
  const link = statusLink(salon, v.id);
  const base = { salonId: salon.id, visitId: v.id, to };
  if (v.status === 'potwierdzona') {
    return sendSms(sql, {
      ...base,
      type: 'potwierdzenie',
      body: texts(salon.lang).potwierdzenie(salon.name, v.service_name, when, link)
    });
  }
  if (v.status === 'oczekuje') {
    return sendSms(sql, {
      ...base,
      type: 'oczekuje',
      body: texts(salon.lang).oczekuje(salon.name, v.service_name, when, link)
    });
  }
  return null;
}

/** The day-before reminder of one visit (sweepReminders picks the visits). Sent once per visit. */
export async function handleReminder(sql: Sql, job: VisitJob): Promise<NotificationRow | null> {
  const x = await load(sql, job);
  const to = x?.v.client_phone;
  if (!x || !to || x.v.status !== 'potwierdzona') return null;
  const { salon, v } = x;
  return sendOnce(sql, {
    salonId: salon.id,
    visitId: v.id,
    type: 'przypomnienie',
    to,
    body: texts(salon.lang).przypomnienie(
      salon.name,
      v.service_name,
      smsWhen(v.starts_at, salon.timezone, salon.lang),
      statusLink(salon, v.id)
    )
  });
}

/** The salon cancelled a visit ('odwolanie') or declined a waiting online booking ('odrzucenie'). */
export async function handleCancellation(sql: Sql, job: VisitJob): Promise<NotificationRow | null> {
  const x = await load(sql, job);
  const to = x?.v.client_phone;
  if (!x || !to || x.v.status !== 'odwolana' || x.v.cancelled_by !== 'salon') return null;
  const { salon, v } = x;
  const when = smsWhen(v.starts_at, salon.timezone, salon.lang);
  const declined = v.source === 'online' && v.confirmed_at === null;
  return sendSms(sql, {
    salonId: salon.id,
    visitId: v.id,
    type: declined ? 'odrzucenie' : 'odwolanie',
    to,
    body: declined
      ? texts(salon.lang).odrzucenie(salon.name, v.service_name, when, bookingLink(salon))
      : texts(salon.lang).odwolanie(salon.name, v.service_name, when)
  });
}

/** Manual mode: the booking still waits after X hours, so every manager with a phone gets one SMS. */
export async function handleManagerReminder(sql: Sql, job: VisitJob): Promise<NotificationRow[]> {
  const x = await load(sql, job);
  if (!x || x.v.status !== 'oczekuje') return [];
  const { salon, v } = x;
  const managers = await sql<{ id: string; phone: string }[]>`
    select id, phone from staff where salon_id = ${salon.id} and role = 'manager' and active and phone is not null`;
  const out: NotificationRow[] = [];
  for (const m of managers) {
    const n = await sendOnce(sql, {
      salonId: salon.id,
      visitId: v.id,
      staffId: m.id,
      type: 'menadzerka',
      to: m.phone,
      body: texts(salon.lang).menadzerka(
        v.client_name,
        v.service_name,
        smsWhen(v.starts_at, salon.timezone, salon.lang),
        `${publicUrl()}/${salon.slug}/panel/czekaja`
      )
    });
    if (n) out.push(n);
  }
  return out;
}

/** Day-before reminders go out from 17:00 to 20:59 local time. */
export const REMINDER_FROM_HOUR = 17;
/** No SMS from 21:00 to 7:59 local time. */
export const QUIET_FROM_HOUR = 21;
export const QUIET_UNTIL_HOUR = 8;

export interface SweepResult {
  reminders: number;
  managers: number;
}

/**
 * The sms-sweep cron (every 10 minutes). For each accepted salon, in its own time zone:
 * - 17:00-20:59: one reminder for each confirmed visit tomorrow (the client has a phone);
 * - 8:00-20:59: one SMS to the managers for each online booking that still waits after manager_reminder_hours.
 * Nothing between 21:00 and 8:00. The unique index stops a second SMS of the same kind.
 */
export async function sweepReminders(sql: Sql, clock: Clock = systemClock): Promise<SweepResult> {
  const now = clock();
  const out: SweepResult = { reminders: 0, managers: 0 };
  // the demo salon is skipped: its clients are made up
  const salons = await sql<Salon[]>`select * from salon where status = 'active' and not is_demo`;
  for (const salon of salons) {
    const local = now.toZonedDateTimeISO(salon.timezone);
    if (local.hour >= QUIET_FROM_HOUR || local.hour < QUIET_UNTIL_HOUR) continue;
    if (local.hour >= REMINDER_FROM_HOUR) {
      const tomorrow = local.toPlainDate().add({ days: 1 });
      const from = tomorrow.toZonedDateTime({ timeZone: salon.timezone }).toInstant().toString();
      const to = tomorrow
        .add({ days: 1 })
        .toZonedDateTime({ timeZone: salon.timezone })
        .toInstant()
        .toString();
      const due = await sql<{ id: string }[]>`
        select v.id from visit v join client c on c.id = v.client_id and c.salon_id = v.salon_id
        where v.salon_id = ${salon.id} and v.status = 'potwierdzona' and c.phone is not null
          and v.starts_at >= ${from}::timestamptz and v.starts_at < ${to}::timestamptz
          and not exists (select 1 from notification n
                          where n.salon_id = v.salon_id and n.visit_id = v.id and n.type = 'przypomnienie')`;
      for (const d of due) {
        if (await handleReminder(sql, { visitId: d.id, salonId: salon.id })) out.reminders++;
      }
    }
    // a waiting booking reminds the managers even when the salon switched to automatic mode since
    const waiting = await sql<{ id: string }[]>`
      select v.id from visit v
      where v.salon_id = ${salon.id} and v.status = 'oczekuje' and v.source = 'online'
        and v.starts_at > ${now.toString()}::timestamptz
        and v.created_at + make_interval(hours => ${salon.manager_reminder_hours}) <= ${now.toString()}::timestamptz
        and not exists (select 1 from notification n
                        where n.salon_id = v.salon_id and n.visit_id = v.id and n.type = 'menadzerka')`;
    for (const w of waiting) {
      out.managers += (await handleManagerReminder(sql, { visitId: w.id, salonId: salon.id })).length;
    }
  }
  return out;
}

/** Start the workers and the demo cron in this process (hooks.server.ts). */
export async function startWorkers(sql: Sql): Promise<void> {
  const boss = await getBoss();
  const wrap = (fn: (sql: Sql, d: VisitJob) => Promise<unknown>) => async (jobs: { data: VisitJob }[]) => {
    for (const j of jobs) await fn(sql, j.data);
  };
  await boss.work<VisitJob>(QUEUES.confirmation, wrap(handleConfirmation));
  await boss.work<VisitJob>(QUEUES.reminder, wrap(handleReminder));
  await boss.work<VisitJob>(QUEUES.cancellation, wrap(handleCancellation));
  await boss.work<VisitJob>(QUEUES.managerReminder, wrap(handleManagerReminder));
  await boss.work(QUEUES.smsSweep, async () => {
    const r = await sweepReminders(sql);
    if ((r.reminders || r.managers) && !quiet()) console.info(`[jobs] sms-sweep ${JSON.stringify(r)}`);
  });
  await boss.schedule(QUEUES.smsSweep, '*/10 * * * *', null, { tz: 'Europe/Warsaw' });
  await boss.work(QUEUES.demoPrune, async () => {
    await pruneDemo(sql);
  });
  await boss.schedule(QUEUES.demoPrune, '17 * * * *', null, { tz: 'Europe/Warsaw' });
  await boss.work(QUEUES.purgeRejected, async () => {
    const gone = await purgeRejected(sql);
    if (gone.length && !quiet()) console.info(`[jobs] purged rejected salons: ${gone.join(', ')}`);
  });
  await boss.schedule(QUEUES.purgeRejected, '40 3 * * *', null, { tz: 'Europe/Warsaw' });
  if (!quiet()) console.info('[jobs] workers started');
}
