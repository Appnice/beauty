// S3 client booking at 390 px, own server and fresh DB, SMS_ECHO=on (the code fills the boxes).
// S2.C1 automatic mode -> "Wizyta potwierdzona" and the visit in the panel with source 'online'.
// S2.C2 manual mode -> "Czeka na potwierdzenie salonu", the owner accepts, the visit page shows confirmed,
//        one notification row for each SMS of the flow.
// S2.C3 the SMS link: cancel, the time is free again; a changed link is a 404 that leaks nothing; a pending
//        salon offers no booking.
// S2.C4 a time taken while the client types: "Ten termin jest już zajęty", a fresh list, no new code.
// Times come from the engine and the real clock: the specs take the first time offered, never a fixed hour.
import { expect, test, type Page } from '@playwright/test';
import { closeDb, db, loginPassword, makeActiveSalon, signupApi, BASE } from './helpers.ts';

test.describe.configure({ mode: 'serial' });
test.afterAll(closeDb);
test.beforeEach(async ({ page }) => {
  await db()`delete from rate_limit`;
  await page.setViewportSize({ width: 390, height: 844 });
});

/** The client walks the page: service, person, the first free time, name + phone; stops on the code step. */
async function toCode(page: Page, slug: string, person: string, name: string, phone: string) {
  await page.goto(`/${slug}`);
  await page.getByRole('button', { name: /Strzyżenie damskie/ }).click();
  await expect(page.getByRole('heading', { name: 'Do kogo?' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${person}$`) }).click();
  await expect(page.getByRole('heading', { name: 'Kiedy?' })).toBeVisible();
  const first = page.getByTestId('times').getByRole('button').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole('heading', { name: 'Twoje dane' })).toBeVisible();
  await page.getByLabel('Imię').fill(name);
  await page.getByLabel('Telefon').fill(phone);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByRole('heading', { name: 'Wpisz kod z SMS' })).toBeVisible();
  // SMS_ECHO=on: the code is in the boxes
  await expect(page.getByLabel('Cyfra 6')).not.toHaveValue('');
}

async function lastVisit(salonId: string) {
  const [v] = await db()<{ id: string; status: string; source: string; starts_at: Date; staff: string }[]>`
    select v.id, v.status, v.source, v.starts_at, st.name as staff from visit v join staff st on st.id = v.staff_id
    where v.salon_id = ${salonId} order by v.created_at desc limit 1`;
  return v;
}

async function waitForTypes(salonId: string, want: string[]) {
  let got: string[] = [];
  for (let i = 0; i < 60; i++) {
    got = (
      await db()<
        { type: string }[]
      >`select type from notification where salon_id = ${salonId} order by created_at`
    ).map((r) => r.type);
    if (want.every((w) => got.includes(w))) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return got;
}

/** The SMS link from a notification body, on the test server. */
async function smsLink(salonId: string, type: string): Promise<string> {
  const [n] = await db()<{ body: string }[]>`
    select body from notification where salon_id = ${salonId} and type = ${type} order by created_at desc limit 1`;
  const m = n.body.match(/https:\/\/beauty\.appnice\.dev(\/w\/\S+)$/);
  expect(m, n.body).toBeTruthy();
  return m![1];
}

const daysFromToday = (d: Date) => {
  const today = Temporal.Now.plainDateISO('Europe/Warsaw');
  const day = Temporal.Instant.from(d.toISOString()).toZonedDateTimeISO('Europe/Warsaw').toPlainDate();
  return today.until(day).days;
};

test('S2.C1 automatic mode: book with a chosen person, verify the phone, "Wizyta potwierdzona", in the panel', async ({
  page,
  browser
}) => {
  await db()`delete from salon where slug = 'rez-auto'`;
  const s = await makeActiveSalon('rez-auto', 604300000);
  await toCode(page, 'rez-auto', 'Kasia', 'Natalia Bąk', '700 300 101');
  await page.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(page.getByRole('heading', { name: 'Wizyta potwierdzona' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dodaj do kalendarza' })).toHaveAttribute('href', /\/ics$/);
  const v = await lastVisit(s.id);
  expect(v).toMatchObject({ status: 'potwierdzona', source: 'online', staff: 'Kasia' });

  // the .ics file of the result screen
  const href = await page.getByRole('link', { name: 'Dodaj do kalendarza' }).getAttribute('href');
  const ics = await page.request.get(href!);
  expect(ics.headers()['content-type']).toContain('text/calendar');
  expect(await ics.text()).toContain('SUMMARY:Strzyżenie damskie · Salon rez-auto');

  // the owner sees it in her calendar, in Kasia's column, marked as online
  const owner = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await loginPassword(owner, '604 300 001', 'haslo-wlascicielki', 'rez-auto');
  for (let i = daysFromToday(v.starts_at); i > 0; i--)
    await owner.getByRole('button', { name: 'Następny dzień' }).click();
  const card = owner.locator(`[data-visit="${v.id}"]`);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-source', 'online');
  await expect(card).toContainText('Natalia Bąk');
  await expect(owner.getByTestId('col-Kasia').locator(`[data-visit="${v.id}"]`)).toHaveCount(1);
  await owner.close();
});

test('S2.C2 manual mode: waits, the owner accepts, the visit page shows confirmed, one row per SMS', async ({
  page,
  browser
}) => {
  await db()`delete from salon where slug = 'rez-reczny'`;
  const s = await makeActiveSalon('rez-reczny', 604400000, { manual: true });
  await toCode(page, 'rez-reczny', 'Ola', 'Monika Sikora', '700 400 101');
  await page.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(page.getByRole('heading', { name: 'Czeka na potwierdzenie salonu' })).toBeVisible();
  const v = await lastVisit(s.id);
  expect(v).toMatchObject({ status: 'oczekuje', source: 'online' });
  await page.getByRole('link', { name: 'Zobacz wizytę' }).click();
  await expect(page.getByTestId('status')).toHaveText('Czeka na potwierdzenie salonu');
  const statusUrl = page.url();
  // the client gets the "waits" SMS before the owner decides
  expect(await waitForTypes(s.id, ['oczekuje'])).toEqual(['kod_klient', 'oczekuje']);

  const owner = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await loginPassword(owner, '604 400 001', 'haslo-wlascicielki', 'rez-reczny');
  await owner.getByRole('link', { name: /Czekają/ }).click();
  const card = owner.getByTestId('pending-card').filter({ hasText: 'Monika Sikora' });
  await card.getByRole('button', { name: 'Przyjmij' }).click();
  await expect(card).toHaveCount(0);
  await owner.close();

  await page.goto(statusUrl);
  await expect(page.getByTestId('status')).toHaveText('Wizyta potwierdzona');
  const types = await waitForTypes(s.id, ['kod_klient', 'oczekuje', 'potwierdzenie']);
  expect(types).toEqual(['kod_klient', 'oczekuje', 'potwierdzenie']);
  const rows = await db()<{ to_phone: string; body: string; status: string }[]>`
    select to_phone, body, status from notification where salon_id = ${s.id}`;
  for (const r of rows) {
    expect(r).toMatchObject({ to_phone: '+48700400101', status: 'logged' });
    expect(r.body.length).toBeLessThanOrEqual(160);
    expect(r.body).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
  }
});

test('S2.C3 the SMS link: cancel frees the time; a changed link is a 404; a pending salon has no booking', async ({
  page,
  request
}) => {
  await db()`delete from salon where slug = 'rez-odwolaj'`;
  const s = await makeActiveSalon('rez-odwolaj', 604500000);
  await toCode(page, 'rez-odwolaj', 'Kasia', 'Ewa Lis', '700 500 101');
  await page.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(page.getByRole('heading', { name: 'Wizyta potwierdzona' })).toBeVisible();
  const v = await lastVisit(s.id);
  await waitForTypes(s.id, ['potwierdzenie']);
  const link = await smsLink(s.id, 'potwierdzenie');

  // the short link from the SMS opens the visit page
  await page.goto(link);
  await expect(page).toHaveURL(new RegExp(`/rez-odwolaj/wizyta/`));
  await expect(page.getByTestId('status')).toHaveText('Wizyta potwierdzona');
  await page.getByRole('link', { name: 'Odwołaj wizytę' }).click();
  await expect(page.getByRole('heading', { name: 'Odwołać wizytę?' })).toBeVisible();
  await page.getByRole('button', { name: 'Tak, odwołaj' }).click();
  await expect(page.getByTestId('status')).toHaveText('Wizyta odwołana');
  expect((await db()`select status, cancelled_by from visit where id = ${v.id}`)[0]).toEqual({
    status: 'odwolana',
    cancelled_by: 'klient'
  });
  // the time is offered again
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  const day = Temporal.Instant.from(v.starts_at.toISOString())
    .toZonedDateTimeISO('Europe/Warsaw')
    .toPlainDate();
  const av = await request.get(
    `/api/rez-odwolaj/availability?service=${svc.id}&staff=${s.kasia}&date=${day}&days=1`
  );
  expect(((await av.json()).slots as { start: string }[]).map((x) => Date.parse(x.start))).toContain(
    v.starts_at.getTime()
  );
  // "Zarezerwuj ponownie" opens the booking page at "Kiedy?" with the same service and person
  await page.getByRole('link', { name: 'Zarezerwuj ponownie' }).click();
  await expect(page.getByRole('heading', { name: 'Kiedy?' })).toBeVisible();
  await expect(page.getByText('Strzyżenie damskie · Kasia')).toBeVisible();

  // a changed link: 404, no salon name, no visit data
  const token = link.split('/w/')[1];
  const bad = token.slice(0, -3) + (token.endsWith('xyz') ? 'abc' : 'xyz');
  const short = await request.get(`/w/${bad}`, { maxRedirects: 0 });
  expect(short.status()).toBe(404);
  expect(await short.text()).toBe('Nie znaleziono wizyty.');
  const res = await page.goto(`/rez-odwolaj/wizyta/${bad}`);
  expect(res!.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Nie znaleziono wizyty.' })).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Salon rez-odwolaj');
  expect(body).not.toContain('Ewa Lis');
  expect(body).not.toContain('Strzyżenie');
  const api = await request.get(`${BASE}/api/rez-odwolaj/booking/${bad}`);
  expect(api.status()).toBe(404);

  // a pending salon: the name and "Zapisy online wkrótce", noindex, nothing to book
  await db()`delete from salon where phone = '+48604500900'`;
  const p = await signupApi(request, 'Barber Czeka', '604 500 900');
  expect(p.status).toBe('pending');
  await page.goto(`/${p.slug}`);
  await expect(page.getByRole('heading', { name: 'Barber Czeka' })).toBeVisible();
  await expect(page.getByText('Zapisy online wkrótce')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByTestId('services')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  const code = await request.post(`/api/${p.slug}/booking/code`, { data: { phone: '700500102' } });
  expect(code.status()).toBe(403);
});

test('S2.C4 a time taken while the client types: "Ten termin jest już zajęty", a fresh list, no new code', async ({
  page,
  request
}) => {
  await db()`delete from salon where slug = 'rez-wyscig'`;
  const s = await makeActiveSalon('rez-wyscig', 604600000);
  await toCode(page, 'rez-wyscig', 'Kasia', 'Zofia Wrona', '700 600 101');
  const wanted = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('beauty-booking-rez-wyscig')!).start
  );
  // someone else takes the same time with Kasia first
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  const c = await request.post('/api/rez-wyscig/booking/code', { data: { phone: '700600102' } });
  const other = await request.post('/api/rez-wyscig/booking', {
    data: {
      serviceId: svc.id,
      staffId: s.kasia,
      start: wanted,
      name: 'Inna Klientka',
      phone: '700600102',
      code: (await c.json()).code
    }
  });
  expect(other.status()).toBe(200);

  await page.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(page.getByRole('heading', { name: 'Kiedy?' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Ten termin jest już zajęty');
  await expect(page.getByTestId('times').getByRole('button').first()).toBeVisible();
  expect(await page.title()).toBe('Salon rez-wyscig'); // the booking page, not an error page
  const day = Temporal.Instant.from(wanted).toZonedDateTimeISO('Europe/Warsaw').toPlainDate();
  const av = await request.get(
    `/api/rez-wyscig/availability?service=${svc.id}&staff=${s.kasia}&date=${day}&days=1`
  );
  expect(((await av.json()).slots as { start: string }[]).map((x) => Date.parse(x.start))).not.toContain(
    Date.parse(wanted)
  );
  const [codesBefore] = await db()<{ n: number }[]>`
    select count(*)::int as n from notification where salon_id = ${s.id} and type = 'kod_klient' and to_phone = '+48700600101'`;
  // the fresh list has no taken time; the first free time, then straight to booking with the verified phone
  await page.getByTestId('times').getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: 'Twoje dane' })).toBeVisible();
  await page.getByRole('button', { name: 'Zarezerwuj' }).click();
  await expect(page.getByRole('heading', { name: 'Wizyta potwierdzona' })).toBeVisible();
  const [codesAfter] = await db()<{ n: number }[]>`
    select count(*)::int as n from notification where salon_id = ${s.id} and type = 'kod_klient' and to_phone = '+48700600101'`;
  expect(codesAfter.n).toBe(codesBefore.n);
  expect(codesAfter.n).toBe(1);
  const v = await lastVisit(s.id);
  expect(v.starts_at.getTime()).not.toBe(Date.parse(wanted));
});
