// S3 booking flow: only fitting times (S2.C4), a time taken while the client types (409 + phoneToken, no new
// code), the cancel cut-off, the limits (codes, bookings a day, monthly SMS package), the RODO erase (S2.C7),
// a pending salon, the short SMS link and the calendar file.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { cancelByToken, visitStatusByToken } from '../src/lib/server/booking.ts';
import { handleConfirmation } from '../src/lib/server/jobs.ts';
import { stopBoss } from '../src/lib/server/queue.ts';
import { createVisit, visitById } from '../src/lib/server/visits.ts';
import * as bookingRoute from '../src/routes/api/[salon]/booking/+server.ts';
import * as codeRoute from '../src/routes/api/[salon]/booking/code/+server.ts';
import * as verifyRoute from '../src/routes/api/[salon]/booking/verify/+server.ts';
import * as icsRoute from '../src/routes/api/[salon]/booking/[token]/ics/+server.ts';
import * as availRoute from '../src/routes/api/[salon]/availability/+server.ts';
import * as clientRoute from '../src/routes/api/[salon]/clients/[id]/+server.ts';
import * as calendarRoute from '../src/routes/api/[salon]/calendar/+server.ts';
import * as smsRoute from '../src/routes/api/[salon]/sms/+server.ts';
import * as shortLink from '../src/routes/w/[token]/+server.ts';
import { load as pageLoad } from '../src/routes/[salon]/+page.server.ts';
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
});
afterAll(async () => {
  await stopBoss();
  await sql.end();
});
beforeEach(async () => {
  await reset(sql);
  vi.unstubAllEnvs();
});

const P = (t: TestSalon) => ({ salon: t.salon.slug });
const actor = (t: TestSalon) => ({
  salonId: t.salon.id,
  staffId: t.managerId,
  role: 'manager' as const,
  name: 'K'
});

async function verified(t: TestSalon, phone: string, ip = '127.0.0.1'): Promise<string> {
  const log = smsLog();
  const c = await call(codeRoute, 'POST', '/api/[salon]/booking/code', { params: P(t), body: { phone }, ip });
  expect(c.status, JSON.stringify(c.json)).toBe(200);
  const v = await call(verifyRoute, 'POST', '/api/[salon]/booking/verify', {
    params: P(t),
    body: { phone, code: lastCode(log, phone) }
  });
  expect(v.status).toBe(200);
  return v.json.phoneToken;
}

const bookWith = (
  t: TestSalon,
  phone: string,
  phoneToken: string,
  start: string,
  staffId: string | null,
  svc = 'cut'
) =>
  call(bookingRoute, 'POST', '/api/[salon]/booking', {
    params: P(t),
    body: {
      serviceId: t.serviceIds[svc as 'cut' | 'color'],
      staffId,
      start,
      name: 'Anna Nowak',
      phone,
      phoneToken
    }
  });

async function slots(t: TestSalon, svc: 'cut' | 'color', staff: string, days = 1) {
  const a = await call(availRoute, 'GET', '/api/[salon]/availability', {
    params: P(t),
    search: { service: t.serviceIds[svc], staff, date: MON, days: String(days) }
  });
  expect(a.status).toBe(200);
  return a.json.slots as { start: string; time: string }[];
}

describe('S2.C4 only fitting times', () => {
  it('a 120-minute service never shows a start with less than 120 free minutes plus the buffer', async () => {
    const t = await makeSalon(sql, 'pasuje');
    const ewa = t.stylistIds[0];
    await sql`update staff_service set duration_min = null where staff_id = ${ewa}`; // colour = 120 min + 15
    const [c] = await sql<{ id: string }[]>`
      insert into client (salon_id, name, phone) values (${t.salon.id}, 'Ola', '+48700000001') returning id`;
    await createVisit(sql, t.salon, actor(t), {
      source: 'recepcja',
      clientId: c.id,
      serviceId: t.serviceIds.cut,
      staffId: ewa,
      start: at('13:00')
    }); // busy 13:00-14:10 (60 min + 10 min buffer)
    const got = await slots(t, 'color', ewa);
    expect(got.length).toBeGreaterThan(0);
    const busyFrom = Date.parse(at('13:00'));
    const busyTo = Date.parse(at('14:10'));
    const close = Date.parse(at('17:00'));
    for (const s of got) {
      const a = Date.parse(s.start);
      const end = a + 120 * 60_000;
      expect(a + 135 * 60_000 <= busyFrom || a >= busyTo, s.time).toBe(true);
      expect(end <= close, s.time).toBe(true);
    }
    const times = got.map((s) => s.time);
    expect(times).toContain('10:45'); // 10:45 + 120 + 15 = 13:00
    expect(times).not.toContain('11:00');
    expect(times).toContain('14:15'); // the grid step after 14:10
    expect(times).toContain('15:00'); // 15:00 + 120 = 17:00 (the buffer may pass closing time)
    expect(times).not.toContain('15:15');
  });
});

describe('a time taken while the client types', () => {
  it('gives 409 "Ten termin jest już zajęty" with the phoneToken; the next try needs no new code', async () => {
    const t = await makeSalon(sql, 'wyscig');
    const iza = t.stylistIds[1];
    const start = at('11:00', 1);
    const tokA = await verified(t, '700100301');
    const tokB = await verified(t, '700100302');
    expect((await bookWith(t, '700100301', tokA, start, iza)).status).toBe(200);
    const lost = await bookWith(t, '700100302', tokB, start, iza);
    expect(lost.status).toBe(409);
    expect(lost.json.error.message).toBe('Ten termin jest już zajęty. Wybierz inny.');
    expect(lost.json.error.phoneToken).toBe(tokB);
    // a fresh list no longer offers the taken time
    const fresh = await slots(t, 'cut', iza, 2);
    expect(fresh.map((s) => s.start)).not.toContain(start);
    // another time with the same verified phone, no code
    const sentBefore = (await sql`select 1 from notification where type = 'kod_klient'`).length;
    const ok = await bookWith(t, '700100302', lost.json.error.phoneToken, fresh[0].start, iza);
    expect(ok.status).toBe(200);
    expect((await sql`select 1 from notification where type = 'kod_klient'`).length).toBe(sentBefore);
  });

  it('a phoneToken of another salon or another phone is no proof', async () => {
    const t = await makeSalon(sql, 'salon-a');
    const u = await makeSalon(sql, 'salon-b', { phoneBase: 610000000 });
    const tok = await verified(t, '700100303');
    const other = await bookWith(u, '700100303', tok, at('11:00', 1), null);
    expect(other.status).toBe(400);
    expect(other.json.error.code).toBe('BAD_CODE');
    const phone = await bookWith(t, '700100304', tok, at('11:00', 1), null);
    expect(phone.status).toBe(400);
  });
});

describe('cancel cut-off', () => {
  it('the client cancels until 2 hours before the start, not later', async () => {
    const t = await makeSalon(sql, 'odwolaj');
    const tok = await verified(t, '700100305');
    const r = await bookWith(t, '700100305', tok, at('11:00', 1), null);
    const start = Temporal.Instant.from(at('11:00', 1));
    const late = () => start.subtract({ minutes: 119 });
    const early = () => start.subtract({ minutes: 121 });
    expect((await visitStatusByToken(sql, t.salon, r.json.token, late)).canCancel).toBe(false);
    expect((await visitStatusByToken(sql, t.salon, r.json.token, early)).canCancel).toBe(true);
    await expect(cancelByToken(sql, t.salon, r.json.token, late)).rejects.toThrow(
      'Na odwołanie jest już za późno'
    );
    const v = await cancelByToken(sql, t.salon, r.json.token, early);
    expect(v.status).toBe('odwolana');
    // the salon can set another cut-off
    await sql`update salon set cancel_cutoff_hours = 24 where id = ${t.salon.id}`;
    const s24 = { ...t.salon, cancel_cutoff_hours: 24 };
    const r2 = await bookWith(t, '700100305', tok, at('11:00', 1), null);
    expect((await visitStatusByToken(sql, s24, r2.json.token, early)).canCancel).toBe(false);
  });
});

describe('limits', () => {
  it('codes: 3 per phone in 10 minutes, 20 per IP in an hour', async () => {
    const t = await makeSalon(sql, 'limity');
    smsLog();
    const send = (phone: string, ip = '10.0.0.1') =>
      call(codeRoute, 'POST', '/api/[salon]/booking/code', { params: P(t), body: { phone }, ip });
    for (let i = 0; i < 3; i++) expect((await send('700100306')).status).toBe(200);
    expect((await send('700100306')).status).toBe(429);
    // the phone limit stops the 4th try before the IP count: 17 more phones reach 20, the next is refused
    for (let i = 0; i < 17; i++)
      expect((await send(`7001004${String(i).padStart(2, '0')}`)).status).toBe(200);
    const r = await send('700100499');
    expect(r.status).toBe(429);
    expect((await send('700100499', '10.0.0.2')).status).toBe(200);
  });

  it('bookings: 3 per phone per salon in 24 hours', async () => {
    const t = await makeSalon(sql, 'dzienny');
    const tok = await verified(t, '700100307');
    for (const time of ['09:00', '10:30', '12:00']) {
      expect((await bookWith(t, '700100307', tok, at(time, 1), null)).status).toBe(200);
    }
    const fourth = await bookWith(t, '700100307', tok, at('14:00', 1), null);
    expect(fourth.status).toBe(429);
    expect(fourth.json.error.message).toBe('Masz już 3 rezerwacje na dziś. Zadzwoń do salonu.');
  });

  it('monthly SMS package: a client code is refused, other SMS get status "limit" and are not sent', async () => {
    vi.stubEnv('SMS_MONTHLY_LIMIT', '3');
    const t = await makeSalon(sql, 'pakiet');
    const tok = await verified(t, '700100308'); // SMS 1 (the code)
    const r = await bookWith(t, '700100308', tok, at('11:00', 1), null);
    const data = { visitId: r.json.visit.id, salonId: t.salon.id };
    await sql`insert into notification (salon_id, type, to_phone, body, status, provider)
      values (${t.salon.id}, 'potwierdzenie', '+48700000000', 'x', 'logged', 'log'),
             (${t.salon.id}, 'potwierdzenie', '+48700000000', 'x', 'logged', 'log')`; // 3 of 3 used
    const log = smsLog();
    const code = await call(codeRoute, 'POST', '/api/[salon]/booking/code', {
      params: P(t),
      body: { phone: '700100309' }
    });
    expect(code.status).toBe(429);
    expect(code.json.error.message).toBe('Salon nie może teraz wysłać SMS-a. Zadzwoń do salonu.');
    const n = await handleConfirmation(sql, data);
    expect(n!.status).toBe('limit');
    expect(log.sent).toHaveLength(0);
    // the panel counter: 3 of 3 (rows over the limit were not sent, so they do not count)
    const token = await sessionFor(sql, t.salon.id, t.managerId);
    const c = await call(smsRoute, 'GET', '/api/[salon]/sms', { params: P(t), token });
    expect(c.json).toMatchObject({ count: 3, limit: 3 });
  });
});

describe('S2.C7 RODO erase', () => {
  it('removes name, phone and note; the visits stay with time and service', async () => {
    const t = await makeSalon(sql, 'rodo');
    const tok = await verified(t, '700100310');
    const r = await bookWith(t, '700100310', tok, at('11:00', 1), t.stylistIds[1]);
    await handleConfirmation(sql, { visitId: r.json.visit.id, salonId: t.salon.id });
    const [c] = await sql<{ id: string }[]>`select id from client where phone = '+48700100310'`;
    await sql`update client set note = 'Alergia na farbę' where id = ${c.id}`;
    const before = await visitById(sql, t.salon.id, r.json.visit.id);

    const token = await sessionFor(sql, t.salon.id, t.managerId);
    const stylist = await sessionFor(sql, t.salon.id, t.stylistIds[1]);
    const params = { ...P(t), id: c.id };
    expect(
      (await call(clientRoute, 'DELETE', '/api/[salon]/clients/[id]', { params, token: stylist })).status
    ).toBe(403);
    expect((await call(clientRoute, 'DELETE', '/api/[salon]/clients/[id]', { params, token })).status).toBe(
      200
    );

    const [after] = await sql`select name, phone, note, erased_at from client where id = ${c.id}`;
    expect(after).toMatchObject({ name: '', phone: null, note: '' });
    expect(after.erased_at).toBeInstanceOf(Date);
    const v = await visitById(sql, t.salon.id, r.json.visit.id);
    expect(v).toMatchObject({
      client_name: 'Usunięty klient',
      client_phone: null,
      service_id: before!.service_id,
      staff_id: before!.staff_id,
      status: 'potwierdzona'
    });
    expect(v!.starts_at.getTime()).toBe(before!.starts_at.getTime());
    const notes = await sql`select to_phone, body from notification where salon_id = ${t.salon.id}`;
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.to_phone === '' && n.body === '')).toBe(true);
    expect(await sql`select 1 from sms_code where phone = '+48700100310'`).toHaveLength(0);
    expect(await sql`select 1 from rate_limit where key like '%+48700100310'`).toHaveLength(0);
    // the panel shows "Usunięty klient"; a second delete is a 404
    const cal = await call(calendarRoute, 'GET', '/api/[salon]/calendar', {
      params: P(t),
      token,
      search: { date: Temporal.PlainDate.from(MON).add({ days: 1 }).toString() }
    });
    expect(cal.json.visits.find((x: { id: string }) => x.id === r.json.visit.id).clientName).toBe(
      'Usunięty klient'
    );
    expect((await call(clientRoute, 'DELETE', '/api/[salon]/clients/[id]', { params, token })).status).toBe(
      404
    );
  });
});

describe('RODO documents', () => {
  it('docs/umowa-powierzenia.md exists and names art. 28 RODO', () => {
    const f = join(import.meta.dirname, '..', 'docs', 'umowa-powierzenia.md');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('art. 28');
  });
});

describe('a pending salon', () => {
  it('offers no booking: the page has no services, the API refuses times and bookings', async () => {
    const t = await makeSalon(sql, 'czeka-b');
    await sql`update salon set status = 'pending' where id = ${t.salon.id}`;
    const page = (await pageLoad({ params: { salon: 'czeka-b' } } as never)) as {
      online: boolean;
      services: unknown[];
      staff: unknown[];
    };
    expect(page).toMatchObject({ online: false, services: [], staff: [] });
    const a = await call(availRoute, 'GET', '/api/[salon]/availability', {
      params: P(t),
      search: { service: t.serviceIds.cut, date: MON }
    });
    expect(a.status).toBe(403);
    const b = await bookWith(t, '700100311', 'x.y', at('11:00', 1), null);
    expect(b.status).toBe(403);
    const active = await makeSalon(sql, 'czynny', { phoneBase: 620000000 });
    const p2 = (await pageLoad({ params: { salon: active.salon.slug } } as never)) as {
      online: boolean;
      services: unknown[];
    };
    expect(p2.online).toBe(true);
    expect(p2.services).toHaveLength(2);
  });
});

describe('the short SMS link and the calendar file', () => {
  it('/w/<token> sends a 302 to the visit page; a changed token is a bare 404', async () => {
    const t = await makeSalon(sql, 'link');
    const tok = await verified(t, '700100312');
    const r = await bookWith(t, '700100312', tok, at('11:00', 1), null);
    let location = '';
    try {
      await shortLink.GET({ params: { token: r.json.token } } as never);
    } catch (e) {
      location = (e as { location: string; status: number }).location;
      expect((e as { status: number }).status).toBe(302);
    }
    expect(location).toBe(`/link/wizyta/${r.json.token}`);
    const bad = r.json.token.slice(0, -2) + (r.json.token.endsWith('AA') ? 'BB' : 'AA');
    const res = (await shortLink.GET({ params: { token: bad } } as never)) as Response;
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('Nie znaleziono wizyty.');
    expect(text).not.toContain('link');
  });

  it('the .ics has the visit in UTC', async () => {
    const t = await makeSalon(sql, 'ics');
    const tok = await verified(t, '700100313');
    const r = await bookWith(t, '700100313', tok, at('11:00', 1), null);
    const ics = await call(icsRoute, 'GET', '/api/[salon]/booking/[token]/ics', {
      params: { ...P(t), token: r.json.token }
    });
    expect(ics.status).toBe(200);
    const start = at('11:00', 1).replace(/[-:]/g, '').replace(/\.\d+/, '');
    expect(ics.json).toContain(`DTSTART:${start}`);
    expect(ics.json).toContain('SUMMARY:Strzyżenie damskie · Salon ics');
  });
});
