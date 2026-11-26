// Staff login (manager password, SMS code for everyone), DB sessions, one-time codes and rate limits.
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import type { Sql } from 'postgres';
import { appSecret, flag } from './env.ts';
import { AppError, invalid } from './errors.ts';
import { sendSms } from './notify.ts';
import { smsProvider } from './sms/index.ts';
import { texts, type SmsLang } from './sms/templates.ts';
import { normalizePhone } from './phone.ts';
import type { Actor } from './policy.ts';
import type { Salon } from './tenant.ts';

export const SESSION_COOKIE = 'beauty_session';
export const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const CODE_MAX_ATTEMPTS = 5;

// ---------- passwords (scrypt from node:crypto, no extra dependency) ----------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function scryptAsync(pw: string, salt: Buffer, keylen: number, o: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(pw, salt, keylen, o, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [kind, n, r, p, salt, key] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(key, 'base64url');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64url'), want.length, { N: +n, r: +r, p: +p });
  return timingSafeEqual(want, got);
}

// ---------- rate limits (fixed window in the DB) ----------

/** Count one hit on `key`; throw RATE_LIMITED when the window already has `limit` hits. */
export async function rateLimit(
  sql: Sql,
  key: string,
  limit: number,
  windowSec: number,
  salonId: string | null = null
): Promise<void> {
  const [r] = await sql<{ count: number }[]>`
    insert into rate_limit (key, window_start, salon_id, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec}), ${salonId}, 1)
    on conflict (key, window_start) do update set count = rate_limit.count + 1
    returning count`;
  if (r.count > limit) throw new AppError('RATE_LIMITED', 'Za dużo prób. Spróbuj ponownie za kilka minut.');
}

// ---------- one-time SMS codes ----------

function codeHash(salonId: string, phone: string, purpose: string, code: string): string {
  return createHmac('sha256', appSecret()).update(`${salonId}|${phone}|${purpose}|${code}`).digest('hex');
}

/** True when codes may be shown on screen: the demo salon or SMS_ECHO=on. */
export function echoCodes(salon: Pick<Salon, 'is_demo'>): boolean {
  return salon.is_demo || flag('SMS_ECHO');
}

export interface IssuedCode {
  phone: string;
  /** Present only when echoCodes() allows it. */
  echo?: string;
}

export async function issueCode(
  sql: Sql,
  salon: Salon,
  rawPhone: string,
  purpose: 'staff_login' | 'client_verify',
  ip = 'unknown',
  staffId: string | null = null
): Promise<IssuedCode> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw invalid('Podaj poprawny numer telefonu.');
  await rateLimit(sql, `code:${salon.id}:${phone}`, 3, 600, salon.id);
  await rateLimit(sql, `code-ip:${ip}`, 20, 3600);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`
    insert into sms_code (salon_id, phone, purpose, code_hash, expires_at)
    values (${salon.id}, ${phone}, ${purpose}, ${codeHash(salon.id, phone, purpose, code)},
            now() + make_interval(mins => ${CODE_TTL_MIN}))`;
  const T = texts(salon.lang);
  const body = purpose === 'staff_login' ? T.kod_logowania(code, salon.name) : T.kod(code, salon.name);
  await sendSms(sql, {
    salonId: salon.id,
    type: purpose === 'staff_login' ? 'kod_logowania' : 'kod_klient',
    to: phone,
    body,
    staffId
  });
  return echoCodes(salon) ? { phone, echo: code } : { phone };
}

/** Check the newest unused code; one wrong try counts as an attempt. Throws BAD_CODE. */
export async function checkCode(
  sql: Sql,
  salonId: string,
  phone: string,
  purpose: 'staff_login' | 'client_verify',
  code: string
): Promise<void> {
  const [row] = await sql<{ id: string; code_hash: string; attempts: number }[]>`
    select id, code_hash, attempts from sms_code
    where salon_id = ${salonId} and phone = ${phone} and purpose = ${purpose}
      and used_at is null and expires_at > now()
    order by created_at desc limit 1`;
  const bad = new AppError('BAD_CODE', 'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.');
  if (!row || row.attempts >= CODE_MAX_ATTEMPTS) throw bad;
  const want = Buffer.from(row.code_hash, 'hex');
  const got = Buffer.from(codeHash(salonId, phone, purpose, code.trim()), 'hex');
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await sql`update sms_code set attempts = attempts + 1 where id = ${row.id}`;
    throw bad;
  }
  await sql`update sms_code set used_at = now() where id = ${row.id}`;
}

// ---------- phone check during "Załóż salon" (no salon yet) ----------

const SIGNUP_TOKEN_MIN = 60;

function signupHash(phone: string, code: string): string {
  return createHmac('sha256', appSecret()).update(`signup|${phone}|${code}`).digest('hex');
}

/** Send a sign-up code to the owner's phone. The code is on screen only with SMS_ECHO=on. */
export async function issueSignupCode(
  sql: Sql,
  rawPhone: string,
  ip = 'unknown',
  lang: SmsLang = 'pl'
): Promise<IssuedCode> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw invalid('Podaj poprawny numer telefonu.');
  await rateLimit(sql, `signup-code:${phone}`, 3, 600);
  await rateLimit(sql, `signup-code-ip:${ip}`, 10, 3600);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`
    insert into signup_code (phone, code_hash, expires_at)
    values (${phone}, ${signupHash(phone, code)}, now() + make_interval(mins => ${CODE_TTL_MIN}))`;
  // No salon yet, so no notification row: the SMS counter is per salon.
  const r = await smsProvider().send({
    to: phone,
    body: texts(lang).kod_zalozenia(code)
  });
  if (r.status === 'failed') throw new AppError('INVALID', 'Nie udało się wysłać SMS. Spróbuj ponownie.');
  return flag('SMS_ECHO') ? { phone, echo: code } : { phone };
}

/** Check the sign-up code; returns a signed phone token valid for one hour. */
export async function verifySignupCode(
  sql: Sql,
  rawPhone: string,
  code: string,
  ip = 'unknown'
): Promise<string> {
  const phone = normalizePhone(rawPhone);
  const bad = new AppError('BAD_CODE', 'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.');
  if (!phone) throw bad;
  await rateLimit(sql, `signup-verify-ip:${ip}`, 30, 3600);
  const [row] = await sql<{ id: string; code_hash: string; attempts: number }[]>`
    select id, code_hash, attempts from signup_code
    where phone = ${phone} and used_at is null and expires_at > now()
    order by created_at desc limit 1`;
  if (!row || row.attempts >= CODE_MAX_ATTEMPTS) throw bad;
  const want = Buffer.from(row.code_hash, 'hex');
  const got = Buffer.from(signupHash(phone, code.trim()), 'hex');
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    await sql`update signup_code set attempts = attempts + 1 where id = ${row.id}`;
    throw bad;
  }
  await sql`update signup_code set used_at = now() where id = ${row.id}`;
  return signupToken(phone, Date.now() + SIGNUP_TOKEN_MIN * 60_000);
}

export function signupToken(phone: string, expiresMs: number): string {
  const payload = `${phone}|${expiresMs}`;
  const sig = createHmac('sha256', appSecret()).update(`signup-token|${payload}`).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** The verified phone behind a token, or null when the token is wrong or old. */
export function phoneFromSignupToken(token: string): string | null {
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const payload = Buffer.from(p, 'base64url').toString();
  const want = Buffer.from(
    createHmac('sha256', appSecret()).update(`signup-token|${payload}`).digest('base64url')
  );
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [phone, exp] = payload.split('|');
  return Number(exp) > Date.now() ? phone : null;
}

// ---------- sessions ----------

function tokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(sql: Sql, salonId: string, staffId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await sql`
    insert into session (id, salon_id, staff_id, expires_at)
    values (${tokenId(token)}, ${salonId}, ${staffId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  return token;
}

/** The actor behind a session token, or null. A session of salon A never resolves inside salon B. */
export async function actorFromToken(
  sql: Sql,
  token: string | undefined,
  salonId: string
): Promise<Actor | null> {
  if (!token) return null;
  const [r] = await sql<{ salon_id: string; staff_id: string; role: Actor['role']; name: string }[]>`
    select s.salon_id, s.staff_id, st.role, st.name
    from session s join staff st on st.id = s.staff_id and st.salon_id = s.salon_id
      join salon sa on sa.id = s.salon_id
    where s.id = ${tokenId(token)} and s.expires_at > now() and st.active and sa.status <> 'rejected'`;
  if (!r || r.salon_id !== salonId) return null;
  return { salonId: r.salon_id, staffId: r.staff_id, role: r.role, name: r.name };
}

export async function destroySession(sql: Sql, token: string | undefined): Promise<void> {
  if (token) await sql`delete from session where id = ${tokenId(token)}`;
}

// ---------- login flows ----------

interface StaffLogin {
  id: string;
  role: Actor['role'];
  password_hash: string | null;
}

async function staffByPhone(sql: Sql, salonId: string, phone: string): Promise<StaffLogin | null> {
  const [s] = await sql<StaffLogin[]>`
    select id, role, password_hash from staff where salon_id = ${salonId} and phone = ${phone} and active`;
  return s ?? null;
}

const WRONG_LOGIN = () => new AppError('UNAUTHORIZED', 'Nieprawidłowy numer telefonu lub hasło.');

/** A rejected salon: nobody logs in. */
export const REJECTED_MSG = 'Ten salon nie został przyjęty.';
function refuseRejected(salon: Salon): void {
  if (salon.status === 'rejected') throw new AppError('FORBIDDEN', REJECTED_MSG);
}

/** Password login (managers). Returns a session token. */
export async function loginWithPassword(
  sql: Sql,
  salon: Salon,
  rawPhone: string,
  password: string,
  ip = 'unknown'
): Promise<string> {
  refuseRejected(salon);
  const phone = normalizePhone(rawPhone);
  if (!phone) throw WRONG_LOGIN();
  await rateLimit(sql, `login:${salon.id}:${phone}`, 10, 900, salon.id);
  await rateLimit(sql, `login-ip:${ip}`, 50, 3600);
  const staff = await staffByPhone(sql, salon.id, phone);
  if (!staff || !(await verifyPassword(password, staff.password_hash))) throw WRONG_LOGIN();
  return createSession(sql, salon.id, staff.id);
}

/** Step 1 of the SMS login: sends a code only when the phone belongs to active staff. */
export async function requestLoginCode(
  sql: Sql,
  salon: Salon,
  rawPhone: string,
  ip = 'unknown'
): Promise<IssuedCode> {
  refuseRejected(salon);
  const phone = normalizePhone(rawPhone);
  if (!phone) throw invalid('Podaj poprawny numer telefonu.');
  const staff = await staffByPhone(sql, salon.id, phone);
  if (!staff) {
    // Same answer as for a known phone, so the endpoint does not tell who works here.
    await rateLimit(sql, `code:${salon.id}:${phone}`, 3, 600, salon.id);
    return { phone };
  }
  return issueCode(sql, salon, phone, 'staff_login', ip, staff.id);
}

/** Step 2 of the SMS login. Returns a session token. */
export async function loginWithCode(
  sql: Sql,
  salon: Salon,
  rawPhone: string,
  code: string,
  ip = 'unknown'
): Promise<string> {
  refuseRejected(salon);
  const phone = normalizePhone(rawPhone);
  if (!phone) throw WRONG_LOGIN();
  await rateLimit(sql, `login:${salon.id}:${phone}`, 10, 900, salon.id);
  await rateLimit(sql, `login-ip:${ip}`, 50, 3600);
  const staff = await staffByPhone(sql, salon.id, phone);
  if (!staff) throw new AppError('BAD_CODE', 'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.');
  await checkCode(sql, salon.id, phone, 'staff_login', code);
  return createSession(sql, salon.id, staff.id);
}

// ---------- signed links for clients ----------

/** Token for the visit status page link in an SMS. No account: the signature is the key. */
export function visitToken(visitId: string): string {
  const id = Buffer.from(visitId.replace(/-/g, ''), 'hex').toString('base64url');
  const sig = createHmac('sha256', appSecret()).update(`visit|${visitId}`).digest('base64url').slice(0, 22);
  return `${id}.${sig}`;
}

export function visitIdFromToken(token: string): string | null {
  const [id, sig] = token.split('.');
  if (!id || !sig) return null;
  const hex = Buffer.from(id, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const visitId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const want = Buffer.from(visitToken(visitId).split('.')[1]);
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? visitId : null;
}

// ---------- verified phone during an online booking ----------

export const BOOKING_TOKEN_MIN = 30;

/** Signed proof that this phone passed the SMS code in this salon; valid 30 minutes (a taken time, a retry). */
export function bookingToken(salonId: string, phone: string, expiresMs: number): string {
  const payload = `${salonId}|${phone}|${expiresMs}`;
  const sig = createHmac('sha256', appSecret()).update(`booking-token|${payload}`).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** The phone behind a booking token of this salon, or null when the token is wrong, old or of another salon. */
export function phoneFromBookingToken(token: string, salonId: string, nowMs = Date.now()): string | null {
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const payload = Buffer.from(p, 'base64url').toString();
  const want = Buffer.from(
    createHmac('sha256', appSecret()).update(`booking-token|${payload}`).digest('base64url')
  );
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [salon, phone, exp] = payload.split('|');
  return salon === salonId && Number(exp) > nowMs ? phone : null;
}
