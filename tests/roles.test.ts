// S1.C5 role rules through the routes, and the login flows (password, SMS code, sessions, rate limits).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { actorFromToken, SESSION_COOKIE } from '../src/lib/server/auth.ts';
import { stopBoss } from '../src/lib/server/queue.ts';
import { createVisit } from '../src/lib/server/visits.ts';
import * as blocksRoute from '../src/routes/api/[salon]/blocks/+server.ts';
import * as blockRoute from '../src/routes/api/[salon]/blocks/[id]/+server.ts';
import * as visitsRoute from '../src/routes/api/[salon]/visits/+server.ts';
import * as visitRoute from '../src/routes/api/[salon]/visits/[id]/+server.ts';
import * as scheduleRoute from '../src/routes/api/[salon]/schedule/+server.ts';
import * as staffScheduleRoute from '../src/routes/api/[salon]/staff/[id]/schedule/+server.ts';
import * as staffRoute from '../src/routes/api/[salon]/staff/+server.ts';
import * as clientsRoute from '../src/routes/api/[salon]/clients/+server.ts';
import * as settingsRoute from '../src/routes/api/[salon]/settings/+server.ts';
import * as servicesRoute from '../src/routes/api/[salon]/services/+server.ts';
import * as pendingRoute from '../src/routes/api/[salon]/pending/+server.ts';
import * as smsRoute from '../src/routes/api/[salon]/sms/+server.ts';
import * as loginRoute from '../src/routes/api/[salon]/auth/login/+server.ts';
import * as codeRoute from '../src/routes/api/[salon]/auth/code/+server.ts';
import * as verifyRoute from '../src/routes/api/[salon]/auth/verify/+server.ts';
import * as meRoute from '../src/routes/api/[salon]/auth/me/+server.ts';
import * as logoutRoute from '../src/routes/api/[salon]/auth/logout/+server.ts';
import {
  at,
  call,
  lastCode,
  makeSalon,
  reset,
  sessionFor,
  smsLog,
  testSql,
  type TestSalon
} from './helpers.ts';

let sql: Sql;
let t: TestSalon;
let ewa: string;
let iza: string;
let tokEwa: string;
let tokMgr: string;
let visitEwa: string;
let visitIza: string;

beforeAll(async () => {
  sql = testSql();
});
afterAll(async () => {
  await stopBoss();
  await sql.end();
});
beforeEach(async () => {
  await reset(sql);
  smsLog();
  t = await makeSalon(sql, 'salon-r');
  [ewa, iza] = t.stylistIds;
  tokEwa = await sessionFor(sql, t.salon.id, ewa);
  tokMgr = await sessionFor(sql, t.salon.id, t.managerId);
  const [c] = await sql<{ id: string }[]>`
    insert into client (salon_id, name, phone) values (${t.salon.id}, 'Klientka', '+48700000001') returning id`;
  const actor = { salonId: t.salon.id, staffId: t.managerId, role: 'manager' as const, name: 'K' };
  const base = { source: 'recepcja' as const, clientId: c.id, serviceId: t.serviceIds.cut };
  visitEwa = (await createVisit(sql, t.salon, actor, { ...base, staffId: ewa, start: at('10:00') })).id;
  visitIza = (await createVisit(sql, t.salon, actor, { ...base, staffId: iza, start: at('10:00') })).id;
});

const P = (extra: Record<string, string> = {}) => ({ salon: 'salon-r', ...extra });

describe('S1.C5 stylist', () => {
  it('reads only her own schedule', async () => {
    const own = await call(scheduleRoute, 'GET', '/api/[salon]/schedule', { params: P(), token: tokEwa });
    expect(own.status).toBe(200);
    expect(own.json.schedule.length).toBeGreaterThan(0);
    expect(own.json.schedule.every((s: { staffId: string }) => s.staffId === ewa)).toBe(true);
    const other = await call(scheduleRoute, 'GET', '/api/[salon]/schedule', {
      params: P(),
      token: tokEwa,
      search: { staff: iza }
    });
    expect(other.status).toBe(403);
  });

  it('reads only her own visits', async () => {
    const list = await call(visitsRoute, 'GET', '/api/[salon]/visits', {
      params: P(),
      token: tokEwa,
      search: { from: at('00:00'), to: at('23:59') }
    });
    expect(list.status).toBe(200);
    expect(list.json.visits.map((v: { id: string }) => v.id)).toEqual([visitEwa]);
    expect(
      (
        await call(visitRoute, 'GET', '/api/[salon]/visits/[id]', {
          params: P({ id: visitEwa }),
          token: tokEwa
        })
      ).status
    ).toBe(200);
    expect(
      (
        await call(visitRoute, 'GET', '/api/[salon]/visits/[id]', {
          params: P({ id: visitIza }),
          token: tokEwa
        })
      ).status
    ).toBe(403);
    const asked = await call(visitsRoute, 'GET', '/api/[salon]/visits', {
      params: P(),
      token: tokEwa,
      search: { staff: iza }
    });
    expect(asked.status).toBe(403);
  });

  it('creates and deletes only her own blocks', async () => {
    const own = await call(blocksRoute, 'POST', '/api/[salon]/blocks', {
      params: P(),
      token: tokEwa,
      body: { staffId: ewa, start: at('13:00'), end: at('14:00'), reason: 'Przerwa' }
    });
    expect(own.status).toBe(200);
    const other = await call(blocksRoute, 'POST', '/api/[salon]/blocks', {
      params: P(),
      token: tokEwa,
      body: { staffId: iza, start: at('13:00'), end: at('14:00') }
    });
    expect(other.status).toBe(403);
    const mgrBlock = await call(blocksRoute, 'POST', '/api/[salon]/blocks', {
      params: P(),
      token: tokMgr,
      body: { staffId: iza, start: at('15:00'), end: at('16:00'), reason: 'Urlop' }
    });
    expect(mgrBlock.status).toBe(200);
    const delOther = await call(blockRoute, 'DELETE', '/api/[salon]/blocks/[id]', {
      params: P({ id: mgrBlock.json.block.id }),
      token: tokEwa
    });
    expect(delOther.status).toBe(403);
    const delOwn = await call(blockRoute, 'DELETE', '/api/[salon]/blocks/[id]', {
      params: P({ id: own.json.block.id }),
      token: tokEwa
    });
    expect(delOwn.status).toBe(200);
    const list = await call(blocksRoute, 'GET', '/api/[salon]/blocks', {
      params: P(),
      token: tokEwa,
      search: { from: at('00:00'), to: at('23:59') }
    });
    expect(list.json.blocks).toEqual([]); // Iza's block is not visible to Ewa
  });

  it('cannot add, move or cancel visits, nor touch staff, clients, services or settings', async () => {
    const tries = [
      call(visitsRoute, 'POST', '/api/[salon]/visits', {
        params: P(),
        token: tokEwa,
        body: { serviceId: t.serviceIds.cut, staffId: ewa, start: at('15:00'), client: { name: 'Nowa' } }
      }),
      call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
        params: P({ id: visitEwa }),
        token: tokEwa,
        body: { action: 'cancel' }
      }),
      call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
        params: P({ id: visitEwa }),
        token: tokEwa,
        body: { action: 'move', start: at('12:00') }
      }),
      call(staffRoute, 'POST', '/api/[salon]/staff', {
        params: P(),
        token: tokEwa,
        body: { name: 'X', phone: '799000000' }
      }),
      call(staffScheduleRoute, 'PUT', '/api/[salon]/staff/[id]/schedule', {
        params: P({ id: ewa }),
        token: tokEwa,
        body: [{ weekday: 1, starts: '06:00', ends: '22:00' }]
      }),
      call(clientsRoute, 'GET', '/api/[salon]/clients', { params: P(), token: tokEwa }),
      call(servicesRoute, 'POST', '/api/[salon]/services', {
        params: P(),
        token: tokEwa,
        body: { name: 'X', durationMin: 30 }
      }),
      call(settingsRoute, 'PATCH', '/api/[salon]/settings', {
        params: P(),
        token: tokEwa,
        body: { confirmationMode: 'manual' }
      }),
      call(pendingRoute, 'GET', '/api/[salon]/pending', { params: P(), token: tokEwa }),
      call(smsRoute, 'GET', '/api/[salon]/sms', { params: P(), token: tokEwa })
    ];
    expect((await Promise.all(tries)).map((r) => r.status)).toEqual(Array(tries.length).fill(403));
    const [v] = await sql<{ status: string }[]>`select status from visit where id = ${visitEwa}`;
    expect(v.status).toBe('potwierdzona');
  });

  it('sees only herself in the team list', async () => {
    const r = await call(staffRoute, 'GET', '/api/[salon]/staff', { params: P(), token: tokEwa });
    expect(r.json.staff.map((s: { id: string }) => s.id)).toEqual([ewa]);
  });
});

describe('S1.C5 manager', () => {
  it('can do everything in her salon', async () => {
    const add = await call(visitsRoute, 'POST', '/api/[salon]/visits', {
      params: P(),
      token: tokMgr,
      body: {
        serviceId: t.serviceIds.cut,
        staffId: null,
        start: at('12:00'),
        client: { name: 'Pani Basia', phone: '600 700 800' }
      }
    });
    expect(add.status).toBe(200);
    expect(add.json.visit.status).toBe('potwierdzona');
    const move = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: add.json.visit.id }),
      token: tokMgr,
      body: { action: 'move', start: at('14:00'), staffId: iza }
    });
    expect(move.status).toBe(200);
    expect(move.json.visit.staff_id).toBe(iza);
    const clash = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: add.json.visit.id }),
      token: tokMgr,
      body: { action: 'move', start: at('10:30'), staffId: iza }
    });
    expect(clash.status).toBe(409);
    expect(clash.json.error.message).toBe('Ten termin jest już zajęty. Wybierz inny.');
    const cancel = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: visitIza }),
      token: tokMgr,
      body: { action: 'cancel' }
    });
    expect(cancel.json.visit.status).toBe('odwolana');
    const again = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: visitIza }),
      token: tokMgr,
      body: { action: 'confirm' }
    });
    expect(again.status).toBe(409); // a cancelled visit cannot be confirmed again
    const all = await call(visitsRoute, 'GET', '/api/[salon]/visits', {
      params: P(),
      token: tokMgr,
      search: { from: at('00:00'), to: at('23:59') }
    });
    expect(all.json.visits).toHaveLength(3);
    const statuses = await Promise.all([
      call(blocksRoute, 'POST', '/api/[salon]/blocks', {
        params: P(),
        token: tokMgr,
        body: { staffId: ewa, start: at('16:00'), end: at('17:00') }
      }),
      call(staffScheduleRoute, 'PUT', '/api/[salon]/staff/[id]/schedule', {
        params: P({ id: ewa }),
        token: tokMgr,
        body: [{ weekday: 1, starts: '09:00', ends: '15:00' }]
      }),
      call(clientsRoute, 'GET', '/api/[salon]/clients', {
        params: P(),
        token: tokMgr,
        search: { q: 'basia' }
      }),
      call(settingsRoute, 'PATCH', '/api/[salon]/settings', {
        params: P(),
        token: tokMgr,
        body: { confirmationMode: 'manual' }
      }),
      call(staffRoute, 'POST', '/api/[salon]/staff', {
        params: P(),
        token: tokMgr,
        body: { name: 'Nowa', phone: '799000000' }
      }),
      call(scheduleRoute, 'GET', '/api/[salon]/schedule', {
        params: P(),
        token: tokMgr,
        search: { staff: iza }
      }),
      call(smsRoute, 'GET', '/api/[salon]/sms', { params: P(), token: tokMgr })
    ]);
    expect(statuses.map((s) => s.status)).toEqual([200, 200, 200, 200, 200, 200, 200]);
    expect(statuses[2].json.clients.map((c: { name: string }) => c.name)).toEqual(['Pani Basia']);
    expect(statuses[3].json.salon.confirmation_mode).toBe('manual');
  });

  it('a past visit can be marked as no-show or finished, a future one cannot', async () => {
    const r = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: visitEwa }),
      token: tokMgr,
      body: { action: 'no_show' }
    });
    expect(r.status).toBe(400);
    await sql`update visit set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour',
      blocked_until = now() - interval '1 hour' where id = ${visitEwa}`;
    const ok = await call(visitRoute, 'PATCH', '/api/[salon]/visits/[id]', {
      params: P({ id: visitEwa }),
      token: tokMgr,
      body: { action: 'no_show' }
    });
    expect(ok.json.visit.status).toBe('nieobecnosc');
  });
});

describe('login', () => {
  it('manager password login sets an httpOnly session cookie; a wrong password is refused', async () => {
    const bad = await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
      params: P(),
      body: { phone: '600 000 001', password: 'zle-haslo' }
    });
    expect(bad.status).toBe(401);
    const ok = await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
      params: P(),
      body: { phone: '600 000 001', password: 'tajne-haslo-1' }
    });
    expect(ok.status).toBe(200);
    const cookie = ok.cookies.get(SESSION_COOKIE)!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    const me = await call(meRoute, 'GET', '/api/[salon]/auth/me', { params: P(), token: cookie.value });
    expect(me.json).toMatchObject({ role: 'manager', staffId: t.managerId });
    const [row] = await sql<
      { id: string }[]
    >`select id from session where staff_id = ${t.managerId} order by created_at desc limit 1`;
    expect(row.id).not.toBe(cookie.value); // only a hash of the token is stored
    await call(logoutRoute, 'POST', '/api/[salon]/auth/logout', { params: P(), token: cookie.value });
    expect(await actorFromToken(sql, cookie.value, t.salon.id)).toBeNull();
  });

  it('staff SMS code login: the code goes through the SMS adapter and works once', async () => {
    const sms = smsLog();
    const r = await call(codeRoute, 'POST', '/api/[salon]/auth/code', {
      params: P(),
      body: { phone: '600000002' }
    });
    expect(r.status).toBe(200);
    expect(r.json.code).toBeUndefined();
    const code = lastCode(sms, '600000002');
    const ok = await call(verifyRoute, 'POST', '/api/[salon]/auth/verify', {
      params: P(),
      body: { phone: '600000002', code }
    });
    expect(ok.status).toBe(200);
    const me = await call(meRoute, 'GET', '/api/[salon]/auth/me', {
      params: P(),
      token: ok.cookies.get(SESSION_COOKIE)!.value
    });
    expect(me.json).toMatchObject({ role: 'stylist', staffId: ewa });
    const reuse = await call(verifyRoute, 'POST', '/api/[salon]/auth/verify', {
      params: P(),
      body: { phone: '600000002', code }
    });
    expect(reuse.status).toBe(400);
    const [n] = await sql<
      { n: number }[]
    >`select count(*)::int as n from notification where type = 'kod_logowania'`;
    expect(n.n).toBe(1);
  });

  it('an unknown phone gets the same answer and no SMS', async () => {
    const sms = smsLog();
    const r = await call(codeRoute, 'POST', '/api/[salon]/auth/code', {
      params: P(),
      body: { phone: '699999999' }
    });
    expect(r.status).toBe(200);
    expect(sms.sent).toHaveLength(0);
  });

  it('a demo salon (or SMS_ECHO=on) shows the code on screen', async () => {
    await sql`update salon set is_demo = true where id = ${t.salon.id}`;
    const r = await call(codeRoute, 'POST', '/api/[salon]/auth/code', {
      params: P(),
      body: { phone: '600000002' }
    });
    expect(r.json.code).toMatch(/^\d{6}$/);
  });

  it('rate limits code requests and logins', async () => {
    const codes = [];
    for (let i = 0; i < 4; i++) {
      codes.push(
        (
          await call(codeRoute, 'POST', '/api/[salon]/auth/code', {
            params: P(),
            body: { phone: '600000002' }
          })
        ).status
      );
    }
    expect(codes).toEqual([200, 200, 200, 429]);
    const logins = [];
    for (let i = 0; i < 11; i++) {
      logins.push(
        (
          await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
            params: P(),
            body: { phone: '600000001', password: 'zle' }
          })
        ).status
      );
    }
    expect(logins.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(logins[10]).toBe(429);
    const right = await call(loginRoute, 'POST', '/api/[salon]/auth/login', {
      params: P(),
      body: { phone: '600000001', password: 'tajne-haslo-1' }
    });
    expect(right.status).toBe(429); // still limited, even with the right password
  });

  it('wrong codes count as attempts; after 5 the code is dead', async () => {
    const sms = smsLog();
    await call(codeRoute, 'POST', '/api/[salon]/auth/code', { params: P(), body: { phone: '600000002' } });
    const code = lastCode(sms, '600000002');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await call(verifyRoute, 'POST', '/api/[salon]/auth/verify', {
        params: P(),
        body: { phone: '600000002', code: wrong }
      });
    }
    const late = await call(verifyRoute, 'POST', '/api/[salon]/auth/verify', {
      params: P(),
      body: { phone: '600000002', code }
    });
    expect(late.status).toBe(400);
  });
});
