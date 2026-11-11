// S2.C5: an online visit on an active salon in "Czekają na mnie" mode shows in "Czekają na Ciebie" and the
// badge goes up without a reload; "Przyjmij" confirms, "Odrzuć" frees the time. A stylist logs in at 390 px,
// sees only her own visits today and tomorrow, adds and removes her own block, and cannot open owner pages.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { closeDb, db, loginPassword, makeActiveSalon, tomorrowWarsaw } from './helpers.ts';

test.afterAll(closeDb);

const at = (day: string, time: string) =>
  Temporal.PlainDate.from(day)
    .toZonedDateTime({ timeZone: 'Europe/Warsaw', plainTime: Temporal.PlainTime.from(time) })
    .toInstant()
    .toString();

/** A client books online: the first start the engine offers from tomorrow (not a fixed hour). */
async function bookOnline(
  request: APIRequestContext,
  slug: string,
  serviceId: string,
  phone: string,
  name: string
) {
  const av = await request.get(
    `/api/${slug}/availability?service=${serviceId}&date=${tomorrowWarsaw()}&days=7`
  );
  expect(av.status()).toBe(200);
  const slot = (await av.json()).slots[0] as { start: string };
  expect(slot, 'the engine offers a start').toBeTruthy();
  const code = await request.post(`/api/${slug}/booking/code`, { data: { phone } });
  const r = await request.post(`/api/${slug}/booking`, {
    data: { serviceId, start: slot.start, name, phone, code: (await code.json()).code }
  });
  expect(r.status(), await r.text()).toBe(200);
  return { start: slot.start, id: (await r.json()).visit.id as string };
}

test('waiting online visits: badge without reload, accept, reject', async ({ page, request }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await db()`delete from salon where slug = 'czeka-e2e'`;
  const s = await makeActiveSalon('czeka-e2e', 602200000, { manual: true });
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  await loginPassword(page, '602 200 001', 'haslo-wlascicielki', 'czeka-e2e');
  await expect(page.getByTestId('badge')).toHaveCount(0);

  const first = await bookOnline(request, 'czeka-e2e', svc.id, '700 100 201', 'Natalia Bąk');
  await expect(page.getByTestId('badge')).toHaveText('1', { timeout: 15_000 });
  const second = await bookOnline(request, 'czeka-e2e', svc.id, '700 100 202', 'Monika Sikora');
  await expect(page.getByTestId('badge')).toHaveText('2', { timeout: 15_000 });

  await page.getByRole('link', { name: /Czekają/ }).click();
  await expect(page.getByRole('heading', { name: 'Czekają na Ciebie 2' })).toBeVisible();
  const c1 = page.getByTestId('pending-card').filter({ hasText: 'Natalia Bąk' });
  await expect(c1).toContainText('700 100 201');
  await expect(c1).toContainText('Strzyżenie damskie');
  await c1.getByRole('button', { name: 'Przyjmij' }).click();
  await expect(c1).toHaveCount(0);
  await expect(page.getByTestId('badge')).toHaveText('1');
  expect((await db()`select status from visit where id = ${first.id}`)[0].status).toBe('potwierdzona');

  const c2 = page.getByTestId('pending-card').filter({ hasText: 'Monika Sikora' });
  await c2.getByRole('button', { name: 'Odrzuć' }).click();
  await expect(c2).toHaveCount(0);
  await expect(page.getByTestId('badge')).toHaveCount(0);
  await expect(page.getByText('Nic nie czeka.')).toBeVisible();
  expect((await db()`select status from visit where id = ${second.id}`)[0].status).toBe('odwolana');
  // the rejected start is free again for the engine
  const av = await request.get(
    `/api/czeka-e2e/availability?service=${svc.id}&date=${tomorrowWarsaw()}&days=7`
  );
  const starts = ((await av.json()).slots as { start: string }[]).map((x) => x.start);
  expect(starts).toContain(second.start);
});

test('stylist on a phone: my day, my block, no owner pages', async ({ browser }) => {
  await db()`delete from salon where slug = 'kasia-e2e'`;
  const s = await makeActiveSalon('kasia-e2e', 603300000);
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  const today = Temporal.Now.plainDateISO('Europe/Warsaw').toString();
  const tomorrow = tomorrowWarsaw();
  const add = async (staff: string, day: string, time: string, name: string) => {
    const [c] = await db()`insert into client (salon_id, name) values (${s.id}, ${name}) returning id`;
    const end = Temporal.Instant.from(at(day, time)).add({ minutes: 60 }).toString();
    await db()`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until,
        status, source)
      values (${s.id}, ${c.id}, ${staff}, ${svc.id}, ${at(day, time)}, ${end}, ${end}, 'potwierdzona', 'recepcja')`;
  };
  await add(s.kasia, today, '10:00', 'Iza Kubiak');
  await add(s.kasia, tomorrow, '11:00', 'Dorota Pawlak');
  await add(s.owner, today, '10:00', 'Klientka Oli');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/login?salon=kasia-e2e');
  await page.getByLabel('Telefon').fill('603 300 002');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Wyślij kod SMS' }).click();
  await expect(page.getByLabel('Cyfra 6')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL('**/kasia-e2e/panel');

  const list = page.getByTestId('my-day');
  await expect(list.getByTestId('my-visit')).toHaveCount(1);
  await expect(list).toContainText('Iza Kubiak');
  await expect(list).not.toContainText('Klientka Oli');
  await expect(page.getByRole('navigation', { name: 'Menu' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Jutro' }).click();
  await expect(list).toContainText('Dorota Pawlak');
  await expect(list).not.toContainText('Iza Kubiak');

  // my own block on tomorrow, then remove it
  await page.getByRole('button', { name: 'Przerwa' }).click();
  const sheet = page.getByRole('dialog', { name: 'Przerwa' });
  await sheet.getByRole('radio', { name: 'Szkolenie' }).click();
  await sheet.getByLabel('Od').selectOption({ label: '14:00' });
  await sheet.getByLabel('Do').selectOption({ label: '16:00' });
  await sheet.getByRole('button', { name: /^Zapisz/ }).click();
  await expect(list.getByTestId('my-block')).toContainText('14:00 – 16:00');
  await expect(list.getByTestId('my-block')).toContainText('Szkolenie');
  const blocks = await db()`select staff_id, reason, created_by from block where salon_id = ${s.id}`;
  expect(blocks).toEqual([{ staff_id: s.kasia, reason: 'Szkolenie', created_by: s.kasia }]);
  await list.getByRole('button', { name: /^Usuń: Szkolenie/ }).click();
  await expect(list.getByTestId('my-block')).toHaveCount(0);
  expect(await db()`select 1 from block where salon_id = ${s.id}`).toHaveLength(0);

  // owner pages are closed
  for (const path of ['ustawienia', 'czekaja', 'tydzien', 'ustawienia/zespol']) {
    // the panel renders in the browser: the layout guard (server load) answers with the 403 error page
    await page.goto(`/kasia-e2e/panel/${path}`);
    await expect(page.getByRole('heading', { name: 'Nie masz do tego uprawnień.' })).toBeVisible();
    await expect(page.getByText('Nie masz do tego uprawnień.')).toBeVisible();
    await expect(page.getByText('Ustawienia')).toHaveCount(0);
  }
  expect((await page.request.get('/api/kasia-e2e/clients')).status()).toBe(403);
  expect((await page.request.get('/api/kasia-e2e/pending')).status()).toBe(403);
  await ctx.close();
});
