// S1.C2 (double booking guard in the DB) and S1.C6 (online booking, confirmation modes, cancel, SMS rows).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { connect, pgCode } from '../src/lib/server/db.ts';
import { AppError } from '../src/lib/server/errors.ts';
import { handleConfirmation, handleManagerReminder, handleReminder } from '../src/lib/server/jobs.ts';
import { getBoss, queuedFor, QUEUES, stopBoss } from '../src/lib/server/queue.ts';
import { createVisit, freeSlots, visitById } from '../src/lib/server/visits.ts';
import * as bookingRoute from '../src/routes/api/[salon]/booking/+server.ts';
import * as codeRoute from '../src/routes/api/[salon]/booking/code/+server.ts';
import * as statusRoute from '../src/routes/api/[salon]/booking/[token]/+server.ts';
import * as cancelRoute from '../src/routes/api/[salon]/booking/[token]/cancel/+server.ts';
import * as availRoute from '../src/routes/api/[salon]/availability/+server.ts';
import * as visitRoute from '../src/routes/api/[salon]/visits/[id]/+server.ts';
import {
  at,
  call,
  lastCode,
  makeSalon,
  MON,
  reset,
  sessionFor,
  smsLog,
  testSql,
  type TestSalon
} from './helpers.ts';

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

async function client(t: TestSalon, name = 'Klientka', phone: string | null = '+48700000001') {
  const [c] = await sql<{ id: string }[]>`
    insert into client (salon_id, name, phone) values (${t.salon.id}, ${name}, ${phone}) returning id`;
  return c.id;
}

const actorOf = (t: TestSalon) => ({
  salonId: t.salon.id,
  staffId: t.managerId,
  role: 'manager' as const,
  name: 'K'
});

describe('S1.C2 double booking', () => {
  it('the guard is an EXCLUDE constraint on a time range, created by a migration', async () => {
    const migration = readFileSync('migrations/001_init.sql', 'utf8');
    expect(migration).toMatch(/exclude using gist \(staff_id with =, during with &&\)/);
    const [c] = await sql<{ def: string }[]>`
      select pg_get_constraintdef(oid) as def from pg_constraint
      where conname = 'visit_no_overlap' and contype = 'x'`;
    expect(c.def).toContain('EXCLUDE USING gist (staff_id WITH =, during WITH &&)');
    expect(c.def).toContain("'oczekuje'");
  });

  it('two concurrent bookings for one stylist and overlapping time: exactly one succeeds', async () => {
    const t = await makeSalon(sql, 'salon-a');
    const c1 = await client(t, 'Pierwsza', '+48700000001');
    const c2 = await client(t, 'Druga', '+48700000002');
    const a = connect(process.env.DATABASE_URL, 1);
    const b = connect(process.env.DATABASE_URL, 1);
    try {
      const ewa = t.stylistIds[0];
      const results = await Promise.allSettled([
        createVisit(a, t.salon, actorOf(t), {
          source: 'recepcja',
          clientId: c1,
          serviceId: t.serviceIds.cut,
          staffId: ewa,
          start: at('10:00')
        }),
        createVisit(b, t.salon, actorOf(t), {
          source: 'recepcja',
          clientId: c2,
          serviceId: t.serviceIds.cut,
          staffId: ewa,
          start: at('10:30')
        })
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason).toBeInstanceOf(AppError);
      expect((failed[0].reason as AppError).code).toBe('TERM_TAKEN');
      const [n] = await sql<
        { n: number }[]
      >`select count(*)::int as n from visit where salon_id = ${t.salon.id}`;
      expect(n.n).toBe(1);
    } finally {
      await a.end();
      await b.end();
    }
  });

  it('the database alone rejects an overlap from two open transactions (no app code involved)', async () => {
    const t = await makeSalon(sql, 'salon-a');
    const c1 = await client(t);
    const a = connect(process.env.DATABASE_URL, 1);
    const b = connect(process.env.DATABASE_URL, 1);
    const ins = (s: Sql, start: string, end: string) => s`
      insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until, status, source)
      values (${t.salon.id}, ${c1}, ${t.stylistIds[0]}, ${t.serviceIds.cut}, ${start}::timestamptz,
              ${end}::timestamptz, ${end}::timestamptz, 'potwierdzona', 'recepcja')`;
    try {
      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      const first = a.begin(async (tx) => {
        await ins(tx as unknown as Sql, at('12:00'), at('13:00'));
        await hold; // keep the transaction open while the second one tries
      });
      await new Promise((r) => setTimeout(r, 100));
      const second = ins(b, at('12:30'), at('13:30')).then(
        () => 'ok',
        (e) => pgCode(e)
      );
      await new Promise((r) => setTimeout(r, 200));
      release();
      await first;
      expect(await second).toBe('23P01');
    } finally {
      await a.end();
      await b.end();
    }
  });

  it('back-to-back visits and the buffer: the next visit may start when the buffer ends, not before', async () => {
    const t = await makeSalon(sql, 'salon-a');
    const c1 = await client(t);
    const base = {
      source: 'recepcja' as const,
      clientId: c1,
      serviceId: t.serviceIds.cut,
      staffId: t.stylistIds[1]
    };
    await createVisit(sql, t.salon, actorOf(t), { ...base, start: at('09:00') }); // 09:00-10:00 + 10 min buffer
    await expect(
      createVisit(sql, t.salon, actorOf(t), { ...base, start: at('10:00') })
    ).rejects.toMatchObject({ code: 'TERM_TAKEN' });
    await expect(
      createVisit(sql, t.salon, actorOf(t), { ...base, start: at('10:10') })
    ).resolves.toMatchObject({ status: 'potwierdzona' });
  });

  it('a cancelled visit does not block the time', async () => {
    const t = await makeSalon(sql, 'salon-a');
    const c1 = await client(t);
    const base = {
      source: 'recepcja' as const,
      clientId: c1,
      serviceId: t.serviceIds.cut,
      staffId: t.stylistIds[1]
    };
    const v = await createVisit(sql, t.salon, actorOf(t), { ...base, start: at('09:00') });
    await sql`update visit set status = 'odwolana' where id = ${v.id}`;
    await expect(
      createVisit(sql, t.salon, actorOf(t), { ...base, start: at('09:00') })
    ).resolves.toBeTruthy();
  });
});

async function bookOnline(t: TestSalon, phone: string, start: string, staffId: string | null) {
  const sms = smsLog();
  const code = await call(codeRoute, 'POST', '/api/[salon]/booking/code', {
    params: { salon: t.salon.slug },
    body: { phone }
  });
  expect(code.status).toBe(200);
  expect(code.json.code).toBeUndefined(); // not a demo salon, SMS_ECHO off: the code is not on screen
  return call(bookingRoute, 'POST', '/api/[salon]/booking', {
    params: { salon: t.salon.slug },
    body: {
      serviceId: t.serviceIds.cut,
      staffId,
      start,
      name: 'Joanna Nowak',
      phone,
      code: lastCode(sms, phone)
    }
  });
}

describe('S1.C6 online booking', () => {
  it('manual mode: status "oczekuje"; a confirmation job, reminders only from the sweep', async () => {
    const t = await makeSalon(sql, 'salon-r', { confirmationMode: 'manual' });
    const r = await bookOnline(t, '+48 700 100 200', at('11:00', 1), t.stylistIds[0]);
    expect(r.status).toBe(200);
    expect(r.json.visit.status).toBe('oczekuje');
    // S3: the day-before and manager reminders come from the sms-sweep cron (reminders.test.ts), not delayed jobs
    expect(await queuedFor(QUEUES.managerReminder, r.json.visit.id)).toHaveLength(0);
    expect(await queuedFor(QUEUES.reminder, r.json.visit.id)).toHaveLength(0);
    const jobs = await queuedFor(QUEUES.confirmation, r.json.visit.id);
    expect(jobs).toHaveLength(1);

    // The jobs write notification rows: "waits" text to the client, a reminder to the manager.
    smsLog();
    const data = jobs[0].data;
    expect((await handleConfirmation(sql, data))!.type).toBe('oczekuje');
    const mgr = await handleManagerReminder(sql, data);
    expect(mgr.map((n) => n.type)).toEqual(['menadzerka']);

    // The manager confirms: the client gets a confirmation; a later manager reminder does nothing.
    const token = await sessionFor(sql, t.salon.id, t.managerId);
    const ok = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: { salon: t.salon.slug, id: r.json.visit.id },
      token,
      body: { action: 'confirm' }
    });
    expect(ok.json.visit.status).toBe('potwierdzona');
    // the "waits" job is stale now (it ran late): only the job of the decision sends
    expect(await handleConfirmation(sql, data)).toBeNull();
    const after = await queuedFor(QUEUES.confirmation, r.json.visit.id);
    const confirmJob = after.find((j) => j.data.status === 'potwierdzona')!;
    expect((await handleConfirmation(sql, confirmJob.data))!.type).toBe('potwierdzenie');
    expect(await handleManagerReminder(sql, { visitId: data.visitId, salonId: data.salonId })).toEqual([]);
  });

  it('automatic mode: status "potwierdzona", no manager reminder', async () => {
    const t = await makeSalon(sql, 'salon-r', { confirmationMode: 'auto' });
    const r = await bookOnline(t, '700100200', at('11:00', 1), null);
    expect(r.status).toBe(200);
    expect(r.json.visit.status).toBe('potwierdzona');
    expect(await queuedFor(QUEUES.managerReminder, r.json.visit.id)).toHaveLength(0);
    expect(await queuedFor(QUEUES.confirmation, r.json.visit.id)).toHaveLength(1);
  });

  it('"obojętnie" books the first free stylist; a taken time is refused', async () => {
    const t = await makeSalon(sql, 'salon-r');
    const r1 = await bookOnline(t, '700100201', at('11:00', 1), null);
    const v1 = await visitById(sql, t.salon.id, r1.json.visit.id);
    expect(v1!.staff_id).toBe(t.stylistIds[0]);
    const r2 = await bookOnline(t, '700100202', at('11:00', 1), null);
    expect((await visitById(sql, t.salon.id, r2.json.visit.id))!.staff_id).toBe(t.stylistIds[1]);
    const r3 = await bookOnline(t, '700100203', at('11:00', 1), null);
    expect(r3.status).toBe(409);
    expect(r3.json.error.code).toBe('TERM_UNAVAILABLE');
  });

  it('a wrong code is refused and books nothing', async () => {
    const t = await makeSalon(sql, 'salon-r');
    await call(codeRoute, 'POST', '/api/[salon]/booking/code', {
      params: { salon: t.salon.slug },
      body: { phone: '700100200' }
    });
    const r = await call(bookingRoute, 'POST', '/api/[salon]/booking', {
      params: { salon: t.salon.slug },
      body: {
        serviceId: t.serviceIds.cut,
        start: at('11:00', 1),
        name: 'Ala',
        phone: '700100200',
        code: '000000'
      }
    });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('BAD_CODE');
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from visit`;
    expect(n.n).toBe(0);
  });

  it('an online start outside the offered times is refused (past, closed, not on the grid)', async () => {
    const t = await makeSalon(sql, 'salon-r');
    for (const start of ['2020-01-06T10:00:00Z', at('18:00'), at('10:05')]) {
      const r = await bookOnline(t, '700100200', start, t.stylistIds[0]);
      expect(r.status).toBe(409);
      expect(r.json.error.code).toBe('TERM_UNAVAILABLE');
      await sql`delete from rate_limit`;
    }
  });

  it('cancelling from the SMS link frees the time', async () => {
    const t = await makeSalon(sql, 'salon-r');
    const ewa = t.stylistIds[0];
    const start = at('11:00', 1);
    const slotsAt = async () => {
      const a = await call(availRoute, 'GET', '/api/[salon]/availability', {
        params: { salon: t.salon.slug },
        search: { service: t.serviceIds.cut, staff: ewa, date: MON, days: '3' }
      });
      return (a.json.slots as { start: string }[]).some((s) => s.start === start);
    };
    expect(await slotsAt()).toBe(true);
    const r = await bookOnline(t, '700100200', start, ewa);
    expect(await slotsAt()).toBe(false);

    const status = await call(statusRoute, 'GET', '/api/[salon]/booking/[token]', {
      params: { salon: t.salon.slug, token: r.json.token }
    });
    expect(status.json).toMatchObject({
      status: 'potwierdzona',
      canCancel: true,
      service: 'Strzyżenie damskie'
    });
    const c = await call(cancelRoute, 'POST', '/api/[salon]/booking/[token]/cancel', {
      params: { salon: t.salon.slug, token: r.json.token }
    });
    expect(c.json.status).toBe('odwolana');
    expect(await slotsAt()).toBe(true);
    // and someone else can book it now
    const again = await bookOnline(t, '700100299', start, ewa);
    expect(again.status).toBe(200);
    // a reminder for the cancelled visit sends nothing
    expect(await handleReminder(sql, { visitId: r.json.visit.id, salonId: t.salon.id })).toBeNull();
  });

  it('every SMS is a notification row; the log provider sends nothing over the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const t = await makeSalon(sql, 'salon-r', { confirmationMode: 'manual' });
    const r = await bookOnline(t, '700100200', at('12:00', 2), null);
    const data = { visitId: r.json.visit.id, salonId: t.salon.id, startsAt: r.json.visit.start };
    const sms = smsLog();
    await handleConfirmation(sql, data);
    await handleManagerReminder(sql, data);
    const rows = await sql<
      { type: string; status: string; provider: string; cost_grosze: number; channel: string }[]
    >`
      select type, status, provider, cost_grosze, channel from notification where salon_id = ${t.salon.id} order by created_at`;
    expect(rows.map((x) => x.type)).toEqual(['kod_klient', 'oczekuje', 'menadzerka']);
    expect(
      rows.every(
        (x) => x.status === 'logged' && x.provider === 'log' && x.cost_grosze === 0 && x.channel === 'sms'
      )
    ).toBe(true);
    expect(sms.sent).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('a reception visit is confirmed at once and gets only the day-before reminder (from the sweep)', async () => {
    const t = await makeSalon(sql, 'salon-r', { confirmationMode: 'manual' });
    const c1 = await client(t);
    const v = await createVisit(sql, t.salon, actorOf(t), {
      source: 'recepcja',
      clientId: c1,
      serviceId: t.serviceIds.color,
      staffId: null,
      start: at('09:00', 2)
    });
    expect(v.status).toBe('potwierdzona');
    expect(v.source).toBe('recepcja');
    // Ewa does colour in 90 min instead of 120, plus the 15 min buffer
    expect((v.ends_at.getTime() - v.starts_at.getTime()) / 60000).toBe(90);
    expect((v.blocked_until.getTime() - v.ends_at.getTime()) / 60000).toBe(15);
    expect(await queuedFor(QUEUES.confirmation, v.id)).toHaveLength(0);
    expect(await queuedFor(QUEUES.managerReminder, v.id)).toHaveLength(0);
    expect(await queuedFor(QUEUES.reminder, v.id)).toHaveLength(0);
    smsLog();
    expect((await handleReminder(sql, { visitId: v.id, salonId: t.salon.id }))!.type).toBe('przypomnienie');
    // a second run sends nothing: one reminder per visit (unique index notification_once)
    expect(await handleReminder(sql, { visitId: v.id, salonId: t.salon.id })).toBeNull();
  });

  it('the DB loader feeds the engine: visits and blocks of the salon are busy', async () => {
    const t = await makeSalon(sql, 'salon-r');
    const iza = t.stylistIds[1];
    const c1 = await client(t);
    await createVisit(sql, t.salon, actorOf(t), {
      source: 'recepcja',
      clientId: c1,
      serviceId: t.serviceIds.cut,
      staffId: iza,
      start: at('09:00')
    });
    await sql`insert into block (salon_id, staff_id, starts_at, ends_at, reason)
      values (${t.salon.id}, ${iza}, ${at('12:00')}::timestamptz, ${at('17:00')}::timestamptz, 'Przerwa')`;
    const slots = await freeSlots(sql, t.salon, {
      serviceId: t.serviceIds.cut,
      staffId: iza,
      from: Temporal.PlainDate.from(MON),
      days: 1
    });
    // 11:00 + 60 min + 10 min buffer would reach into the 12:00 block
    expect(slots.map((s) => s.time)).toEqual(['10:15', '10:30', '10:45']);
  });
});
