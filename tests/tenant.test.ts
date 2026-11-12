// S1.C4: a session of salon A cannot read or change a visit, client or stylist of salon B through any server
// entry point. The test walks every API route file and every exported method.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { visitToken } from '../src/lib/server/auth.ts';
import { resolveSalon } from '../src/lib/server/tenant.ts';
import { stopBoss } from '../src/lib/server/queue.ts';
import { createVisit } from '../src/lib/server/visits.ts';
import { at, call, makeSalon, reset, sessionFor, smsLog, testSql, type TestSalon } from './helpers.ts';

type Mod = Record<string, unknown>;
const routes = import.meta.glob<Mod>('../src/routes/api/\\[salon\\]/**/+server.ts', { eager: true });
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function routeId(file: string): string {
  return file.replace('../src/routes', '').replace('/+server.ts', '') || '/';
}

/** Routes that serve the public booking page (no session needed by design). */
const PUBLIC = new Set([
  'GET /api/[salon]',
  'GET /api/[salon]/availability',
  'POST /api/[salon]/booking/code',
  'POST /api/[salon]/booking',
  'GET /api/[salon]/booking/[token]',
  'POST /api/[salon]/booking/[token]/cancel',
  'POST /api/[salon]/booking/verify',
  'GET /api/[salon]/booking/[token]/ics',
  'POST /api/[salon]/auth/login',
  'POST /api/[salon]/auth/code',
  'POST /api/[salon]/auth/verify',
  'POST /api/[salon]/auth/logout'
]);

let sql: Sql;
let A: TestSalon;
let B: TestSalon;
let tokenA: string;
let ids: { visit: string; client: string; block: string };

async function snapshotB() {
  return sql`
    select (select json_agg(v order by v.id) from visit v where salon_id = ${B.salon.id}) as visits,
           (select json_agg(c order by c.id) from client c where salon_id = ${B.salon.id}) as clients,
           (select json_agg(json_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'role', s.role,
                    'active', s.active, 'password_hash', s.password_hash) order by s.id)
              from staff s where salon_id = ${B.salon.id}) as staff,
           (select json_agg(b order by b.id) from block b where salon_id = ${B.salon.id}) as blocks,
           (select json_agg(x order by x.service_id, x.staff_id) from staff_service x where salon_id = ${B.salon.id}) as links,
           (select json_agg(x order by x.id) from schedule x where salon_id = ${B.salon.id}) as schedules,
           (select json_agg(x order by x.id) from service x where salon_id = ${B.salon.id}) as services`;
}

beforeAll(async () => {
  sql = testSql();
  await reset(sql);
  smsLog();
  A = await makeSalon(sql, 'salon-a', { phoneBase: 600000000 });
  B = await makeSalon(sql, 'salon-b', { phoneBase: 610000000 });
  tokenA = await sessionFor(sql, A.salon.id, A.managerId);
  const [c] = await sql<{ id: string }[]>`
    insert into client (salon_id, name, phone) values (${B.salon.id}, 'Klientka B', '+48710000001') returning id`;
  const actorB = { salonId: B.salon.id, staffId: B.managerId, role: 'manager' as const, name: 'B' };
  const v = await createVisit(sql, B.salon, actorB, {
    source: 'recepcja',
    clientId: c.id,
    serviceId: B.serviceIds.cut,
    staffId: B.stylistIds[0],
    start: at('10:00')
  });
  const [b] = await sql<{ id: string }[]>`
    insert into block (salon_id, staff_id, starts_at, ends_at, reason)
    values (${B.salon.id}, ${B.stylistIds[0]}, ${at('13:00')}::timestamptz, ${at('14:00')}::timestamptz, 'B') returning id`;
  ids = { visit: v.id, client: c.id, block: b.id };
});

afterAll(async () => {
  await stopBoss();
  await sql.end();
});

/** A body that would be valid if it were allowed: every id points at salon B. */
function bodyFor(id: string, method: string): unknown {
  if (method === 'GET' || method === 'DELETE') return undefined;
  if (id.endsWith('/staff/[id]/services')) return [{ serviceId: B.serviceIds.color }];
  if (id.endsWith('/staff/[id]/schedule')) return [{ weekday: 1, starts: '06:00', ends: '07:00' }];
  if (id.endsWith('/visits'))
    return {
      serviceId: B.serviceIds.cut,
      staffId: B.stylistIds[0],
      start: at('15:00'),
      clientId: ids.client
    };
  if (id.endsWith('/visits/[id]')) return { action: 'cancel' };
  if (id.endsWith('/blocks')) return { staffId: B.stylistIds[0], start: at('15:00'), end: at('16:00') };
  if (id.endsWith('/staff')) return { name: 'Intruz', phone: '799000000' };
  if (id.endsWith('/staff/[id]')) return { name: 'Zmieniona', password: 'nowe-haslo-123' };
  if (id.endsWith('/services')) return { name: 'Usługa', durationMin: 30 };
  if (id.endsWith('/services/[id]')) return { name: 'Zmieniona', durationMin: 5 };
  if (id.endsWith('/clients')) return { name: 'Nowa', phone: '799000001' };
  if (id.endsWith('/clients/[id]')) return { name: 'Zmieniona' };
  if (id.endsWith('/settings')) return { name: 'Przejęty salon', confirmationMode: 'manual' };
  if (id.endsWith('/hours')) return [{ weekday: 7, opens: '06:00', closes: '07:00' }];
  return {};
}

/** The [id] of a route, pointing at a row of salon B. */
function idFor(id: string): string {
  if (id.includes('/visits/')) return ids.visit;
  if (id.includes('/clients/')) return ids.client;
  if (id.includes('/blocks/')) return ids.block;
  if (id.includes('/staff/')) return B.stylistIds[0];
  if (id.includes('/services/')) return B.serviceIds.cut;
  return '';
}

describe('S1.C4 tenant isolation', () => {
  const entries = Object.entries(routes).flatMap(([file, mod]) =>
    METHODS.filter((m) => typeof mod[m] === 'function').map((m) => ({
      file,
      mod,
      method: m,
      id: routeId(file)
    }))
  );

  it('finds the API routes', () => {
    expect(entries.length).toBeGreaterThan(25);
  });

  it("A's session inside salon B's API is no session: staff routes answer 401, public routes act as for a guest", async () => {
    const before = await snapshotB();
    for (const e of entries) {
      const params = { salon: B.salon.slug, id: idFor(e.id), token: visitToken(ids.visit) };
      const key = `${e.method} ${e.id}`;
      // logout ends the caller's own session; it is not a way into salon B
      if (key === 'POST /api/[salon]/auth/logout') continue;
      // the signed SMS link is the client's own key to her visit (tested in booking.test.ts), not A's session
      if (key === 'POST /api/[salon]/booking/[token]/cancel') continue;
      const withA = await call(e.mod, e.method, e.id, {
        params,
        token: tokenA,
        body: bodyFor(e.id, e.method)
      });
      if (PUBLIC.has(key)) {
        const guest = await call(e.mod, e.method, e.id, { params, body: bodyFor(e.id, e.method) });
        expect(withA.status, key).toBe(guest.status);
        // codes are random; the calendar file has a DTSTAMP of "now"
        const varies = [
          'POST /api/[salon]/booking/code',
          'POST /api/[salon]/auth/code',
          'GET /api/[salon]/booking/[token]/ics'
        ];
        if (!varies.includes(key)) {
          expect(withA.json, key).toEqual(guest.json);
        }
      } else {
        expect(withA.status, key).toBe(401);
      }
    }
    await sql`delete from rate_limit`;
    expect(await snapshotB()).toEqual(before);
  });

  it("inside salon A's API, every id of salon B is not found and nothing of B changes", async () => {
    const before = await snapshotB();
    const results: string[] = [];
    for (const e of entries) {
      const key = `${e.method} ${e.id}`;
      if (key === 'POST /api/[salon]/auth/logout') continue;
      const params = { salon: A.salon.slug, id: idFor(e.id), token: visitToken(ids.visit) };
      const r = await call(e.mod, e.method, e.id, { params, token: tokenA, body: bodyFor(e.id, e.method) });
      results.push(`${key} ${r.status}`);
      if (e.id.includes('[id]') || e.id.includes('[token]')) {
        expect([403, 404], key).toContain(r.status);
      }
      // No answer of salon A's API may contain an id or a name of salon B.
      const text = JSON.stringify(r.json ?? {});
      for (const secret of [
        ids.visit,
        ids.client,
        ids.block,
        B.salon.id,
        ...B.stylistIds,
        B.managerId,
        'Klientka B'
      ]) {
        expect(text.includes(secret), `${key} leaks ${secret}`).toBe(false);
      }
    }
    // Creating with ids of salon B fails too (client, stylist, service of B).
    const created = results.filter((x) => /^POST \/api\/\[salon\]\/(visits|blocks) /.test(x));
    expect(
      created.every((x) => x.endsWith(' 404')),
      created.join(', ')
    ).toBe(true);
    await sql`delete from rate_limit`;
    expect(await snapshotB()).toEqual(before);
  });

  it('the services refuse a cross-salon foreign key even without the app (composite FK)', async () => {
    await expect(
      sql`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until, status, source)
        values (${A.salon.id}, ${ids.client}, ${A.stylistIds[0]}, ${A.serviceIds.cut}, now(), now() + interval '1 hour',
                now() + interval '1 hour', 'potwierdzona', 'recepcja')`
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('the tenant resolver maps a path, and later a Host name, to one salon', async () => {
    expect((await resolveSalon(sql, { path: '/salon-a/panel' }))!.id).toBe(A.salon.id);
    expect((await resolveSalon(sql, { path: '/api/salon-b/visits' }))!.id).toBe(B.salon.id);
    expect(await resolveSalon(sql, { path: '/api/visits' })).toBeNull();
    expect(await resolveSalon(sql, { path: '/nie-ma-takiego' })).toBeNull();
    await sql`update salon set host = 'zapisy.salon-b.pl' where id = ${B.salon.id}`;
    expect(
      (await resolveSalon(sql, { path: '/', host: 'zapisy.salon-b.pl' }, ['beauty.vote2build.com']))!.id
    ).toBe(B.salon.id);
    expect(
      (await resolveSalon(sql, { path: '/salon-a', host: 'beauty.vote2build.com' }, [
        'beauty.vote2build.com'
      ]))!.id
    ).toBe(A.salon.id);
    await sql`update salon set host = null where id = ${B.salon.id}`;
  });
});
