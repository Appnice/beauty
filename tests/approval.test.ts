// Salon approval: anti-spam rules of the sign-up, the admin notice, accept / reject, the purge of rejected
// salons with a moved clock, the admin 404 and its rate limit, and no client SMS from a pending salon.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { signupToken } from '../src/lib/server/auth.ts';
import { accept, purgeRejected, reject, useNotifyFetch } from '../src/lib/server/approval.ts';
import { handleConfirmation, handleReminder } from '../src/lib/server/jobs.ts';
import { validLink } from '../src/lib/server/salons.ts';
import * as signupRoute from '../src/routes/api/signup/+server.ts';
import * as codeRoute from '../src/routes/api/signup/code/+server.ts';
import * as stateRoute from '../src/routes/api/signup/+server.ts';
import * as adminLoginRoute from '../src/routes/api/admin/login/+server.ts';
import * as adminSalonsRoute from '../src/routes/api/admin/salons/+server.ts';
import * as adminDecideRoute from '../src/routes/api/admin/salons/[id]/+server.ts';
import * as loginRoute from '../src/routes/api/[salon]/auth/login/+server.ts';
import * as catalogRoute from '../src/routes/api/[salon]/+server.ts';
import * as bookingCodeRoute from '../src/routes/api/[salon]/booking/code/+server.ts';
import { at, call, makeSalon, reset, smsLog, testSql } from './helpers.ts';

let sql: Sql;
let posts: { url: string; body: string }[] = [];
beforeAll(async () => {
  sql = testSql();
});
afterAll(async () => {
  useNotifyFetch(null);
  await sql.end();
});
beforeEach(async () => {
  await reset(sql);
  await sql`truncate admin_audit, admin_session`;
  vi.unstubAllEnvs();
  posts = [];
  useNotifyFetch(async (url, init) => {
    posts.push({ url, body: init.body });
    return { ok: true, status: 200 };
  });
});

let n = 0;
function wizard(phone = `+4860020${String(1000 + n++).slice(-4)}`, extra: Record<string, unknown> = {}) {
  const slug = `salon-${n}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    code: 'test-invite',
    phoneToken: signupToken(phone, Date.now() + 60_000),
    name: `Salon ${slug}`,
    slug,
    password: 'bezpieczne-haslo',
    city: 'Legnica',
    street: 'Chojnowska 12',
    teamSize: '2–3',
    link: 'instagram.com/studio.ola',
    about: 'Fryzjer damski i męski.',
    team: [{ name: 'Ola' }, { name: 'Kasia' }],
    services: [{ name: 'Strzyżenie damskie', durationMin: 60 }],
    openingHours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens: '09:00', closes: '18:00' })),
    ...extra
  };
}
const signup = (b: unknown) => call(signupRoute, 'POST', '/api/signup', { body: b });

describe('sign-up with approval', () => {
  it('creates a pending salon with the "O salonie" data and tells the admin', async () => {
    vi.stubEnv('ADMIN_PHONE', '+48500100200');
    vi.stubEnv('ADMIN_NOTIFY_URL', 'http://127.0.0.1:8159/topic');
    const r = await signup(wizard('+48600300400'));
    expect(r.status).toBe(201);
    expect(r.json.salon.status).toBe('pending');
    const [s] = await sql`select status, city, street, team_size, link, about, signup_ip from salon
      where slug = ${r.json.salon.slug}`;
    expect(s).toEqual({
      status: 'pending',
      city: 'Legnica',
      street: 'Chojnowska 12',
      team_size: '2–3',
      link: 'instagram.com/studio.ola',
      about: 'Fryzjer damski i męski.',
      signup_ip: '127.0.0.1'
    });
    const sms = await sql`select to_phone, type from notification where type = 'admin_nowy_salon'`;
    expect(sms).toEqual([{ to_phone: '+48500100200', type: 'admin_nowy_salon' }]);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('http://127.0.0.1:8159/topic');
    expect(posts[0].body).toContain('Nowy salon:');
  });

  it('needs city, people and description; the link must be an address or an @handle', async () => {
    expect((await signup(wizard(undefined, { city: ' ' }))).status).toBe(400);
    expect((await signup(wizard(undefined, { teamSize: '3' }))).status).toBe(400);
    expect((await signup(wizard(undefined, { about: '' }))).status).toBe(400);
    expect((await signup(wizard(undefined, { link: 'to nie link' }))).status).toBe(400);
    expect((await signup(wizard(undefined, { link: '' }))).status).toBe(201);
    expect(validLink('@studio.ola')).toBe(true);
    expect(validLink('https://facebook.com/barberrynek')).toBe(true);
    expect(validLink('nailsbykasia.pl')).toBe(true);
    expect(validLink('@')).toBe(false);
    expect(validLink('javascript:alert(1)')).toBe(false);
  });

  it('refuses a second salon with the same phone, also at the code step', async () => {
    expect((await signup(wizard('+48600555666'))).status).toBe(201);
    const again = await signup(wizard('+48600555666'));
    expect(again.status).toBe(409);
    expect(again.json.error.message).toBe('Ten numer ma już salon. Zaloguj się.');
    const code = await call(codeRoute, 'POST', '/api/signup/code', { body: { phone: '600 555 666' } });
    expect(code.status).toBe(409);
  });

  it('refuses the 4th sign-up from one IP in a day', async () => {
    for (let i = 0; i < 3; i++) expect((await signup(wizard())).status).toBe(201);
    const fourth = await signup(wizard());
    expect(fourth.status).toBe(429);
    expect(fourth.json.error.message).toBe('Dużo zgłoszeń. Spróbuj jutro.');
  });

  it('with 30 pending salons the wizard says "Dużo zgłoszeń. Spróbuj jutro."', async () => {
    for (let i = 0; i < 30; i++) {
      await sql`insert into salon (slug, name, phone, status, signup_ip, submitted_at)
        values (${'p' + i}, ${'P' + i}, ${'+4870000' + String(1000 + i)}, 'pending', ${'10.0.0.' + i}, now())`;
    }
    const st = await call(stateRoute, 'GET', '/api/signup');
    expect(st.json.full).toBe(true);
    const code = await call(codeRoute, 'POST', '/api/signup/code', { body: { phone: '600 999 111' } });
    expect(code.status).toBe(429);
    expect(code.json.error.message).toBe('Dużo zgłoszeń. Spróbuj jutro.');
    const r = await signup(wizard());
    expect(r.json.error.message).toBe('Dużo zgłoszeń. Spróbuj jutro.');
  });

  it('a filled honeypot looks like a success and stores nothing', async () => {
    const before = await sql`select count(*)::int as n from salon`;
    const r = await signup(wizard(undefined, { website: 'http://spam.example' }));
    expect(r.status).toBe(201);
    expect(r.cookies.get('beauty_session')).toBeUndefined();
    const after = await sql`select count(*)::int as n from salon`;
    expect(after[0].n).toBe(before[0].n);
    expect(posts).toHaveLength(0);
  });

  it('SINGLE_SALON=on creates the only salon as active, with no admin notice', async () => {
    vi.stubEnv('SINGLE_SALON', 'on');
    vi.stubEnv('ADMIN_PHONE', '+48500100200');
    const r = await signup(wizard());
    expect(r.json.salon.status).toBe('active');
    expect(await sql`select 1 from notification where type = 'admin_nowy_salon'`).toHaveLength(0);
  });
});

describe('a pending salon', () => {
  it('has no public catalog, no online booking and sends no client SMS', async () => {
    const t = await makeSalon(sql, 'czeka');
    await sql`update salon set status = 'pending' where id = ${t.salon.id}`;
    const cat = await call(catalogRoute, 'GET', '/api/[salon]', { params: { salon: 'czeka' } });
    expect(cat.status).toBe(200);
    expect(cat.json).toEqual({ salon: { slug: 'czeka', name: 'Salon czeka', status: 'pending' } });
    const code = await call(bookingCodeRoute, 'POST', '/api/[salon]/booking/code', {
      params: { salon: 'czeka' },
      body: { phone: '700 100 200' }
    });
    expect(code.status).toBe(403);
    expect(code.json.error.message).toBe('Zapisy online wkrótce.');
    // a reception visit with a client phone: the jobs send nothing while the salon waits
    const [c] = await sql`insert into client (salon_id, name, phone)
      values (${t.salon.id}, 'Ola', '+48700000009') returning id`;
    const [v] = await sql`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at,
        blocked_until, status, source)
      values (${t.salon.id}, ${c.id}, ${t.stylistIds[0]}, ${t.serviceIds.cut}, ${at('10:00')}::timestamptz,
        ${at('11:00')}::timestamptz, ${at('11:10')}::timestamptz, 'potwierdzona', 'recepcja') returning id`;
    const log = smsLog();
    expect(await handleConfirmation(sql, { visitId: v.id, salonId: t.salon.id })).toBeNull();
    expect(await handleReminder(sql, { visitId: v.id, salonId: t.salon.id })).toBeNull();
    expect(log.sent).toHaveLength(0);
    // after "Akceptuj" the same job sends
    await sql`update salon set status = 'active' where id = ${t.salon.id}`;
    expect(await handleReminder(sql, { visitId: v.id, salonId: t.salon.id })).not.toBeNull();
  });
});

describe('platform admin', () => {
  it('/admin is a 404 without ADMIN_PASSWORD', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    const r = await call(adminLoginRoute, 'POST', '/api/admin/login', { body: { password: 'x' } });
    expect(r.status).toBe(404);
    expect((await call(adminSalonsRoute, 'GET', '/api/admin/salons')).status).toBe(404);
  });

  it('rate-limits wrong passwords per IP', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'admin-test-haslo');
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push(
        (await call(adminLoginRoute, 'POST', '/api/admin/login', { body: { password: 'zle' } })).status
      );
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
    const right = await call(adminLoginRoute, 'POST', '/api/admin/login', {
      body: { password: 'admin-test-haslo' }
    });
    expect(right.status).toBe(429);
  });

  it('accepts and rejects, writes the audit, and the rejected owner cannot log in', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'admin-test-haslo');
    const login = await call(adminLoginRoute, 'POST', '/api/admin/login', {
      body: { password: 'admin-test-haslo' }
    });
    expect(login.status).toBe(200);
    const admin = login.cookies.get('beauty_admin')!.value;
    const a = await signup(wizard('+48600700801'));
    const b = await signup(wizard('+48600700802'));
    const asAdmin = (id: string, body: unknown) =>
      call(adminDecideRoute, 'POST', '/api/admin/salons/[id]', {
        params: { id },
        body,
        cookies: { beauty_admin: admin }
      });
    const list = await call(adminSalonsRoute, 'GET', '/api/admin/salons', {
      search: { status: 'pending' },
      cookies: { beauty_admin: admin }
    });
    expect(list.status).toBe(200);
    expect(list.json.counts.pending).toBe(2);
    expect(list.json.salons[0]).toMatchObject({ city: 'Legnica', street: 'Chojnowska 12', team_size: '2–3' });
    const log = smsLog();
    expect((await asAdmin(a.json.salon.id, { action: 'accept' })).status).toBe(200);
    expect((await asAdmin(b.json.salon.id, { action: 'reject', reason: 'To nie salon.' })).status).toBe(200);
    expect(log.sent.map((m) => [m.to, m.body.split('.')[0]])).toEqual([
      ['+48600700801', 'Salon przyjety'],
      ['+48600700802', `Salon ${b.json.salon.name} nie zostal przyjety`]
    ]);
    const audit = await sql`select action, reason from admin_audit order by created_at`;
    expect(audit).toEqual([
      { action: 'accept', reason: '' },
      { action: 'reject', reason: 'To nie salon.' }
    ]);
    const refused = await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
      params: { salon: b.json.salon.slug },
      body: { phone: '600700802', password: 'bezpieczne-haslo' }
    });
    expect(refused.status).toBe(403);
    expect(refused.json.error.message).toBe('Ten salon nie został przyjęty.');
    const ok = await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
      params: { salon: a.json.salon.slug },
      body: { phone: '600700801', password: 'bezpieczne-haslo' }
    });
    expect(ok.status).toBe(200);
  });

  it('the purge deletes a rejected salon 30 days after the decision (moved clock)', async () => {
    const r = await signup(wizard('+48600700900'));
    const id = r.json.salon.id;
    const decided = Temporal.Instant.from('2026-01-10T10:00:00Z');
    await reject(sql, id, '', null, () => decided);
    expect(await purgeRejected(sql, decided.add({ hours: 24 * 29 }))).toEqual([]);
    expect(await sql`select 1 from salon where id = ${id}`).toHaveLength(1);
    expect(await purgeRejected(sql, decided.add({ hours: 24 * 30 }))).toEqual([r.json.salon.slug]);
    expect(await sql`select 1 from salon where id = ${id}`).toHaveLength(0);
    expect(await sql`select 1 from staff where salon_id = ${id}`).toHaveLength(0);
    const audit = await sql`select action, salon_slug from admin_audit order by created_at`;
    expect(audit).toEqual([
      { action: 'reject', salon_slug: r.json.salon.slug },
      { action: 'purge', salon_slug: r.json.salon.slug }
    ]);
    // an accepted salon is never purged
    const k = await signup(wizard('+48600700901'));
    await accept(sql, k.json.salon.id, null, () => decided);
    expect(await purgeRejected(sql, decided.add({ hours: 24 * 400 }))).toEqual([]);
  });
});
