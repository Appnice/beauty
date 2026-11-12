// S2.C6: screenshots of every design screen next to the design render, plus the screens the design does not
// cover. The data come from the design scripts. The browser clock is 2025-11-12 (a Wednesday, as the design
// copy "Środa, 12 listopada" needs); the day labels, "dziś 18:42" and the SMS month are computed in the
// browser, the seed rows carry 2025 timestamps. The design files render offline with docs/design/support.js.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSalon } from '../../src/lib/server/salons.ts';
import { closeDb, db, loginPassword, noHorizontalScroll, resetSalons } from './helpers.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'docs', 'screens');
mkdirSync(join(OUT, 'design'), { recursive: true });
const CLOCK = new Date('2025-11-12T11:20:00+01:00');
const ADMIN_CLOCK = new Date('2025-11-12T18:50:00+01:00');
const W = (d: string, t: string) => new Date(`${d}T${t}:00+01:00`).toISOString(); // November: UTC+1

test.describe.configure({ mode: 'serial' });
test.afterAll(closeDb);

// ---------- the design renderer, offline ----------

async function routeDesign(ctx: BrowserContext) {
  await ctx.route('http://design.local/**', (route) => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (path.startsWith('fonts/'))
      return route.fulfill({ body: readFileSync(join(ROOT, 'static', path)), contentType: 'font/woff2' });
    const file = join(ROOT, 'docs', 'design', decodeURIComponent(path));
    const type = file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
    return route.fulfill({ body: readFileSync(file), contentType: type });
  });
  // the design files ask Google Fonts: answer with the self-hosted woff2 files, nothing leaves the Mac
  const css = readFileSync(join(ROOT, 'src', 'app.css'), 'utf8')
    .split('\n:root')[0]
    .replaceAll("url('/fonts/", "url('http://design.local/fonts/");
  await ctx.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: css, contentType: 'text/css' })
  );
  await ctx.route('https://fonts.gstatic.com/**', (r) => r.abort());
}

/** Render one design at its $preview size; returns its visible text pieces. */
async function design(page: Page, name: string): Promise<string[]> {
  const html = readFileSync(join(ROOT, 'docs', 'design', `${name}.dc.html`), 'utf8');
  const size = JSON.parse(/"\$preview":(\{[^}]+\})/.exec(html)![1]) as { width: number; height: number };
  await page.setViewportSize(size);
  await page.goto(`http://design.local/${name}.dc.html`);
  await page.waitForFunction(() => (window as unknown as { __dcDone?: boolean }).__dcDone === true);
  expect(await page.evaluate(() => (window as unknown as { __dcError?: string }).__dcError ?? '')).toBe('');
  const body = await page.evaluate(() => document.body.innerHTML);
  expect(body, `${name}: a placeholder is left`).not.toContain('{{');
  expect(body, `${name}: a template tag is left`).not.toMatch(/<(sc-for|sc-if|dc-import)/);
  await page.screenshot({ path: join(OUT, 'design', `${name}.png`) });
  return page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement!;
      if (['SCRIPT', 'STYLE'].includes(p.tagName)) continue;
      const t = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    for (const el of document.querySelectorAll('input:not([type=password]), textarea'))
      if ((el as HTMLInputElement).value) out.push((el as HTMLInputElement).value.trim());
    return out;
  });
}

/** Every text piece of the design must show on the app screen (text, field values). */
async function copyCheck(page: Page, name: string, texts: string[]) {
  const app = await page.evaluate(() => {
    const vals = [...document.querySelectorAll('input:not([type=password]), textarea, select')].map((el) =>
      el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? '') : (el as HTMLInputElement).value
    );
    return (document.body.innerText + ' ' + vals.join(' ')).replace(/\s+/g, ' ');
  });
  const missing = [...new Set(texts)].filter((t) => !app.includes(t));
  expect(missing, `${name}: design copy missing on the app screen`).toEqual([]);
}

async function shoot(page: Page, file: string) {
  await noHorizontalScroll(page);
  await page.screenshot({ path: join(OUT, `${file}.png`) });
}

// ---------- seed: the data of the design scripts ----------

async function seedDesign() {
  await resetSalons();
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '18:00' }));
  hours.push({ weekday: 6, opens: '09:00', closes: '14:00' });
  const s = await createSalon(db() as never, {
    name: 'Studio Ola',
    slug: 'studio-ola',
    openingHours: hours,
    manager: {
      name: 'Ola',
      phone: '+48600000101',
      password: 'haslo-oli-123',
      color: '#C2577F',
      services: [{ key: 'sd' }, { key: 'ko' }, { key: 'mo' }]
    },
    services: [
      { key: 'sd', name: 'Strzyżenie damskie', durationMin: 60 },
      { key: 'sm', name: 'Strzyżenie męskie', durationMin: 30 },
      { key: 'ko', name: 'Koloryzacja', durationMin: 120 },
      { key: 'mo', name: 'Modelowanie', durationMin: 45 },
      { key: 'ma', name: 'Manicure hybrydowy', durationMin: 60 },
      { key: 'pe', name: 'Pedicure', durationMin: 60 },
      { key: 'br', name: 'Brwi i rzęsy', durationMin: 30 }
    ],
    stylists: [
      {
        name: 'Kasia',
        phone: '+48600000102',
        color: '#4F7CB8',
        services: [{ key: 'sd' }, { key: 'sm' }, { key: 'ko' }]
      },
      { name: 'Magda', color: '#5E8C57', services: [{ key: 'ma' }, { key: 'pe' }, { key: 'br' }] },
      { name: 'Ewa', color: '#C08A3E', services: [{ key: 'sd' }] }
    ]
  });
  const staff = Object.fromEntries(
    (await db()<{ id: string; name: string }[]>`select id, name from staff where salon_id = ${s.id}`).map(
      (x) => [x.name, x.id]
    )
  );
  const svc = Object.fromEntries(
    (await db()<{ id: string; name: string }[]>`select id, name from service where salon_id = ${s.id}`).map(
      (x) => [x.name, x.id]
    )
  );
  const clients: Record<string, string> = {};
  const client = async (name: string, phone: string | null = null) => {
    if (clients[name]) return clients[name];
    const [c] =
      await db()`insert into client (salon_id, name, phone) values (${s.id}, ${name}, ${phone}) returning id`;
    return (clients[name] = c.id);
  };
  const visit = async (
    who: string,
    day: string,
    from: string,
    to: string,
    name: string,
    service: string,
    status = 'potwierdzona',
    phone: string | null = null
  ) => {
    await db()`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until,
        status, source, created_at)
      values (${s.id}, ${await client(name, phone)}, ${staff[who]}, ${svc[service]}, ${W(day, from)}, ${W(day, to)},
        ${W(day, to)}, ${status}, ${status === 'oczekuje' ? 'online' : 'recepcja'}, ${W('2025-11-10', '10:00')})`;
  };
  const D = '2025-11-12';
  await client('Anna Nowak', '+48601223908');
  for (const d of ['2025-09-10', '2025-09-24', '2025-10-08', '2025-10-22'])
    await visit('Ola', d, '9:00'.padStart(5, '0'), '10:00', 'Anna Nowak', 'Strzyżenie damskie', 'zakonczona');
  await visit('Ola', D, '09:00', '10:00', 'Anna Nowak', 'Strzyżenie damskie');
  await visit('Ola', D, '10:30', '12:30', 'Beata Kowal', 'Koloryzacja');
  await visit('Ola', D, '14:00', '14:45', 'Julia Wrona', 'Modelowanie');
  await visit('Ola', D, '15:30', '16:30', 'Marta Lis', 'Strzyżenie damskie');
  await visit('Kasia', D, '09:30', '10:00', 'Piotr Zając', 'Strzyżenie męskie');
  await visit('Kasia', D, '11:00', '13:00', 'Karolina Mazur', 'Koloryzacja');
  await visit('Kasia', D, '14:00', '15:00', 'Ewelina Sowa', 'Strzyżenie damskie');
  await visit('Kasia', D, '16:00', '17:00', 'Natalia Bąk', 'Strzyżenie damskie', 'oczekuje', '+48512448019');
  await visit('Magda', D, '10:00', '11:00', 'Ola Zielińska', 'Manicure hybrydowy');
  await visit('Magda', D, '12:00', '13:00', 'Iza Kubiak', 'Manicure hybrydowy');
  await visit('Magda', D, '15:00', '16:00', 'Dorota Pawlak', 'Pedicure');
  await visit(
    'Ola',
    '2025-11-13',
    '10:00',
    '12:00',
    'Monika Sikora',
    'Koloryzacja',
    'oczekuje',
    '+48698301552'
  );
  await db()`insert into block (salon_id, staff_id, starts_at, ends_at, reason)
    values (${s.id}, ${staff.Ola}, ${W(D, '13:00')}, ${W(D, '14:00')}, 'Przerwa'),
           (${s.id}, ${staff.Ewa}, ${W(D, '00:00')}, ${W('2025-11-15', '00:00')}, 'Urlop')`;
  // "SMS w listopadzie 142 z 300"
  await db()`insert into notification (salon_id, type, to_phone, body, status, provider, created_at)
    select ${s.id}, 'przypomnienie', '+48700000000', 'x', 'logged', 'log',
      ${W('2025-11-01', '08:00')}::timestamptz + make_interval(mins => g * 60)
    from generate_series(1, 142) g`;
  return { salon: s, staff, svc };
}

async function seedAdmin() {
  const at = (iso: string) => new Date(iso).toISOString();
  const pend = [
    [
      'Studio Ola',
      'studio-ola-2',
      'Legnica',
      'Chojnowska 12',
      'Fryzjer damski i męski, koloryzacja, paznokcie.',
      '2–3',
      '+48600123456',
      'instagram.com/studio.ola',
      '2025-11-12T18:42:00+01:00'
    ],
    [
      'Barber Rynek',
      'barber-rynek',
      'Legnica',
      'Rynek 7',
      'Strzyżenie męskie i broda.',
      '1',
      '+48512900211',
      'facebook.com/barberrynek',
      '2025-11-12T16:05:00+01:00'
    ],
    [
      'Nails by Kasia',
      'nails-by-kasia',
      'Chojnów',
      'Legnicka 3',
      'Manicure hybrydowy, pedicure.',
      '1',
      '+48698441020',
      'nailsbykasia.pl',
      '2025-11-11T21:17:00+01:00'
    ]
  ];
  for (const [name, slug, city, street, about, size, phone, link, when] of pend) {
    await db()`insert into salon (slug, name, city, street, about, team_size, phone, link, status, submitted_at)
      values (${slug}, ${name}, ${city}, ${street}, ${about}, ${size}, ${phone}, ${link}, 'pending', ${at(when)})`;
  }
  for (let i = 0; i < 16; i++) {
    const status = i < 12 ? 'active' : 'rejected';
    await db()`insert into salon (slug, name, city, about, team_size, status, submitted_at, decided_at)
      values (${'old-' + i}, ${'Salon ' + i}, 'Legnica', 'x', '1', ${status}, ${at('2025-10-01T10:00:00Z')},
        ${at('2025-10-02T10:00:00Z')})`;
  }
}

/** The wizard state in sessionStorage, as the owner left it at that step. */
async function wizard(page: Page, step: number, state: Record<string, unknown>) {
  await page.goto('/zaloz');
  await page.evaluate((s) => sessionStorage.setItem('beauty-signup', JSON.stringify(s)), {
    reached: step,
    name: 'Studio Ola',
    slug: 'studio-ola',
    phone: '600 123 456',
    sentAt: CLOCK.getTime() - 18_000,
    ...state
  });
  await page.goto(`/zaloz?krok=${step}`);
}

// ---------- the screens ----------

test('sign-up screens at 390 px match the design', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await routeDesign(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  const wiz: [string, number, Record<string, unknown>, (p: Page) => Promise<void>][] = [
    [
      'Main',
      1,
      {},
      async (p) => {
        await p.getByLabel('Hasło').fill('haslo1234');
        await p.getByLabel('Nazwa salonu').focus();
      }
    ],
    ['Kod', 2, { code: '481' }, async () => {}],
    [
      'Salon',
      3,
      {
        city: 'Legnica',
        street: 'Chojnowska 12',
        teamSize: '2–3',
        link: 'instagram.com/studio.ola',
        about: 'Fryzjer damski i męski, koloryzacja, paznokcie.'
      },
      async (p) => p.getByLabel('Instagram, Facebook lub strona').focus()
    ],
    ['Uslugi', 4, {}, async () => {}],
    ['Zespol', 5, { team: [{ name: 'Ola' }, { name: 'Kasia' }, { name: 'Magda' }] }, async () => {}],
    [
      'Godziny',
      6,
      {
        hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          open: weekday < 7,
          opens: weekday === 4 ? '10:00' : '09:00',
          closes: weekday === 4 ? '20:00' : weekday === 6 ? '14:00' : '18:00'
        }))
      },
      async () => {}
    ],
    ['Gotowe', 6, { done: { slug: 'studio-ola', name: 'Studio Ola', status: 'pending' } }, async () => {}]
  ];
  for (const [name, step, state, prep] of wiz) {
    const texts = await design(page, name);
    await page.setViewportSize({ width: 390, height: 844 });
    await wizard(page, step, state);
    await expect(page.locator('h1')).toBeVisible();
    await prep(page);
    await page.evaluate(() => document.fonts.ready);
    await shoot(page, name);
    await copyCheck(page, name, texts);
  }
  await ctx.close();
});

test('owner panel screens at 1024 px match the design; week, 390 and 1440 px', async ({ browser }) => {
  await seedDesign();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await routeDesign(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  const t = {
    Kalendarz: await design(page, 'Kalendarz'),
    NowaWizyta: await design(page, 'NowaWizyta'),
    Czekaja: await design(page, 'Czekaja'),
    Ustawienia: await design(page, 'Ustawienia')
  };
  await page.setViewportSize({ width: 1024, height: 768 });
  await loginPassword(page, '600 000 101', 'haslo-oli-123', 'studio-ola');
  await expect(page.getByRole('heading', { name: 'Środa, 12 listopada' })).toBeVisible();
  await expect(page.getByTestId('badge')).toHaveText('2');

  // Kalendarz with the free time at 13:00 in Magda's column
  const magda = page.getByTestId('col-Magda');
  const box = (await magda.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 4 * 64 + 20);
  await expect(magda.getByTestId('free')).toContainText('13:00');
  await page.mouse.move(0, 0);
  await shoot(page, 'Kalendarz');
  await copyCheck(page, 'Kalendarz', t.Kalendarz);

  // NowaWizyta over the calendar
  await magda.getByTestId('free').click();
  const sheet = page.getByRole('dialog', { name: 'Nowa wizyta' });
  await sheet.getByLabel('Telefon').pressSequentially('60122');
  await expect(sheet.getByTestId('client-hint')).toContainText('była 5 razy');
  await sheet.getByLabel('Imię').fill('Anna Nowak');
  await sheet.getByLabel('Telefon').focus();
  await shoot(page, 'NowaWizyta');
  await copyCheck(page, 'NowaWizyta', t.NowaWizyta);
  await page.keyboard.press('Escape');

  // panel at 390 and 1440 px, and the week view
  await page.setViewportSize({ width: 1440, height: 900 });
  await shoot(page, 'Kalendarz-1440');
  await page.setViewportSize({ width: 390, height: 844 });
  await shoot(page, 'Kalendarz-390');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('link', { name: 'Tydzień' }).click();
  await expect(page.getByRole('heading', { name: '10 – 16 listopada' })).toBeVisible();
  await expect(page.getByTestId('week-day')).toHaveCount(7);
  await expect(page.getByTestId('week-day').nth(2).getByRole('button')).toHaveCount(11);
  await shoot(page, 'Tydzien');

  // Czekaja
  await page.getByRole('link', { name: /Czekają/ }).click();
  await expect(page.getByTestId('pending-card')).toHaveCount(2);
  await shoot(page, 'Czekaja');
  await copyCheck(page, 'Czekaja', t.Czekaja);

  // Ustawienia: the design counts 4 services (the calendar design shows 7): hide 3 for this screen
  await db()`update service set active = false where name in ('Manicure hybrydowy', 'Pedicure', 'Brwi i rzęsy')`;
  await page.getByRole('link', { name: 'Ustawienia' }).click();
  await expect(page.getByTestId('sms')).toContainText('142');
  await expect(page.getByText('4 usługi')).toBeVisible();
  await shoot(page, 'Ustawienia');
  await copyCheck(page, 'Ustawienia', t.Ustawienia);
  await page.getByRole('link', { name: /Link do zapisów/ }).click();
  await expect(page.getByTestId('booking-link')).toHaveText('beauty.vote2build.com/studio-ola');
  await shoot(page, 'Ustawienia-link');
  await page.goto('/studio-ola/panel/ustawienia/zespol');
  await expect(page.getByTestId('person-row')).toHaveCount(4);
  await shoot(page, 'Ustawienia-zespol');
  await ctx.close();
});

test('login, stylist view and admin', async ({ browser }) => {
  // login at 390 px (no design: same look)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  await page.goto('/login');
  await page.getByLabel('Telefon').fill('600 000 102');
  await shoot(page, 'Login');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Wyślij kod SMS' }).click();
  await expect(page.getByRole('heading', { name: 'Wpisz kod z SMS' })).toBeVisible();
  await expect(page.getByLabel('Cyfra 6')).not.toHaveValue('');
  await shoot(page, 'Login-kod');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL('**/studio-ola/panel');
  await expect(page.getByTestId('my-visit')).toHaveCount(4);
  await page.mouse.move(0, 0);
  await shoot(page, 'Stylistka');
  await ctx.close();

  // admin at 1280 px, 18:50 on the same day
  await seedAdmin();
  const actx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await routeDesign(actx);
  const ap = await actx.newPage();
  await ap.clock.setFixedTime(ADMIN_CLOCK);
  const texts = await design(ap, 'Admin');
  await ap.setViewportSize({ width: 1280, height: 820 });
  await ap.goto('/admin/login');
  await ap.getByLabel('Hasło').fill('e2e-admin-haslo');
  await ap.getByRole('button', { name: 'Zaloguj się' }).click();
  await ap.waitForURL('**/admin');
  await expect(ap.getByTestId('salon-card')).toHaveCount(3);
  await shoot(ap, 'Admin');
  await copyCheck(ap, 'Admin', texts);
  await actx.close();
});
