// Test helpers: a clean test database, small salons, sessions, and a fake SvelteKit RequestEvent so the tests
// call the real route handlers (the server entry points) without a running server.
import type { RequestEvent } from '@sveltejs/kit';
import type { Sql } from 'postgres';
import { createSession, SESSION_COOKIE } from '../src/lib/server/auth.ts';
import { connect, useDb } from '../src/lib/server/db.ts';
import { normalizePhone } from '../src/lib/server/phone.ts';
import { createSalon, type NewSalonInput } from '../src/lib/server/salons.ts';
import { LogSmsProvider } from '../src/lib/server/sms/log.ts';
import { useSmsProvider } from '../src/lib/server/sms/index.ts';
import type { Salon } from '../src/lib/server/tenant.ts';

export function testSql(max = 5): Sql {
  const sql = connect(process.env.DATABASE_URL, max);
  useDb(sql);
  return sql;
}

/** Remove every row (salons cascade to everything) and queued jobs. */
export async function reset(sql: Sql): Promise<void> {
  await sql`truncate salon, rate_limit, signup_code cascade`;
  const [boss] =
    await sql`select 1 from information_schema.tables where table_schema = 'pgboss' and table_name = 'job'`;
  if (boss) await sql`delete from pgboss.job`;
}

/** A fresh log provider that records what it "sent". */
export function smsLog(): LogSmsProvider {
  const p = new LogSmsProvider();
  useSmsProvider(p);
  return p;
}

export function lastCode(p: LogSmsProvider, phone: string): string {
  const to = normalizePhone(phone);
  const m = [...p.sent].reverse().find((s) => s.to === to);
  const code = m?.body.match(/^(\d{6})/)?.[1];
  if (!code) throw new Error(`no code sent to ${phone}`);
  return code;
}

/** A Monday 7-13 days ahead of the real clock: the routes use the real clock, so test dates stay in the future. */
function nextMonday(): string {
  const today = Temporal.Now.plainDateISO('Europe/Warsaw');
  return today.add({ days: 7 + ((8 - today.dayOfWeek) % 7) }).toString();
}
export const MON = nextMonday();
/** "HH:MM" on MON (or MON + n days) in Warsaw, as an ISO instant. */
export function at(time: string, plusDays = 0): string {
  return Temporal.PlainDate.from(MON)
    .add({ days: plusDays })
    .toZonedDateTime({ timeZone: 'Europe/Warsaw', plainTime: Temporal.PlainTime.from(time) })
    .toInstant()
    .toString();
}

export interface TestSalon {
  salon: Salon;
  managerId: string;
  stylistIds: string[]; // [Ewa, Iza]
  serviceIds: Record<'cut' | 'color', string>;
}

/**
 * A salon open Mon-Sat 09:00-17:00. Ewa does both services (colour in her own 90 min), Iza only the cut.
 * cut: 60 min + 10 min buffer, colour: 120 min + 15 min buffer.
 */
export async function makeSalon(
  sql: Sql,
  slug: string,
  opts: Partial<Pick<NewSalonInput, 'confirmationMode'>> & { phoneBase?: number } = {}
): Promise<TestSalon> {
  const base = opts.phoneBase ?? 600000000;
  const hours = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: '09:00', closes: '17:00' }));
  const salon = await createSalon(sql, {
    name: `Salon ${slug}`,
    slug,
    confirmationMode: opts.confirmationMode ?? 'auto',
    openingHours: hours,
    manager: { name: 'Kierowniczka', phone: `+48${base + 1}`, password: 'tajne-haslo-1' },
    services: [
      { key: 'cut', name: 'Strzyżenie damskie', durationMin: 60, bufferMin: 10, priceGrosze: 9000 },
      { key: 'color', name: 'Koloryzacja', durationMin: 120, bufferMin: 15, priceGrosze: 20000 }
    ],
    stylists: [
      { name: 'Ewa', phone: `+48${base + 2}`, services: [{ key: 'cut' }, { key: 'color', durationMin: 90 }] },
      { name: 'Iza', phone: `+48${base + 3}`, services: [{ key: 'cut' }] }
    ]
  });
  const staff = await sql<{ id: string; role: string; name: string }[]>`
    select id, role, name from staff where salon_id = ${salon.id} order by sort`;
  const services = await sql<{ id: string; name: string }[]>`
    select id, name from service where salon_id = ${salon.id} order by sort`;
  return {
    salon,
    managerId: staff.find((s) => s.role === 'manager')!.id,
    stylistIds: staff.filter((s) => s.role === 'stylist').map((s) => s.id),
    serviceIds: { cut: services[0].id, color: services[1].id }
  };
}

export async function sessionFor(sql: Sql, salonId: string, staffId: string): Promise<string> {
  return createSession(sql, salonId, staffId);
}

export interface CallOpts {
  params?: Record<string, string>;
  body?: unknown;
  token?: string;
  search?: Record<string, string>;
  cookies?: Record<string, string>;
  ip?: string;
}

export interface CallResult {
  status: number;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  cookies: Map<string, { value: string; opts: Record<string, unknown> }>;
}

type RouteModule = Record<string, unknown>;

/** Call a +server.ts handler like SvelteKit would. The path is built from the route id and params. */
export async function call(
  mod: RouteModule,
  method: string,
  routeId: string,
  opts: CallOpts = {}
): Promise<CallResult> {
  const handler = mod[method] as ((e: RequestEvent) => Promise<Response>) | undefined;
  if (!handler) throw new Error(`${routeId} has no ${method}`);
  const params = opts.params ?? {};
  const path = routeId.replace(/\[(\w+)\]/g, (_, k: string) => encodeURIComponent(params[k] ?? ''));
  const url = new URL(`http://localhost:8151${path}`);
  for (const [k, v] of Object.entries(opts.search ?? {})) url.searchParams.set(k, v);
  const jar = new Map<string, string>();
  if (opts.token) jar.set(SESSION_COOKIE, opts.token);
  for (const [k, v] of Object.entries(opts.cookies ?? {})) jar.set(k, v);
  const setCookies: CallResult['cookies'] = new Map();
  const cookies = {
    get: (n: string) => jar.get(n),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    set: (n: string, v: string, o: Record<string, unknown>) => {
      jar.set(n, v);
      setCookies.set(n, { value: v, opts: o });
    },
    delete: (n: string, o: Record<string, unknown>) => {
      jar.delete(n);
      setCookies.set(n, { value: '', opts: o });
    },
    serialize: () => ''
  };
  const request = new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: opts.body === undefined || method === 'GET' ? undefined : JSON.stringify(opts.body)
  });
  const event = {
    url,
    params,
    cookies,
    request,
    route: { id: routeId },
    locals: {},
    getClientAddress: () => opts.ip ?? '127.0.0.1',
    setHeaders: () => {},
    fetch,
    platform: undefined,
    isDataRequest: false,
    isSubRequest: false
  } as unknown as RequestEvent;
  const res = await handler(event);
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text; // a non-JSON answer (the calendar file)
  }
  return { status: res.status, json, cookies: setCookies };
}
