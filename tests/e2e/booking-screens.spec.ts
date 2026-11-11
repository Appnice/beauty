// S2.C8: screenshots of the landing page, each booking step, the visit page and the privacy page at 390 and
// 1440 px into docs/screens/ (Klient-*.png). The look is the wizard look of the design (Uslugi.dc.html rows,
// Kod.dc.html boxes, Gotowe.dc.html result). Real clock: the times are the first ones the engine offers.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSalon } from '../../src/lib/server/salons.ts';
import { ALL_WEEK, closeDb, db, noHorizontalScroll } from './helpers.ts';

const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screens');
mkdirSync(OUT, { recursive: true });

test.describe.configure({ mode: 'serial' });
test.afterAll(closeDb);

test.beforeAll(async () => {
  await db()`delete from salon where slug = 'studio-ola'`;
  await db()`delete from rate_limit`;
  const s = await createSalon(db() as never, {
    name: 'Studio Ola',
    slug: 'studio-ola',
    phone: '+48604700001',
    confirmationMode: 'auto',
    openingHours: ALL_WEEK,
    manager: {
      name: 'Ola',
      phone: '+48604700001',
      password: 'haslo-wlascicielki',
      color: '#C2577F',
      services: [{ key: 'cut' }, { key: 'color' }, { key: 'style' }]
    },
    services: [
      { key: 'cut', name: 'Strzyżenie damskie', durationMin: 60, priceGrosze: 9000 },
      { key: 'men', name: 'Strzyżenie męskie', durationMin: 30, priceGrosze: 5000 },
      { key: 'color', name: 'Koloryzacja', durationMin: 120, priceGrosze: 22000 },
      { key: 'style', name: 'Modelowanie', durationMin: 45, priceGrosze: 7000 }
    ],
    stylists: [
      { name: 'Magda', phone: '+48604700002', color: '#4F7CB8', services: [{ key: 'cut' }, { key: 'men' }] },
      {
        name: 'Kasia',
        phone: '+48604700003',
        color: '#5E8C57',
        services: [{ key: 'cut' }, { key: 'color' }]
      },
      { name: 'Ania', phone: '+48604700004', color: '#C08A3E', services: [{ key: 'men' }, { key: 'style' }] }
    ]
  });
  await db()`update salon set street = 'Chojnowska 12', city = 'Legnica', show_prices = true where id = ${s.id}`;
});

async function shot(page: Page, name: string, w: number) {
  await page.evaluate(() => document.fonts.ready);
  if (w === 390) await noHorizontalScroll(page);
  await page.screenshot({ path: join(OUT, `Klient-${name}-${w}.png`) });
}

for (const [w, h, phone] of [
  [390, 844, '700 700 101'],
  [1440, 900, '700 700 102']
] as const) {
  test(`landing, booking steps, visit and privacy pages at ${w} px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(page.getByText('Za darmo. Otwarty kod.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Załóż salon' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zobacz salon demo' })).toHaveAttribute('href', '/demo');
    await expect(page.getByText('Studio Ola')).toHaveCount(0); // the landing page lists no salons
    await shot(page, '0-start', w);

    await page.goto('/studio-ola');
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Co robimy?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Koloryzacja\s*120 min · 220 zł/ })).toBeVisible();
    await shot(page, '1-usluga', w);

    await page.getByRole('button', { name: /Strzyżenie damskie/ }).click();
    await expect(page.getByRole('heading', { name: 'Do kogo?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ania$/ })).toHaveCount(0); // Ania does not cut
    await shot(page, '2-osoba', w);

    await page.getByRole('button', { name: /Kasia$/ }).click();
    await expect(page.getByTestId('times').getByRole('button').first()).toBeVisible();
    await shot(page, '3-termin', w);

    await page.getByTestId('times').getByRole('button').first().click();
    await page.getByLabel('Imię').fill('Natalia');
    await page.getByLabel('Telefon').fill(phone);
    await expect(page.getByRole('link', { name: 'zasady prywatności' })).toHaveAttribute(
      'href',
      '/studio-ola/prywatnosc'
    );
    await shot(page, '4-dane', w);

    await page.getByRole('button', { name: 'Dalej' }).click();
    await expect(page.getByLabel('Cyfra 6')).not.toHaveValue('');
    await shot(page, '5-kod', w);

    await page.getByRole('button', { name: 'Zarezerwuj' }).click();
    await expect(page.getByRole('heading', { name: 'Wizyta potwierdzona' })).toBeVisible();
    await shot(page, '6-gotowe', w);

    await page.getByRole('link', { name: 'Zobacz wizytę' }).click();
    await expect(page.getByTestId('status')).toHaveText('Wizyta potwierdzona');
    await expect(page.getByRole('link', { name: 'Odwołaj wizytę' })).toBeVisible();
    await shot(page, '7-wizyta', w);

    await page.goto('/studio-ola/prywatnosc');
    await expect(page.getByText(/Administratorem danych jest salon Studio Ola/)).toBeVisible();
    await shot(page, '8-prywatnosc', w);
  });
}

test('the privacy page of the demo salon renders', async ({ page }) => {
  const res = await page.goto('/demo/prywatnosc');
  expect(res!.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Prywatność' })).toBeVisible();
  await expect(page.getByText(/Administratorem danych jest salon/)).toBeVisible();
  await expect(page.getByText('umowa powierzenia')).toBeVisible();
});
