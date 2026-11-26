// The English version (`lang` cookie = en): the same screens with English texts, dates and prices, and the
// English screenshots of the README in docs/screens/en/. The texts come from the dictionary, so a rewording
// does not break this spec; what it checks is that the pages use the dictionary and the language of the request.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { i18n } from '../../src/lib/i18n/index.ts';
import { createSalon } from '../../src/lib/server/salons.ts';
import { BASE, closeDb, db, noHorizontalScroll, resetSalons } from './helpers.ts';

const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screens', 'en');
mkdirSync(OUT, { recursive: true });
const CLOCK = new Date('2025-11-12T11:20:00+01:00'); // a Wednesday
const W = (d: string, t: string) => new Date(`${d}T${t}:00+01:00`).toISOString();
const T = i18n('en').t;
const SLUG = 'studio-ola';

test.describe.configure({ mode: 'serial' });
test.afterAll(closeDb);

async function english(ctx: BrowserContext) {
  await ctx.addCookies([{ name: 'lang', value: 'en', url: BASE }]);
}

async function shoot(page: Page, file: string) {
  await page.evaluate(() => document.fonts.ready);
  await noHorizontalScroll(page);
  await page.screenshot({ path: join(OUT, `${file}.png`) });
}

/** The salon of the design screens, with English service names and English SMS (`lang = 'en'`). */
async function seed() {
  await resetSalons();
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens: '09:00', closes: '18:00' }));
  hours.push({ weekday: 6, opens: '09:00', closes: '14:00' });
  const s = await createSalon(db() as never, {
    name: 'Studio Ola',
    slug: SLUG,
    lang: 'en',
    phone: '+48600000101',
    confirmationMode: 'auto',
    openingHours: hours,
    manager: {
      name: 'Ola',
      phone: '+48600000101',
      password: 'haslo-oli-123',
      color: '#C2577F',
      services: [{ key: 'wc' }, { key: 'co' }, { key: 'bd' }]
    },
    services: [
      { key: 'wc', name: 'Women’s haircut', durationMin: 60, priceGrosze: 9000 },
      { key: 'mc', name: 'Men’s haircut', durationMin: 30, priceGrosze: 5000 },
      { key: 'co', name: 'Colouring', durationMin: 120, priceGrosze: 22000 },
      { key: 'bd', name: 'Blow-dry', durationMin: 45, priceGrosze: 7000 },
      { key: 'ma', name: 'Gel manicure', durationMin: 60, priceGrosze: 12000 },
      { key: 'pe', name: 'Pedicure', durationMin: 60, priceGrosze: 13000 },
      { key: 'br', name: 'Brows and lashes', durationMin: 30, priceGrosze: 5000 }
    ],
    stylists: [
      {
        name: 'Kasia',
        phone: '+48600000102',
        color: '#4F7CB8',
        services: [{ key: 'wc' }, { key: 'mc' }, { key: 'co' }]
      },
      { name: 'Magda', color: '#5E8C57', services: [{ key: 'ma' }, { key: 'pe' }, { key: 'br' }] },
      { name: 'Ewa', color: '#C08A3E', services: [{ key: 'wc' }] }
    ]
  });
  await db()`update salon set street = 'Chojnowska 12', city = 'Legnica', show_prices = true where id = ${s.id}`;
  const ids = async (table: 'staff' | 'service') =>
    Object.fromEntries(
      (
        await db()<{ id: string; name: string }[]>`
          select id, name from ${db()(table)} where salon_id = ${s.id}`
      ).map((x) => [x.name, x.id])
    );
  const staff = await ids('staff');
  const svc = await ids('service');
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
    await visit('Ola', d, '09:00', '10:00', 'Anna Nowak', 'Women’s haircut', 'zakonczona');
  await visit('Ola', D, '09:00', '10:00', 'Anna Nowak', 'Women’s haircut');
  await visit('Ola', D, '10:30', '12:30', 'Beata Kowal', 'Colouring');
  await visit('Ola', D, '14:00', '14:45', 'Julia Wrona', 'Blow-dry');
  await visit('Ola', D, '15:30', '16:30', 'Marta Lis', 'Women’s haircut');
  await visit('Kasia', D, '09:30', '10:00', 'Piotr Zając', 'Men’s haircut');
  await visit('Kasia', D, '11:00', '13:00', 'Karolina Mazur', 'Colouring');
  await visit('Kasia', D, '14:00', '15:00', 'Ewelina Sowa', 'Women’s haircut');
  await visit('Kasia', D, '16:00', '17:00', 'Natalia Bąk', 'Women’s haircut', 'oczekuje', '+48512448019');
  await visit('Magda', D, '10:00', '11:00', 'Ola Zielińska', 'Gel manicure');
  await visit('Magda', D, '12:00', '13:00', 'Iza Kubiak', 'Gel manicure');
  await visit('Magda', D, '15:00', '16:00', 'Dorota Pawlak', 'Pedicure');
  await visit(
    'Ola',
    '2025-11-13',
    '10:00',
    '12:00',
    'Monika Sikora',
    'Colouring',
    'oczekuje',
    '+48698301552'
  );
  await db()`insert into block (salon_id, staff_id, starts_at, ends_at, reason)
    values (${s.id}, ${staff.Ola}, ${W(D, '13:00')}, ${W(D, '14:00')}, 'Przerwa'),
           (${s.id}, ${staff.Ewa}, ${W(D, '00:00')}, ${W('2025-11-15', '00:00')}, 'Urlop')`;
  return s;
}

test('landing, /en and the language switch', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Polish by default, whatever the browser says
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(i18n('pl').t.landing.h1);
  // /en switches and stays switched
  await page.goto('/en');
  await expect(page).toHaveURL(/\/\?lang=en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(T.landing.h1);
  await expect(page.getByText(T.landing.free)).toBeVisible();
  await expect(page.getByRole('link', { name: /vote2build #001/ })).toHaveAttribute('href', i18n('en').v2b);
  await page.goto('/');
  await expect(page.getByRole('link', { name: T.landing.create })).toBeVisible();
  await shoot(page, 'landing-1440');
  // the switch goes back to Polish
  await page.getByRole('link', { name: 'PL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByRole('link', { name: i18n('pl').t.landing.create })).toBeVisible();
  // an unknown page: the error page in English
  await page.goto('/?lang=en');
  await page.goto('/no-such-salon');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is no such salon.');
  await expect(page.getByRole('link', { name: T.common.home })).toBeVisible();
  await ctx.close();
});

test('owner panel in English: day, new visit, week, waiting, settings', async ({ browser }) => {
  await seed();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await english(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  await page.goto(`/login?salon=${SLUG}`);
  await expect(page.getByRole('heading', { name: T.login.title })).toBeVisible();
  await page.getByLabel(T.login.phone).fill('600 000 101');
  await page.getByRole('button', { name: T.login.next }).click();
  await page.getByRole('button', { name: T.login.havePassword }).click();
  await page.getByLabel(T.login.password).fill('haslo-oli-123');
  await page.getByRole('button', { name: T.login.submit }).click();
  await page.waitForURL(`**/${SLUG}/panel`);
  await expect(page.getByRole('heading', { name: 'Wednesday, 12 November' })).toBeVisible();
  await expect(page.getByRole('link', { name: T.panel.rail.calendar })).toBeVisible();
  await expect(page.getByTestId('col-Ola')).toContainText('Women’s haircut');
  await expect(page.getByTestId('col-Ola')).toContainText(T.panel.block.kind('Przerwa'));

  const magda = page.getByTestId('col-Magda');
  const box = (await magda.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 4 * 64 + 20);
  await expect(magda.getByTestId('free')).toContainText('13:00');
  await page.mouse.move(0, 0);
  await shoot(page, 'Kalendarz');
  await page.setViewportSize({ width: 1440, height: 900 });
  await shoot(page, 'Kalendarz-1440');
  await page.setViewportSize({ width: 1024, height: 768 });

  await magda.getByTestId('free').click();
  const sheet = page.getByRole('dialog', { name: T.panel.newVisit.title });
  await sheet.getByLabel(T.panel.newVisit.phone).pressSequentially('60122');
  await expect(sheet.getByTestId('client-hint')).toContainText(T.panel.newVisit.been('Anna Nowak', 5));
  await sheet.getByLabel(T.panel.newVisit.name).fill('Anna Nowak');
  await sheet.getByLabel(T.panel.newVisit.phone).focus();
  await shoot(page, 'NowaWizyta');
  await page.keyboard.press('Escape');

  await page.getByRole('link', { name: T.panel.bar.week }).click();
  await expect(page.getByRole('heading', { name: '10 – 16 November' })).toBeVisible();
  await expect(page.getByTestId('week-day')).toHaveCount(7);
  await expect(page.getByText('Mon', { exact: true })).toBeVisible();
  await shoot(page, 'Tydzien');

  await page.getByRole('link', { name: new RegExp(T.panel.rail.waiting) }).click();
  await expect(page.getByTestId('pending-card')).toHaveCount(2);
  await expect(page.getByTestId('pending-card').first()).not.toContainText(/Czeka|wizyt/);
  await shoot(page, 'Czekaja');

  await page.getByRole('link', { name: T.panel.rail.settings }).click();
  await expect(page.getByText(T.settings.main.servicesCount(7))).toBeVisible();
  await expect(page.getByText('Mon–Fri 9–18, Sat 9–14')).toBeVisible();
  await shoot(page, 'Ustawienia');
  // nothing Polish is left on the settings page (names of people and the salon aside)
  expect(await page.locator('body').innerText()).not.toMatch(/[ąćęłńóśźż]/i);
  await ctx.close();
});

test('client booking in English at 390 px, with an English SMS', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await english(ctx);
  const page = await ctx.newPage();
  await page.goto(`/${SLUG}`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: T.booking.service.title })).toBeVisible();
  await expect(page.getByRole('button', { name: /Colouring\s*120 min · PLN 220/ })).toBeVisible();
  await expect(page.getByText(T.common.stepOf(1, 5))).toBeVisible();
  await shoot(page, 'Klient-1-usluga-390');

  await page.getByRole('button', { name: /Women’s haircut/ }).click();
  await expect(page.getByRole('heading', { name: T.booking.person.title })).toBeVisible();
  await expect(page.getByRole('button', { name: T.booking.person.any })).toBeVisible();
  await page.getByRole('button', { name: /Kasia$/ }).click();
  await expect(page.getByRole('heading', { name: T.booking.time.title })).toBeVisible();
  await expect(page.getByTestId('times').getByRole('button').first()).toBeVisible();
  await shoot(page, 'Klient-3-termin-390');

  await page.getByTestId('times').getByRole('button').first().click();
  await page.getByLabel(T.booking.details.name).fill('Natalia');
  await page.getByLabel(T.booking.details.phone).fill('700 700 201');
  await page.getByRole('button', { name: T.booking.details.next }).click();
  await expect(page.getByRole('heading', { name: T.booking.code.title })).toBeVisible();
  // the salon's language is English: the code SMS is English
  const [code] = await db()<{ body: string }[]>`
    select body from notification where to_phone = '+48700700201' and type = 'kod_klient' order by created_at desc`;
  expect(code.body).toMatch(/^\d{6} is your booking code for Studio Ola\. Valid for 10 minutes\.$/);
  await expect(page.getByLabel(T.common.digit(6))).not.toHaveValue('');
  await page.getByRole('button', { name: T.booking.code.book }).click();
  await expect(page.getByRole('heading', { name: T.booking.status.potwierdzona })).toBeVisible();
  await expect(page.getByText(T.booking.done.remind)).toBeVisible();
  await shoot(page, 'Klient-6-gotowe-390');

  await page.getByRole('link', { name: T.booking.done.see }).click();
  await expect(page.getByTestId('status')).toHaveText(T.booking.status.potwierdzona);
  await expect(page.getByRole('link', { name: T.booking.visit.cancel })).toBeVisible();
  await shoot(page, 'Klient-7-wizyta-390');
  expect(await page.locator('body').innerText()).not.toMatch(/[ąćęłńóśźż]/i);

  await page.goto(`/${SLUG}/prywatnosc`);
  await expect(page.getByRole('heading', { name: T.booking.privacy.title })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/[ąćęłńóśźż]/i);
  await ctx.close();
});

test('stylist phone view in English', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await english(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(CLOCK);
  await page.goto('/login');
  await page.getByLabel(T.login.phone).fill('600 000 102');
  await page.getByRole('button', { name: T.login.next }).click();
  await page.getByRole('button', { name: T.login.sendCode }).click();
  await expect(page.getByRole('heading', { name: T.login.codeTitle })).toBeVisible();
  await expect(page.getByLabel(T.common.digit(6))).not.toHaveValue('');
  await page.getByRole('button', { name: T.login.submit }).click();
  await page.waitForURL(`**/${SLUG}/panel`);
  await expect(page.getByTestId('my-visit')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Wednesday, 12 November' })).toBeVisible();
  await page.mouse.move(0, 0);
  await shoot(page, 'Stylistka');
  await ctx.close();
});

test('platform admin in English', async ({ browser }) => {
  const at = (iso: string) => new Date(iso).toISOString();
  const pend = [
    [
      'Studio Ola 2',
      'studio-ola-2',
      'Legnica',
      'Chojnowska 12',
      'Hair for women and men, colouring, nails.',
      '2–3',
      '+48500100201',
      'instagram.com/studio.ola',
      '2025-11-12T18:42:00+01:00'
    ],
    [
      'Barber Rynek',
      'barber-rynek',
      'Legnica',
      'Rynek 7',
      'Men’s haircuts and beards.',
      '1',
      '+48500100202',
      'facebook.com/barberrynek',
      '2025-11-12T16:05:00+01:00'
    ],
    [
      'Nails by Kasia',
      'nails-by-kasia',
      'Chojnów',
      'Legnicka 3',
      'Gel manicure, pedicure.',
      '1',
      '+48500100203',
      'nailsbykasia.example',
      '2025-11-11T21:17:00+01:00'
    ]
  ];
  for (const [name, slug, city, street, about, size, phone, link, when] of pend) {
    await db()`insert into salon (slug, name, city, street, about, team_size, phone, link, status, submitted_at, lang)
      values (${slug}, ${name}, ${city}, ${street}, ${about}, ${size}, ${phone}, ${link}, 'pending', ${at(when)}, 'en')`;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await english(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2025-11-12T18:50:00+01:00'));
  await page.goto('/admin/login');
  await page.getByLabel(T.admin.login.password).fill('e2e-admin-haslo');
  await page.getByRole('button', { name: T.admin.login.submit }).click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: new RegExp(T.admin.title) })).toBeVisible();
  await expect(page.getByTestId('salon-card')).toHaveCount(3);
  await expect(page.getByTestId('salon-card').first()).toContainText('today 18:42');
  await expect(page.getByTestId('salon-card').first()).toContainText(T.admin.people('2–3'));
  await expect(page.getByRole('button', { name: T.admin.accept, exact: true }).first()).toBeVisible();
  await shoot(page, 'Admin');
  // accepting an English salon sends the owner an English SMS
  await page.getByRole('button', { name: T.admin.accept, exact: true }).first().click();
  await expect(page.getByTestId('salon-card').filter({ hasText: 'Studio Ola 2' })).toHaveCount(0);
  await expect(page.getByText(T.admin.toastAccepted('Studio Ola 2'))).toBeVisible();
  const [sms] = await db()<{ body: string }[]>`
    select body from notification where type = 'salon_przyjety' and to_phone = '+48500100201'`;
  expect(sms.body).toMatch(/^Salon accepted\. Online booking is on: http/);
  await ctx.close();
});
