// S4 the whole chain in one spec (make e2e-chain): sign-up at 390 px -> "Sprawdzamy salon" -> the booking page
// says "Zapisy online wkrótce" -> the admin accepts at /admin -> the owner on the 1024 px tablet switches to
// "Czekają na mnie" -> a client books online at 390 px with the SMS code -> "Czekają na Ciebie" without a
// reload, the owner accepts -> the stylist sees her day on the phone -> the owner adds a phone visit for the
// other person while a second client fills the form for that time -> "Ten termin jest już zajęty" -> the
// reminder sweep with a moved clock writes one reminder -> the client cancels from the SMS link -> the time
// is free again -> the SMS counter equals the notification rows.
// The salon is open 7 days (the wizard default + Sunday), so the days "tomorrow" and "the day after" work any day.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { sweepReminders } from '../../src/lib/server/jobs.ts';
import { E2E_ENV } from '../../playwright.config.ts';
import { closeDb, db, FAKE, loginPassword, noHorizontalScroll, resetSalons } from './helpers.ts';

test.afterAll(closeDb);
test.setTimeout(180_000);

const SALON = 'Studio Marta';
const SLUG = 'studio-marta';
const OWNER_PHONE = '604 900 001';
const KASIA_PHONE = '604 900 002';
const PASSWORD = 'haslo-marty-2026';

const phone = (b: Browser) => b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const plusDays = (n: number) => Temporal.Now.plainDateISO('Europe/Warsaw').add({ days: n }).toString();
const at = (day: string, time: string) =>
  Temporal.PlainDate.from(day)
    .toZonedDateTime({ timeZone: 'Europe/Warsaw', plainTime: Temporal.PlainTime.from(time) })
    .toInstant();

/** A client on the booking page: service, person, day n (0 = today), 9:00; stops on the code step. */
async function toCode(page: Page, person: string, dayIndex: number, name: string, tel: string) {
  await page.goto(`/${SLUG}`);
  await page.getByRole('button', { name: /Strzyżenie damskie/ }).click();
  await expect(page.getByRole('heading', { name: 'Do kogo?' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${person}$`) }).click();
  await expect(page.getByRole('heading', { name: 'Kiedy?' })).toBeVisible();
  await expect(page.getByTestId('times')).toBeVisible();
  await page.getByTestId('days').getByRole('button').nth(dayIndex).click();
  await page.getByTestId('times').getByRole('button', { name: '9:00', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Twoje dane' })).toBeVisible();
  await page.getByLabel('Imię').fill(name);
  await page.getByLabel('Telefon').fill(tel);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByRole('heading', { name: 'Wpisz kod z SMS' })).toBeVisible();
  await expect(page.getByLabel('Cyfra 6')).not.toHaveValue(''); // SMS_ECHO=on
}

test('the whole chain: sign-up, approval, booking, waiting list, phone visit, reminder, cancel', async ({
  browser
}) => {
  await resetSalons();
  await db()`update salon set signup_ip = 'e2e-earlier' where signup_ip is not null`;
  const D1 = plusDays(1);
  const D2 = plusDays(2);

  // 1. sign-up on a 390 px phone, all steps
  const ownerPhoneCtx = await phone(browser);
  const op = await ownerPhoneCtx.newPage();
  await op.goto('/zaloz');
  await expect(op.getByText('1 z 6')).toBeVisible();
  await op.getByLabel('Nazwa salonu').fill(SALON);
  await expect(op.getByText(`beauty.vote2build.com/${SLUG}`)).toBeVisible();
  await op.getByLabel('Twój telefon').fill(OWNER_PHONE);
  await op.getByLabel('Hasło').fill(PASSWORD);
  await op.getByRole('button', { name: 'Dalej' }).click();
  await expect(op.getByRole('heading', { name: 'Wpisz kod z SMS' })).toBeVisible();
  await expect(op.getByLabel('Cyfra 6')).not.toHaveValue('');
  await op.getByRole('button', { name: 'Dalej' }).click();
  await expect(op.getByRole('heading', { name: 'O salonie' })).toBeVisible();
  await op.getByLabel('Miejscowość').fill('Legnica');
  await op.getByLabel('Ulica i numer').fill('Złotoryjska 40');
  await op.getByRole('radio', { name: '2–3' }).click();
  await op.getByLabel('Instagram, Facebook lub strona').fill('instagram.com/studio.marta');
  await op.getByLabel('Czym się zajmujecie?').fill('Fryzjer damski, koloryzacja.');
  await op.getByRole('button', { name: 'Dalej' }).click();
  await expect(op.getByRole('heading', { name: 'Co robicie?' })).toBeVisible();
  await op.getByRole('button', { name: /^Dalej/ }).click();
  await expect(op.getByRole('heading', { name: 'Kto pracuje?' })).toBeVisible();
  await expect(op.getByText('Marta', { exact: true })).toBeVisible();
  await op.getByLabel('Imię').fill('Kasia');
  await op.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await op.getByRole('button', { name: 'Dalej' }).click();
  await expect(op.getByRole('heading', { name: 'Kiedy otwarte?' })).toBeVisible();
  await op.getByRole('switch', { name: 'Niedziela' }).click(); // open 7 days
  await noHorizontalScroll(op);
  await op.getByRole('button', { name: 'Wyślij do akceptacji' }).click();
  await expect(op.getByRole('heading', { name: 'Sprawdzamy salon' })).toBeVisible();
  const [s] = await db()<{ id: string; status: string }[]>`select id, status from salon where slug = ${SLUG}`;
  expect(s.status).toBe('pending');
  const hours = await db()`select weekday from opening_hours where salon_id = ${s.id} order by weekday`;
  expect(hours.map((h) => h.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);

  // 2. the booking page of a pending salon
  await op.goto(`/${SLUG}`);
  await expect(op.getByRole('heading', { name: SALON })).toBeVisible();
  await expect(op.getByText('Zapisy online wkrótce')).toBeVisible();
  await expect(op.getByTestId('services')).toHaveCount(0);
  await ownerPhoneCtx.close();

  // 3. the admin accepts at /admin (1280 px)
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const ad = await adminCtx.newPage();
  await ad.goto('/admin');
  await ad.waitForURL('**/admin/login');
  await ad.getByLabel('Hasło').fill('e2e-admin-haslo');
  await ad.getByRole('button', { name: 'Zaloguj się' }).click();
  await ad.waitForURL('**/admin');
  const card = ad.getByTestId('salon-card').filter({ hasText: SALON });
  await expect(card).toContainText('Legnica · Złotoryjska 40');
  await expect(card).toContainText('Fryzjer damski, koloryzacja.');
  await card.getByRole('button', { name: 'Akceptuj' }).click();
  await expect(card).toHaveCount(0);
  expect((await db()`select status from salon where id = ${s.id}`)[0].status).toBe('active');
  const posts = (await (await fetch(`${FAKE}/received`)).json()) as { body: string }[];
  expect(posts.filter((p) => p.body.startsWith(`Nowy salon: ${SALON}, Legnica.`))).toHaveLength(1);
  await adminCtx.close();

  // 4. the owner on the 1024 px tablet: Kasia's phone (for her login), then "Czekają na mnie"
  const tabCtx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const tab = await tabCtx.newPage();
  await loginPassword(tab, OWNER_PHONE, PASSWORD, SLUG);
  await tab.getByRole('link', { name: 'Ustawienia' }).click();
  await tab.getByRole('link', { name: /Zespół/ }).click();
  await tab.getByTestId('person-row').filter({ hasText: 'Kasia' }).click();
  const ks = tab.getByRole('dialog', { name: 'Kasia' });
  await ks.getByLabel('Telefon').fill(KASIA_PHONE);
  await ks.getByRole('button', { name: 'Zapisz' }).click();
  await expect(tab.getByTestId('person-row').filter({ hasText: 'Kasia' })).toContainText(KASIA_PHONE);
  await tab.goto(`/${SLUG}/panel/ustawienia`);
  await tab.getByRole('radio', { name: 'Czekają na mnie' }).click();
  await expect
    .poll(
      async () => (await db()`select confirmation_mode from salon where id = ${s.id}`)[0].confirmation_mode
    )
    .toBe('manual');
  await tab.getByRole('link', { name: 'Kalendarz' }).click();
  await expect(tab.getByTestId('col-Marta')).toBeVisible();
  await expect(tab.getByTestId('badge')).toHaveCount(0);

  // 5. a client books online at 390 px with Kasia, tomorrow 9:00, with the SMS code
  const c1Ctx = await phone(browser);
  const c1 = await c1Ctx.newPage();
  await toCode(c1, 'Kasia', 1, 'Natalia Bąk', '700 900 101');
  await c1.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(c1.getByRole('heading', { name: 'Czeka na potwierdzenie salonu' })).toBeVisible();
  const [v1] = await db()<{ id: string; status: string; source: string; starts_at: Date }[]>`
    select id, status, source, starts_at from visit where salon_id = ${s.id} order by created_at desc limit 1`;
  expect(v1).toMatchObject({ status: 'oczekuje', source: 'online' });
  expect(v1.starts_at.getTime()).toBe(at(D1, '09:00').epochMilliseconds);

  // 6. "Czekają na Ciebie" without a reload; the owner accepts
  await expect(tab.getByTestId('badge')).toHaveText('1', { timeout: 15_000 });
  await tab.getByRole('link', { name: /Czekają/ }).click();
  const pc = tab.getByTestId('pending-card').filter({ hasText: 'Natalia Bąk' });
  await expect(pc).toContainText('Strzyżenie damskie');
  await pc.getByRole('button', { name: 'Przyjmij' }).click();
  await expect(pc).toHaveCount(0);
  await expect(tab.getByTestId('badge')).toHaveCount(0);
  expect((await db()`select status from visit where id = ${v1.id}`)[0].status).toBe('potwierdzona');
  // the job queue sends the client the "confirmed" SMS
  await expect
    .poll(
      async () =>
        (await db()`select 1 from notification where visit_id = ${v1.id} and type = 'potwierdzenie'`).length,
      { timeout: 15_000 }
    )
    .toBe(1);

  // 7. the stylist on her phone: her day (tomorrow) with the online visit, no owner menu
  const kCtx = await phone(browser);
  const k = await kCtx.newPage();
  await k.goto(`/login?salon=${SLUG}`);
  await k.getByLabel('Telefon').fill(KASIA_PHONE);
  await k.getByRole('button', { name: 'Dalej' }).click();
  await k.getByRole('button', { name: 'Wyślij kod SMS' }).click();
  await expect(k.getByLabel('Cyfra 6')).not.toHaveValue('');
  await k.getByRole('button', { name: 'Zaloguj się' }).click();
  await k.waitForURL(`**/${SLUG}/panel`);
  await expect(k.getByRole('navigation', { name: 'Menu' })).toHaveCount(0);
  await k.getByRole('button', { name: 'Jutro' }).click();
  await expect(k.getByTestId('my-day').getByTestId('my-visit')).toHaveCount(1);
  await expect(k.getByTestId('my-day')).toContainText('Natalia Bąk');
  await noHorizontalScroll(k);
  await kCtx.close();

  // 8. a second client fills the form for Marta, the day after tomorrow 9:00 ...
  const c2Ctx = await phone(browser);
  const c2 = await c2Ctx.newPage();
  await toCode(c2, 'Marta', 2, 'Zofia Wrona', '700 900 202');

  // ... while the owner takes a phone call: one tap on Marta's free 9:00, the side sheet, save
  await tab.goto(`/${SLUG}/panel?d=${D2}`);
  const marta = tab.getByTestId('col-Marta');
  await expect(marta).toBeVisible();
  const box = (await marta.boundingBox())!;
  await tab.mouse.click(box.x + box.width / 2, box.y + 10); // 9:00 is the top of the day
  await expect(marta.getByTestId('free')).toContainText('9:00');
  await marta.getByTestId('free').click();
  const sheet = tab.getByRole('dialog', { name: 'Nowa wizyta' });
  await expect(sheet.getByTestId('sheet-who')).toContainText('Marta');
  await sheet.getByLabel('Telefon').fill('700 900 303');
  await sheet.getByLabel('Imię').fill('Beata Kowal');
  await sheet.getByRole('button', { name: 'Strzyżenie damskie · 60 min' }).click();
  await sheet.getByRole('button', { name: 'Zapisz · 9:00–10:00' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(marta.getByTestId('visit').filter({ hasText: 'Beata Kowal' })).toContainText('9:00 – 10:00');
  const [phoneVisit] = await db()`select source, status from visit v join client c on c.id = v.client_id
    where v.salon_id = ${s.id} and c.name = 'Beata Kowal'`;
  expect(phoneVisit).toEqual({ source: 'recepcja', status: 'potwierdzona' });

  // the second client now sends the code: the time is taken
  await c2.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(c2.getByRole('heading', { name: 'Kiedy?' })).toBeVisible();
  await expect(c2.getByRole('alert')).toHaveText('Ten termin jest już zajęty');
  await c2Ctx.close();

  // 9. the reminder sweep with a moved clock (the day before at 18:00): one reminder, once
  // the sweep runs in this process: it signs links with the server's APP_SECRET and PUBLIC_URL
  process.env.APP_SECRET = E2E_ENV.APP_SECRET;
  process.env.PUBLIC_URL = E2E_ENV.PUBLIC_URL;
  const clock = () => at(plusDays(0), '18:00');
  const first = await sweepReminders(db() as never, clock);
  expect(first.reminders).toBe(1);
  expect((await sweepReminders(db() as never, clock)).reminders).toBe(0);
  const rem = await db()<{ visit_id: string; to_phone: string; body: string }[]>`
    select visit_id, to_phone, body from notification where salon_id = ${s.id} and type = 'przypomnienie'`;
  expect(rem).toHaveLength(1);
  expect(rem[0]).toMatchObject({ visit_id: v1.id, to_phone: '+48700900101' });
  expect(rem[0].body).toMatch(new RegExp(`^${SALON}: jutro .* o 09:00, Strzyzenie damskie\\. Odwolanie: `));

  // 10. the client cancels from the SMS link; the time is free again
  const link = rem[0].body.match(/https:\/\/beauty\.vote2build\.com(\/w\/\S+)$/)![1];
  await c1.goto(link);
  await expect(c1.getByTestId('status')).toHaveText('Wizyta potwierdzona');
  await c1.getByRole('link', { name: 'Odwołaj wizytę' }).click();
  await c1.getByRole('button', { name: 'Tak, odwołaj' }).click();
  await expect(c1.getByTestId('status')).toHaveText('Wizyta odwołana');
  expect((await db()`select status, cancelled_by from visit where id = ${v1.id}`)[0]).toEqual({
    status: 'odwolana',
    cancelled_by: 'klient'
  });
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  const [kasia] = await db()`select id from staff where salon_id = ${s.id} and name = 'Kasia'`;
  const av = await c1.request.get(
    `/api/${SLUG}/availability?service=${svc.id}&staff=${kasia.id}&date=${D1}&days=1`
  );
  const starts = ((await av.json()).slots as { start: string }[]).map((x) => Date.parse(x.start));
  expect(starts).toContain(v1.starts_at.getTime());
  await c1Ctx.close();

  // 11. the SMS counter on Ustawienia equals the notification rows of the salon
  const rows = await db()<{ type: string }[]>`
    select type from notification where salon_id = ${s.id} and channel = 'sms' order by created_at`;
  await tab.goto(`/${SLUG}/panel/ustawienia`);
  await expect(tab.getByTestId('sms')).toContainText(`${rows.length} z 300`);
  console.log(`chain: ${rows.length} SMS rows: ${rows.map((r) => r.type).join(', ')}`);
  await tabCtx.close();
});
