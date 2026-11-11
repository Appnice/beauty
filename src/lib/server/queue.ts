// pg-boss in the same Postgres (schema pgboss). One instance per process, started on first use.
import { PgBoss } from 'pg-boss';
import { databaseUrl } from './env.ts';

export const QUEUES = {
  confirmation: 'sms-confirmation',
  reminder: 'sms-reminder-day-before', // old delayed jobs only; the sweep sends reminders now
  smsSweep: 'sms-sweep',
  cancellation: 'sms-cancellation',
  managerReminder: 'manager-reminder',
  demoPrune: 'demo-prune',
  purgeRejected: 'purge-rejected-salons'
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface VisitJob {
  visitId: string;
  salonId: string;
  startsAt?: string; // the start the job was planned for; a moved visit makes the job stale
  status?: string; // the visit status the job was planned for; a later decision makes the job stale
}

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export async function getBoss(url = databaseUrl()): Promise<PgBoss> {
  if (boss) return boss;
  if (!starting) {
    starting = (async () => {
      const b = new PgBoss({ connectionString: url, schema: 'pgboss', max: 3 });
      b.on('error', (e) => console.error('[jobs]', e));
      await b.start();
      for (const name of Object.values(QUEUES)) await b.createQueue(name);
      boss = b;
      return b;
    })();
  }
  return starting;
}

export async function stopBoss(): Promise<void> {
  const b = boss ?? (starting ? await starting : null);
  boss = null;
  starting = null;
  if (b) await b.stop({ graceful: false, close: true });
}

export async function enqueue(name: QueueName, data: object, startAfter?: Date): Promise<string | null> {
  const b = await getBoss();
  return b.send(name, data, startAfter ? { startAfter } : {});
}

/** Queued (not yet done) jobs of a queue whose data has this visit id. For tests and the panel. */
export async function queuedFor(name: QueueName, visitId: string) {
  const b = await getBoss();
  return b.findJobs<VisitJob>(name, { data: { visitId }, queued: true });
}
