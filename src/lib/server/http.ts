// Thin glue between SvelteKit routes and the service layer: tenant, actor, JSON in and out, error mapping.
import { json, type RequestEvent } from '@sveltejs/kit';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, adminEnabled, isAdmin } from './admin.ts';
import { actorFromToken, SESSION_COOKIE, SESSION_DAYS } from './auth.ts';
import { db, pgCode } from './db.ts';
import { env, publicUrl } from './env.ts';
import { AppError, unauthorized } from './errors.ts';
import type { Actor } from './policy.ts';
import { resolveSalon, type Salon } from './tenant.ts';

export interface Ctx {
  sql: Sql;
  salon: Salon;
  actor: Actor | null;
  ip: string;
  event: RequestEvent;
}

function mainHosts(): string[] {
  const u = env('PUBLIC_URL');
  try {
    return u ? [new URL(u).hostname] : [];
  } catch {
    return [];
  }
}

export function clientIp(event: RequestEvent): string {
  try {
    // A closed socket gives undefined; a missing proxy header throws (adapter-node ADDRESS_HEADER).
    return event.getClientAddress() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Resolve the salon of the request and the staff session (if any). 404 when the salon does not exist. */
export async function context(event: RequestEvent): Promise<Ctx> {
  const sql = db();
  const salon = await resolveSalon(sql, { path: event.url.pathname, host: event.url.host }, mainHosts());
  if (!salon || (event.params.salon && salon.slug !== event.params.salon.toLowerCase())) {
    throw new AppError('NOT_FOUND', 'Nie ma takiego salonu.');
  }
  const actor = await actorFromToken(sql, event.cookies.get(SESSION_COOKIE), salon.id);
  return { sql, salon, actor, ip: clientIp(event), event };
}

export function requireActor(c: Ctx): Actor {
  if (!c.actor) throw unauthorized();
  return c.actor;
}

export function setSessionCookie(event: RequestEvent, token: string): void {
  event.cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // adapter-node reports https unless told otherwise; trust PUBLIC_URL, so plain-http self-hosting works
    secure: publicUrl().startsWith('https:'),
    maxAge: SESSION_DAYS * 24 * 3600
  });
}

export function clearSessionCookie(event: RequestEvent): void {
  event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function body<T extends z.ZodType>(event: RequestEvent, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await event.request.json();
  } catch {
    throw new AppError('INVALID', 'Nieprawidłowe dane.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError('INVALID', 'Sprawdź wpisane dane.');
  return r.data;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof AppError)
    return json({ error: { code: e.code, message: e.message, ...e.data } }, { status: e.status });
  const code = pgCode(e);
  if (code === '22P02')
    return json({ error: { code: 'NOT_FOUND', message: 'Nie znaleziono.' } }, { status: 404 });
  if (code === '23514' || code === '23502' || code === '22007' || code === '22008') {
    return json({ error: { code: 'INVALID', message: 'Sprawdź wpisane dane.' } }, { status: 400 });
  }
  if (code === '23503') {
    return json({ error: { code: 'NOT_FOUND', message: 'Nie znaleziono.' } }, { status: 404 });
  }
  if (code === '23505')
    return json({ error: { code: 'CONFLICT', message: 'Taki wpis już istnieje.' } }, { status: 409 });
  if (code === '23P01') {
    return json(
      { error: { code: 'TERM_TAKEN', message: 'Ten termin jest już zajęty. Wybierz inny.' } },
      { status: 409 }
    );
  }
  if (e instanceof RangeError)
    return json({ error: { code: 'INVALID', message: 'Sprawdź datę i godzinę.' } }, { status: 400 });
  console.error('[api]', e);
  return json(
    { error: { code: 'SERVER', message: 'Coś poszło nie tak. Spróbuj ponownie.' } },
    { status: 500 }
  );
}

type Handler = (event: RequestEvent) => Promise<Response>;

/** Wrap a route handler: resolve the salon, run the service call, map errors. */
export function api(fn: (c: Ctx) => Promise<unknown>): Handler {
  return async (event) => {
    try {
      const c = await context(event);
      const out = await fn(c);
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Same as api(), but the handler needs a logged-in staff member. */
export function staffApi(fn: (c: Ctx, actor: Actor) => Promise<unknown>): Handler {
  return api((c) => fn(c, requireActor(c)));
}

/** A platform admin route: 404 when there is no admin on this instance, 401 without the admin cookie. */
export function adminApi(fn: (sql: Sql, event: RequestEvent) => Promise<unknown>): Handler {
  return async (event) => {
    try {
      if (!adminEnabled()) throw new AppError('NOT_FOUND', 'Nie znaleziono.');
      const sql = db();
      if (!(await isAdmin(sql, event.cookies.get(ADMIN_COOKIE)))) throw unauthorized();
      const out = await fn(sql, event);
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function setAdminCookie(event: RequestEvent, token: string): void {
  event.cookies.set(ADMIN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: publicUrl().startsWith('https:'),
    maxAge: ADMIN_SESSION_HOURS * 3600
  });
}

export const zUuid = z.uuid();
export const zInstant = z.string().refine((s) => {
  try {
    Temporal.Instant.from(s);
    return true;
  } catch {
    return false;
  }
});
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** A query string parameter, or undefined. */
export function q(c: Ctx, name: string): string | undefined {
  return c.event.url.searchParams.get(name) ?? undefined;
}

/** from/to query parameters (ISO instants) with a default window of one local week from today. */
export function range(c: Ctx): { from: string; to: string } {
  const from = q(c, 'from');
  const to = q(c, 'to');
  if (from && to)
    return { from: Temporal.Instant.from(from).toString(), to: Temporal.Instant.from(to).toString() };
  const today = Temporal.Now.plainDateISO(c.salon.timezone);
  const start = today.toZonedDateTime({ timeZone: c.salon.timezone }).toInstant();
  return { from: start.toString(), to: start.add({ hours: 24 * 7 }).toString() };
}
