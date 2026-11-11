// Salon sign-up rules (invite code, SINGLE_SALON), the health page, and the pg-boss worker end to end.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { startWorkers } from '../src/lib/server/jobs.ts';
import { stopBoss } from '../src/lib/server/queue.ts';
import { createVisit } from '../src/lib/server/visits.ts';
import * as signupRoute from '../src/routes/api/signup/+server.ts';
import * as codeRoute from '../src/routes/api/signup/code/+server.ts';
import * as verifyRoute from '../src/routes/api/signup/verify/+server.ts';
import { signupToken } from '../src/lib/server/auth.ts';
import * as healthRoute from '../src/routes/health/+server.ts';
import { at, call, lastCode, makeSalon, reset, smsLog, testSql } from './helpers.ts';

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

const PHONE = '+48600111222';
const wizard = (
  slug: string,
  code = 'test-invite',
  phoneToken = signupToken(PHONE, Date.now() + 60_000)
) => ({
  code,
  phoneToken,
  name: 'Studio Fryzur Ania',
  slug,
  password: 'bezpieczne-haslo',
  city: 'Legnica',
  street: 'Rynek 1',
  teamSize: '2–3',
  link: '@studio.ania',
  about: 'Fryzjer damski.',
  team: [{ name: 'Ania' }, { name: 'Kasia' }],
  services: [
    { name: 'Strzyżenie damskie', durationMin: 60 },
    { name: 'Modelowanie', durationMin: 45 }
  ],
  openingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '17:00' }))
});

describe('sign-up', () => {
  it('needs the invite code when SIGNUP_CODE is set, and logs the owner in', async () => {
    const bad = await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ania', 'zly-kod') });
    expect(bad.status).toBe(403);
    const ok = await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ania') });
    expect(ok.status).toBe(201);
    expect(ok.json.salon.slug).toBe('studio-ania');
    expect(ok.cookies.get('beauty_session')?.value).toBeTruthy();
    const taken = await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ania') });
    expect(taken.status).toBe(409);
    // the owner is a calendar column too: she and Kasia do both services and work the opening hours
    const staff = await sql<{ name: string; role: string; phone: string | null; n: number; d: number }[]>`
      select st.name, st.role, st.phone,
        (select count(*)::int from staff_service ss where ss.staff_id = st.id) as n,
        (select count(*)::int from schedule sc where sc.staff_id = st.id) as d
      from staff st join salon s on s.id = st.salon_id where s.slug = 'studio-ania' order by st.sort`;
    expect(staff).toEqual([
      { name: 'Ania', role: 'manager', phone: PHONE, n: 2, d: 5 },
      { name: 'Kasia', role: 'stylist', phone: null, n: 2, d: 5 }
    ]);
    const [salon] = await sql`select confirmation_mode, show_prices from salon where slug = 'studio-ania'`;
    expect(salon).toEqual({ confirmation_mode: 'auto', show_prices: false });
  });

  it('needs a valid phone token', async () => {
    const r = await call(signupRoute, 'POST', '/api/signup', {
      body: wizard('studio-ania', 'test-invite', 'x.y.zzzzzzzz')
    });
    expect(r.status).toBe(400);
    const old = signupToken(PHONE, Date.now() - 1000);
    expect(
      (await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ania', 'test-invite', old) }))
        .status
    ).toBe(400);
  });

  it('code -> verify -> token; a wrong code counts as an attempt', async () => {
    const log = smsLog();
    vi.stubEnv('SMS_ECHO', 'on');
    const sent = await call(codeRoute, 'POST', '/api/signup/code', { body: { phone: '600 111 222' } });
    expect(sent.status).toBe(200);
    expect(sent.json.code).toBe(lastCode(log, PHONE));
    const wrong = await call(verifyRoute, 'POST', '/api/signup/verify', {
      body: { phone: PHONE, code: '000000' === sent.json.code ? '111111' : '000000' }
    });
    expect(wrong.status).toBe(400);
    const ok = await call(verifyRoute, 'POST', '/api/signup/verify', {
      body: { phone: PHONE, code: sent.json.code }
    });
    expect(ok.status).toBe(200);
    const made = await call(signupRoute, 'POST', '/api/signup', {
      body: wizard('studio-ania', 'test-invite', ok.json.phoneToken)
    });
    expect(made.status).toBe(201);
    vi.stubEnv('SMS_ECHO', 'off');
    const quiet = await call(codeRoute, 'POST', '/api/signup/code', { body: { phone: '600 111 333' } });
    expect(quiet.json.code).toBeUndefined();
  });

  it('refuses reserved addresses and suggests a free one', async () => {
    for (const slug of ['api', 'panel', 'health', 'zaloz']) {
      const r = await call(signupRoute, 'POST', '/api/signup', { body: wizard(slug) });
      expect(r.status, slug).toBe(400);
    }
    expect(
      (await call(signupRoute, 'GET', '/api/signup', { search: { name: 'Studio Óla' } })).json.slug
    ).toBe('studio-ola');
    await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ola') });
    expect(
      (await call(signupRoute, 'GET', '/api/signup', { search: { name: 'Studio Ola' } })).json.slug
    ).toBe('studio-ola-2');
    expect(
      (await call(signupRoute, 'GET', '/api/signup', { search: { name: 'Łąka Źdźbło' } })).json.slug
    ).toBe('laka-zdzblo');
  });

  it('is open with no invite code when SIGNUP_CODE is empty', async () => {
    vi.stubEnv('SIGNUP_CODE', '');
    expect((await call(signupRoute, 'GET', '/api/signup')).json).toMatchObject({
      open: true,
      needsCode: false
    });
    expect((await call(signupRoute, 'POST', '/api/signup', { body: wizard('studio-ania', '') })).status).toBe(
      201
    );
  });

  it('SINGLE_SALON=on: the first salon needs no code, then sign-up closes', async () => {
    vi.stubEnv('SINGLE_SALON', 'on');
    expect((await call(signupRoute, 'GET', '/api/signup')).json).toMatchObject({
      open: true,
      needsCode: false
    });
    expect((await call(signupRoute, 'POST', '/api/signup', { body: wizard('moj-salon', '') })).status).toBe(
      201
    );
    expect((await call(signupRoute, 'GET', '/api/signup')).json.open).toBe(false);
    expect((await call(signupRoute, 'POST', '/api/signup', { body: wizard('drugi-salon', '') })).status).toBe(
      403
    );
    expect(
      (await call(codeRoute, 'POST', '/api/signup/code', { body: { phone: '600 111 444' } })).status
    ).toBe(403);
  });
});

describe('health and jobs', () => {
  it('/health answers with the database state', async () => {
    const r = await call(healthRoute, 'GET', '/health');
    expect(r).toMatchObject({ status: 200, json: { ok: true, db: true } });
  });

  it('a started worker picks up the confirmation job and writes the notification row', async () => {
    const t = await makeSalon(sql, 'salon-j');
    smsLog();
    await startWorkers(sql);
    const [c] = await sql<{ id: string }[]>`
      insert into client (salon_id, name, phone) values (${t.salon.id}, 'Ola', '+48700000009') returning id`;
    // an online visit in auto mode queues a confirmation SMS
    const v = await createVisit(sql, t.salon, null, {
      source: 'online',
      clientId: c.id,
      serviceId: t.serviceIds.cut,
      staffId: t.stylistIds[1],
      start: at('09:00', 3)
    });
    let rows: { type: string }[] = [];
    for (let i = 0; i < 60 && rows.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
      rows = await sql`select type from notification where visit_id = ${v.id}`;
    }
    expect(rows.map((r) => r.type)).toEqual(['potwierdzenie']);
  });
});
