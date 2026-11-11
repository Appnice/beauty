// Platform admin (/admin): one password from env ADMIN_PASSWORD, scrypt-compared, rate-limited per IP,
// its own session cookie in admin_session. No password (or SINGLE_SALON=on) = no admin: /admin is a 404.
import { createHash, randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';
import { hashPassword, rateLimit, verifyPassword } from './auth.ts';
import { env, flag } from './env.ts';
import { AppError } from './errors.ts';

export const ADMIN_COOKIE = 'beauty_admin';
export const ADMIN_SESSION_HOURS = 12;
export const ADMIN_LOGIN_LIMIT = 5; // per IP in 15 minutes

export function adminEnabled(): boolean {
  return env('ADMIN_PASSWORD') !== '' && !flag('SINGLE_SALON');
}

// The env password is hashed once per process; a stored "scrypt$..." value is used as it is.
let cached: { plain: string; hash: Promise<string> } | null = null;
function adminHash(): Promise<string> {
  const pw = env('ADMIN_PASSWORD');
  if (pw.startsWith('scrypt$')) return Promise.resolve(pw);
  if (!cached || cached.plain !== pw) cached = { plain: pw, hash: hashPassword(pw) };
  return cached.hash;
}

function tokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Check the password and return a new admin session token. */
export async function adminLogin(sql: Sql, password: string, ip: string): Promise<string> {
  if (!adminEnabled()) throw new AppError('NOT_FOUND', 'Nie znaleziono.');
  await rateLimit(sql, `admin-login-ip:${ip}`, ADMIN_LOGIN_LIMIT, 900);
  if (!(await verifyPassword(password, await adminHash())))
    throw new AppError('UNAUTHORIZED', 'Nieprawidłowe hasło.');
  const token = randomBytes(32).toString('base64url');
  await sql`insert into admin_session (id, expires_at)
    values (${tokenId(token)}, now() + make_interval(hours => ${ADMIN_SESSION_HOURS}))`;
  return token;
}

export async function isAdmin(sql: Sql, token: string | undefined): Promise<boolean> {
  if (!token || !adminEnabled()) return false;
  const [r] = await sql`select 1 from admin_session where id = ${tokenId(token)} and expires_at > now()`;
  return !!r;
}

export async function adminLogout(sql: Sql, token: string | undefined): Promise<void> {
  if (token) await sql`delete from admin_session where id = ${tokenId(token)}`;
}
