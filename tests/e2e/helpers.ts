// Shared e2e helpers: direct DB access (assertions read the DB), salons made in the DB, login, waits.
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { createSalon } from '../../src/lib/server/salons.ts';

export const DB_URL = process.env.E2E_DATABASE_URL ?? 'postgres://beauty:beauty@127.0.0.1:55440/beauty_e2e';
export const BASE = 'http://localhost:8151';
export const FAKE = 'http://127.0.0.1:8159';

let sql: postgres.Sql | null = null;
export function db(): postgres.Sql {
  if (!sql) sql = postgres(DB_URL, { max: 2, onnotice: () => {}, connection: { TimeZone: 'UTC' } });
  return sql;
}
export async function closeDb() {
  await sql?.end({ timeout: 2 });
  sql = null;
}

/** Sign-ups from this machine count against "3 per IP a day": forget the IP of earlier test salons. */
export async function forgetSignupIps() {
  await db()`update salon set signup_ip = 'e2e-earlier' where signup_ip is not null`;
  await db()`delete from rate_limit`;
}

/** Remove every salon but the demo one (cascades to all their rows), and the admin state. */
export async function resetSalons() {
  await db()`delete from salon where not is_demo`;
  await db()`delete from rate_limit`;
  await db()`delete from admin_session`;
  await db()`delete from admin_audit`;
  await fetch(`${FAKE}/received`, { method: 'DELETE' });
}

export const ALL_WEEK = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  opens: '09:00',
  closes: '18:00'
}));

/** An accepted salon made in the DB (the IP limit is not part of these specs). */
export async function makeActiveSalon(
  slug: string,
  phoneBase: number,
  opts: { manual?: boolean } = {}
): Promise<{ id: string; slug: string; owner: string; kasia: string }> {
  const s = await createSalon(db() as never, {
    name: `Salon ${slug}`,
    slug,
    phone: `+48${phoneBase + 1}`,
    confirmationMode: opts.manual ? 'manual' : 'auto',
    openingHours: ALL_WEEK,
    manager: {
      name: 'Ola',
      phone: `+48${phoneBase + 1}`,
      password: 'haslo-wlascicielki',
      color: '#C2577F',
      services: [{ key: 'cut' }, { key: 'color' }]
    },
    services: [
      { key: 'cut', name: 'Strzyżenie damskie', durationMin: 60 },
      { key: 'color', name: 'Koloryzacja', durationMin: 120 }
    ],
    stylists: [{ name: 'Kasia', phone: `+48${phoneBase + 2}`, color: '#4F7CB8', services: [{ key: 'cut' }] }]
  });
  const staff = await db()<
    { id: string; name: string }[]
  >`select id, name from staff where salon_id = ${s.id}`;
  return {
    id: s.id,
    slug,
    owner: staff.find((x) => x.name === 'Ola')!.id,
    kasia: staff.find((x) => x.name === 'Kasia')!.id
  };
}

/** Log in on /login with phone + password (the owner). */
export async function loginPassword(page: Page, phone: string, password: string, slug: string) {
  await page.goto(`/login?salon=${slug}`);
  await page.getByLabel('Telefon').fill(phone);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Mam hasło' }).click();
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL(`**/${slug}/panel`);
}

/** Create a pending salon through the real sign-up API (code -> verify -> signup). */
export async function signupApi(
  request: APIRequestContext,
  name: string,
  phone: string,
  about: Partial<{ city: string; street: string; teamSize: string; link: string; about: string }> = {}
) {
  const code = await request.post('/api/signup/code', { data: { phone } });
  expect(code.status(), await code.text()).toBe(200);
  const c = (await code.json()).code as string;
  const v = await request.post('/api/signup/verify', { data: { phone, code: c } });
  const { phoneToken } = await v.json();
  const slug = (await (await request.get(`/api/signup?name=${encodeURIComponent(name)}`)).json()).slug;
  const r = await request.post('/api/signup', {
    data: {
      phoneToken,
      name,
      slug,
      password: 'haslo-wlascicielki',
      city: 'Legnica',
      street: 'Rynek 7',
      teamSize: '1',
      link: 'facebook.com/barberrynek',
      about: 'Strzyżenie męskie i broda.',
      ...about,
      team: [{ name: 'Bartek' }],
      services: [{ name: 'Strzyżenie męskie', durationMin: 30 }],
      openingHours: ALL_WEEK
    }
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).salon as { id: string; slug: string; name: string; status: string };
}

export function tomorrowWarsaw(): string {
  return Temporal.Now.plainDateISO('Europe/Warsaw').add({ days: 1 }).toString();
}

/** No horizontal page scroll. */
export async function noHorizontalScroll(page: Page) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(w[0], `page is ${w[0]} px wide in a ${w[1]} px window`).toBeLessThanOrEqual(w[1]);
}
