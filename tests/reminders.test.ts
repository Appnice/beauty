// S2.C5 (S3): the sms-sweep cron with a fake clock. A visit tomorrow gets exactly one reminder (17:00-20:59),
// a cancelled visit none, nothing goes out between 21:00 and 8:00 Warsaw time, and the manager reminder fires
// once after X hours. The cron itself is a pg-boss schedule.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { startWorkers, sweepReminders } from '../src/lib/server/jobs.ts';
import { getBoss, QUEUES, stopBoss } from '../src/lib/server/queue.ts';
import { changeVisitStatus, createVisit } from '../src/lib/server/visits.ts';
import { at, makeSalon, MON, reset, smsLog, testSql, type TestSalon } from './helpers.ts';

let sql: Sql;
beforeAll(async () => {
  sql = testSql();
  await getBoss();
});
afterAll(async () => {
  await stopBoss();
  await sql.end();
});
beforeEach(async () => {
  await reset(sql);
});

/** A fake clock at a Warsaw wall time, `plusDays` from MON. */
const clockAt = (time: string, plusDays: number) => () =>
  Temporal.PlainDate.from(MON)
    .add({ days: plusDays })
    .toZonedDateTime({ timeZone: 'Europe/Warsaw', plainTime: Temporal.PlainTime.from(time) })
    .toInstant();

const actor = (t: TestSalon) => ({
  salonId: t.salon.id,
  staffId: t.managerId,
  role: 'manager' as const,
  name: 'K'
});

async function receptionVisit(t: TestSalon, start: string, phone: string | null = '+48700000001') {
  const [c] = await sql<{ id: string }[]>`
    insert into client (salon_id, name, phone) values (${t.salon.id}, 'Ola', ${phone}) returning id`;
  return createVisit(sql, t.salon, actor(t), {
    source: 'recepcja',
    clientId: c.id,
    serviceId: t.serviceIds.cut,
    staffId: t.stylistIds[1],
    start
  });
}

const count = async (type: string, visitId?: string) =>
  (
    await sql<{ n: number }[]>`select count(*)::int as n from notification
      where type = ${type} ${visitId ? sql`and visit_id = ${visitId}` : sql``}`
  )[0].n;

describe('day-before reminder', () => {
  it('a visit tomorrow gets exactly one reminder, from 17:00; a cancelled visit gets none', async () => {
    const t = await makeSalon(sql, 'przyp');
    const v = await receptionVisit(t, at('10:00'));
    const gone = await receptionVisit(t, at('12:00'), '+48700000002');
    await changeVisitStatus(sql, t.salon, actor(t), gone.id, 'cancel');
    const noPhone = await receptionVisit(t, at('14:00'), null);
    const log = smsLog();

    expect(await sweepReminders(sql, clockAt('16:50', -1))).toEqual({ reminders: 0, managers: 0 });
    expect(await sweepReminders(sql, clockAt('17:00', -1))).toEqual({ reminders: 1, managers: 0 });
    for (const time of ['17:10', '18:30', '20:50']) {
      expect(await sweepReminders(sql, clockAt(time, -1))).toEqual({ reminders: 0, managers: 0 });
    }
    expect(await count('przypomnienie', v.id)).toBe(1);
    expect(await count('przypomnienie', gone.id)).toBe(0);
    expect(await count('przypomnienie', noPhone.id)).toBe(0);
    expect(log.sent).toHaveLength(1);
    expect(log.sent[0].to).toBe('+48700000001');
    expect(log.sent[0].body).toMatch(
      /: jutro pon\. \d\d\.\d\d o 10:00, Strzyzenie damskie\. Odwolanie: http/
    );
    // two days before and on the day itself: no reminder
    expect((await sweepReminders(sql, clockAt('18:00', -2))).reminders).toBe(0);
    expect((await sweepReminders(sql, clockAt('09:00', 0))).reminders).toBe(0);
  });

  it('nothing between 21:00 and 8:00 Warsaw time', async () => {
    const t = await makeSalon(sql, 'cisza', { confirmationMode: 'manual' });
    await receptionVisit(t, at('10:00'));
    // a waiting online booking made at 20:00 the day before: its manager reminder is due at 22:00
    const [c] = await sql<{ id: string }[]>`
      insert into client (salon_id, name, phone) values (${t.salon.id}, 'Iza', '+48700000003') returning id`;
    const w = await createVisit(sql, t.salon, null, {
      source: 'online',
      clientId: c.id,
      serviceId: t.serviceIds.cut,
      staffId: t.stylistIds[1],
      start: at('15:00')
    });
    expect(w.status).toBe('oczekuje');
    const created = clockAt('20:00', -1)().toString();
    await sql`update visit set created_at = ${created}::timestamptz where id = ${w.id}`;
    const log = smsLog();
    // every 10 minutes from 21:00 to 07:50
    let tick = clockAt('21:00', -1)();
    const end = clockAt('08:00', 0)();
    let runs = 0;
    while (Temporal.Instant.compare(tick, end) < 0) {
      const now = tick;
      expect(await sweepReminders(sql, () => now)).toEqual({ reminders: 0, managers: 0 });
      tick = tick.add({ minutes: 10 });
      runs++;
    }
    expect(runs).toBeGreaterThanOrEqual(60); // 66 runs; 60 or 72 on a DST night
    expect(log.sent).toHaveLength(0);
    // at 08:00 the waiting booking reminds the manager; the visit is today now, so no day-before reminder
    expect(await sweepReminders(sql, clockAt('08:00', 0))).toEqual({ reminders: 0, managers: 1 });
  });
});

describe('manager reminder', () => {
  it('fires once after X hours for a waiting online booking, never for a decided one', async () => {
    const t = await makeSalon(sql, 'decyzja', { confirmationMode: 'manual' });
    expect(t.salon.manager_reminder_hours).toBe(2);
    const book = async (start: string, phone: string) => {
      const [c] = await sql<{ id: string }[]>`
        insert into client (salon_id, name, phone) values (${t.salon.id}, 'Klientka', ${phone}) returning id`;
      const v = await createVisit(sql, t.salon, null, {
        source: 'online',
        clientId: c.id,
        serviceId: t.serviceIds.cut,
        staffId: t.stylistIds[1],
        start
      });
      await sql`update visit set created_at = ${clockAt('10:00', -3)().toString()}::timestamptz where id = ${v.id}`;
      return v;
    };
    const waiting = await book(at('11:00'), '+48700000011');
    const decided = await book(at('13:00'), '+48700000012');
    await changeVisitStatus(sql, t.salon, actor(t), decided.id, 'confirm');
    const log = smsLog();

    expect((await sweepReminders(sql, clockAt('11:50', -3))).managers).toBe(0);
    expect((await sweepReminders(sql, clockAt('12:00', -3))).managers).toBe(1);
    expect((await sweepReminders(sql, clockAt('12:10', -3))).managers).toBe(0);
    expect((await sweepReminders(sql, clockAt('15:00', -2))).managers).toBe(0);
    expect(await count('menadzerka', waiting.id)).toBe(1);
    expect(await count('menadzerka', decided.id)).toBe(0);
    expect(log.sent.map((m) => m.to)).toEqual(['+48600000001']); // the manager of makeSalon()
    expect(log.sent[0].body).toMatch(
      /^Czeka na Ciebie: Klientka, Strzyzenie damskie, pon\. .*\/decyzja\/panel\/czekaja$/
    );
  });

  it('a pending salon gets no reminders at all', async () => {
    const t = await makeSalon(sql, 'czeka-s');
    await receptionVisit(t, at('10:00'));
    await sql`update salon set status = 'pending' where id = ${t.salon.id}`;
    expect(await sweepReminders(sql, clockAt('18:00', -1))).toEqual({ reminders: 0, managers: 0 });
  });
});

describe('the cron', () => {
  it('startWorkers registers sms-sweep every 10 minutes in Warsaw time', async () => {
    await startWorkers(sql);
    const boss = await getBoss();
    const s = await boss.getSchedules(QUEUES.smsSweep);
    expect(s.map((x) => [x.name, x.cron, x.options?.tz])).toEqual([
      ['sms-sweep', '*/10 * * * *', 'Europe/Warsaw']
    ]);
  });
});
