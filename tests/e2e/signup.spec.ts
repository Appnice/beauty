// S2.C1: a new owner goes through every sign-up step on a 390 px phone, sees "Sprawdzamy salon", opens the
// calendar; the salon is pending with the ticked services, the people, the hours and "O salonie".
// Also: the honeypot, the 30-pending wizard message.
import { expect, test } from '@playwright/test';
import { closeDb, db, FAKE, forgetSignupIps, noHorizontalScroll } from './helpers.ts';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.afterAll(closeDb);

test('owner sign-up with approval, Back keeps the data', async ({ page }) => {
  await db()`delete from salon where slug = 'studio-ewelina' or phone = '+48600321654'`;
  await forgetSignupIps();
  await page.goto('/zaloz');
  await expect(page.getByText('1 z 6')).toBeVisible();
  await page.getByLabel('Nazwa salonu').fill('Studio Ewelina');
  await expect(page.getByText('beauty.appnice.dev/studio-ewelina')).toBeVisible();
  await page.getByLabel('Twój telefon').fill('600 321 654');
  await page.getByLabel('Hasło').fill('haslo-ewelina');
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Dalej' }).click();

  // step 2: SMS_ECHO=on puts the code into the boxes
  await expect(page.getByRole('heading', { name: 'Wpisz kod z SMS' })).toBeVisible();
  await expect(page.getByText('Wysłaliśmy go na 600 321 654')).toBeVisible();
  await expect(page.getByLabel('Cyfra 6')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Dalej' }).click();

  // step 3: "O salonie": a required field first
  await expect(page.getByRole('heading', { name: 'O salonie' })).toBeVisible();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByRole('alert')).toHaveText('Podaj miejscowość.');
  await page.getByLabel('Miejscowość').fill('Legnica');
  await page.getByLabel('Ulica i numer').fill('Chojnowska 12');
  await page.getByRole('radio', { name: '2–3' }).click();
  await page.getByLabel('Instagram, Facebook lub strona').fill('instagram.com/studio.ewelina');
  await page.getByLabel('Czym się zajmujecie?').fill('Fryzjer damski i męski, koloryzacja.');
  await page.getByRole('button', { name: 'Dalej' }).click();

  // step 4: services; Back to step 3 keeps "O salonie"
  await expect(page.getByRole('heading', { name: 'Co robicie?' })).toBeVisible();
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(page.getByLabel('Miejscowość')).toHaveValue('Legnica');
  await expect(page.getByRole('radio', { name: '2–3' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: /Modelowanie/ }).click(); // untick
  await page.getByRole('button', { name: /Manicure hybrydowy/ }).click(); // tick
  await page.getByRole('button', { name: 'Dodaj swoją' }).click();
  await page.getByLabel('Nazwa usługi').fill('Baleyage');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dalej · 5 usług' })).toBeVisible();
  await page.getByRole('button', { name: 'Dalej · 5 usług' }).click();

  // step 5: team (the owner is guessed from the salon name)
  await expect(page.getByRole('heading', { name: 'Kto pracuje?' })).toBeVisible();
  await expect(page.getByText('Ewelina', { exact: true })).toBeVisible();
  await page.getByLabel('Imię').fill('Kasia');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await page.getByLabel('Imię').fill('Magda');
  await page.getByLabel('Imię').press('Enter');
  await page.getByRole('button', { name: 'Dalej' }).click();

  // step 6: hours: Saturday closed, Monday 10:00
  await expect(page.getByRole('heading', { name: 'Kiedy otwarte?' })).toBeVisible();
  await page.getByRole('switch', { name: 'Sobota' }).click();
  await page.getByRole('button', { name: '9:00 – 18:00' }).first().click();
  await page.getByLabel('Od', { exact: true }).selectOption('10:00');
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Wyślij do akceptacji' }).click();

  // waiting screen
  await expect(page.getByRole('heading', { name: 'Sprawdzamy salon' })).toBeVisible();
  await expect(page.getByText('po akceptacji')).toBeVisible();
  await page.getByRole('button', { name: 'Otwórz kalendarz' }).click();
  await page.waitForURL('**/studio-ewelina/panel');
  await expect(page.getByTestId('pending-line')).toHaveText(/Zapisy online ruszą po akceptacji/);
  await expect(page.getByTestId('col-head')).toHaveCount(3);
  await noHorizontalScroll(page);

  // the DB: pending, with what the owner typed and ticked
  const [s] = await db()`select id, status, city, street, team_size, link, about, phone from salon
    where slug = 'studio-ewelina'`;
  expect(s).toMatchObject({
    status: 'pending',
    city: 'Legnica',
    street: 'Chojnowska 12',
    team_size: '2–3',
    link: 'instagram.com/studio.ewelina',
    about: 'Fryzjer damski i męski, koloryzacja.',
    phone: '+48600321654'
  });
  const services = await db()`select name, duration_min from service where salon_id = ${s.id} order by sort`;
  expect(services.map((x) => `${x.name} ${x.duration_min}`)).toEqual([
    'Strzyżenie damskie 60',
    'Strzyżenie męskie 30',
    'Koloryzacja 120',
    'Manicure hybrydowy 60',
    'Baleyage 60'
  ]);
  const staff = await db()`select name, role from staff where salon_id = ${s.id} order by sort`;
  expect(staff.map((x) => `${x.name}:${x.role}`)).toEqual([
    'Ewelina:manager',
    'Kasia:stylist',
    'Magda:stylist'
  ]);
  const hours = await db()`select weekday, opens::text, closes::text from opening_hours
    where salon_id = ${s.id} order by weekday`;
  expect(hours.map((h) => `${h.weekday} ${h.opens}-${h.closes}`)).toEqual([
    '1 10:00:00-18:00:00',
    '2 09:00:00-18:00:00',
    '3 09:00:00-18:00:00',
    '4 09:00:00-18:00:00',
    '5 09:00:00-18:00:00'
  ]);
  // the admin notice: a log SMS to ADMIN_PHONE and one POST to the fake ntfy topic
  const notice =
    await db()`select to_phone from notification where salon_id = ${s.id} and type = 'admin_nowy_salon'`;
  expect(notice).toEqual([{ to_phone: '+48500900900' }]);
  const posts = (await (await fetch(`${FAKE}/received`)).json()) as { body: string }[];
  expect(posts.some((p) => p.body.startsWith('Nowy salon: Studio Ewelina, Legnica.'))).toBe(true);

  // the public page: only the name and "Zapisy online wkrótce", noindex
  await page.goto('/studio-ewelina');
  await expect(page.getByRole('heading', { name: 'Studio Ewelina' })).toBeVisible();
  await expect(page.getByText('Zapisy online wkrótce')).toBeVisible();
  await expect(page.getByTestId('services')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  // the landing page does not list it
  await page.goto('/');
  await expect(page.getByText('Studio Ewelina')).toHaveCount(0);
});

test('a filled honeypot stores nothing; 30 pending salons stop the wizard', async ({ page, request }) => {
  await forgetSignupIps();
  const before = (await db()`select count(*)::int as n from salon`)[0].n;
  const r = await request.post('/api/signup', {
    data: {
      website: 'http://spam.example',
      phoneToken: 'x'.repeat(20),
      name: 'Spam',
      slug: 'spam',
      password: 'spam-spam-spam',
      city: 'X',
      street: '',
      teamSize: '1',
      link: '',
      about: 'x',
      team: [{ name: 'X' }],
      services: [{ name: 'X', durationMin: 30 }],
      openingHours: [{ weekday: 1, opens: '09:00', closes: '10:00' }]
    }
  });
  expect(r.status()).toBe(201);
  expect((await db()`select count(*)::int as n from salon`)[0].n).toBe(before);

  const have = (await db()`select count(*)::int as n from salon where status = 'pending'`)[0].n;
  for (let i = have; i < 30; i++) {
    await db()`insert into salon (slug, name, status, submitted_at, signup_ip)
      values (${'e2e-cap-' + i}, ${'Cap ' + i}, 'pending', now(), 'e2e-cap')`;
  }
  await page.goto('/zaloz');
  await expect(page.getByRole('alert')).toHaveText('Dużo zgłoszeń. Spróbuj jutro.');
  await page.getByLabel('Nazwa salonu').fill('Za dużo');
  await page.getByLabel('Twój telefon').fill('600 999 888');
  await page.getByLabel('Hasło').fill('haslo-haslo');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByRole('alert')).toHaveText('Dużo zgłoszeń. Spróbuj jutro.');
  await expect(page.getByRole('heading', { name: 'Załóż salon' })).toBeVisible();
  // clean up: the cap rows go, so the next specs can sign up
  await db()`delete from salon where signup_ip = 'e2e-cap'`;
});
