// S1.C7: the demo salon, and S1 demo prune: data older than 48 h is removed and seeded again.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { DEMO_SLUG, pruneDemo, seedDemo } from '../src/lib/server/seed.ts';
import { stopBoss } from '../src/lib/server/queue.ts';
import { localDate, weekStart, zonedInstant } from '../src/lib/server/time.ts';
import { freeSlots } from '../src/lib/server/visits.ts';
import { loginWithPassword } from '../src/lib/server/auth.ts';
import { reset, testSql } from './helpers.ts';

let sql: Sql;
beforeAll(async () => {
  sql = testSql();
  await reset(sql);
});
afterAll(async () => {
  await stopBoss();
  await sql.end();
});

describe('demo seed', () => {
  it('creates Salon Demo with 4 stylists, 10 services and visits in the current and the next week', async () => {
    const r = await seedDemo(sql);
    expect(r.salon).toMatchObject({
      slug: DEMO_SLUG,
      name: 'Salon Demo',
      is_demo: true,
      timezone: 'Europe/Warsaw'
    });
    const [c] = await sql<{ stylists: number; managers: number; services: number }[]>`
      select (select count(*)::int from staff where salon_id = ${r.salon.id} and role = 'stylist') as stylists,
             (select count(*)::int from staff where salon_id = ${r.salon.id} and role = 'manager') as managers,
             (select count(*)::int from service where salon_id = ${r.salon.id}) as services`;
    expect(c).toEqual({ stylists: 4, managers: 1, services: 10 });
    const monday = weekStart(localDate(Temporal.Now.instant(), 'Europe/Warsaw'));
    const w = (d: number) => zonedInstant(monday.add({ days: d }), '00:00', 'Europe/Warsaw').toString();
    const [v] = await sql<{ this_week: number; next_week: number; statuses: string[] }[]>`
      select count(*) filter (where starts_at >= ${w(0)}::timestamptz and starts_at < ${w(7)}::timestamptz)::int as this_week,
             count(*) filter (where starts_at >= ${w(7)}::timestamptz and starts_at < ${w(14)}::timestamptz)::int as next_week,
             array_agg(distinct status) as statuses
      from visit where salon_id = ${r.salon.id}`;
    expect(v.this_week).toBeGreaterThan(40);
    expect(v.next_week).toBeGreaterThan(40);
    expect(v.statuses).toContain('potwierdzona');
    const names = await sql<
      { name: string }[]
    >`select name from service where salon_id = ${r.salon.id} order by sort`;
    expect(names.map((n) => n.name)).toContain('Manicure hybrydowy');
    expect(names.map((n) => n.name)).toContain('Strzyżenie damskie');
    // the manager can log in with the demo password, and there is still free time to book
    await expect(loginWithPassword(sql, r.salon, '500 000 001', 'demo1234')).resolves.toBeTruthy();
    const [svc] = await sql<
      { id: string }[]
    >`select id from service where salon_id = ${r.salon.id} and name = 'Strzyżenie męskie'`;
    const free = await freeSlots(sql, r.salon, { serviceId: svc.id, from: monday.add({ days: 7 }), days: 7 });
    expect(free.length).toBeGreaterThan(0);
  });

  it('prunes and re-seeds only when the demo data is older than 48 h', async () => {
    const [before] = await sql<{ id: string }[]>`select id from salon where slug = ${DEMO_SLUG}`;
    const in1h = () => Temporal.Now.instant().add({ hours: 1 });
    const in49h = () => Temporal.Now.instant().add({ hours: 49 });
    expect(await pruneDemo(sql, in1h)).toBe(false);
    expect(await pruneDemo(sql, in49h)).toBe(true);
    const [after] = await sql<{ id: string }[]>`select id from salon where slug = ${DEMO_SLUG}`;
    expect(after.id).not.toBe(before.id);
  });

  it('never touches a real salon that uses the slug', async () => {
    await sql`delete from salon where slug = ${DEMO_SLUG}`;
    await sql`insert into salon (slug, name) values (${DEMO_SLUG}, 'Prawdziwy salon')`;
    expect(await pruneDemo(sql, () => Temporal.Now.instant().add({ hours: 100 }), true)).toBe(false);
    await expect(seedDemo(sql)).rejects.toThrow();
    const [s] = await sql<{ name: string }[]>`select name from salon where slug = ${DEMO_SLUG}`;
    expect(s.name).toBe('Prawdziwy salon');
  });
});
