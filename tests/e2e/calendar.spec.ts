// S2.C4 at 1024 px: tap a free time in a person's column, fill the side sheet (phone with the returning-client
// suggestion, name, service), save; drag the visit to another person; a drop onto an occupied time is
// refused with a Polish message and the card goes back; cancel frees the time.
// The salon is open 7 days 9-18 and the spec works on tomorrow, so the weekday and the hour do not matter.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  closeDb,
  db,
  loginPassword,
  makeActiveSalon,
  noHorizontalScroll,
  tomorrowWarsaw
} from './helpers.ts';

test.use({ viewport: { width: 1024, height: 768 } });
test.afterAll(closeDb);

const at = (day: string, time: string) =>
  Temporal.PlainDate.from(day)
    .toZonedDateTime({ timeZone: 'Europe/Warsaw', plainTime: Temporal.PlainTime.from(time) })
    .toInstant()
    .toString();

/** The point in a column at a local time (9:00 = the top, 64 px per hour). */
async function pointAt(col: Locator, hours: number) {
  const box = (await col.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + (hours - 9) * 64 + 20 };
}

async function drag(page: Page, card: Locator, to: { x: number; y: number }) {
  const b = (await card.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 12);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + 20, { steps: 3 });
  await page.mouse.move(to.x, to.y - 8, { steps: 8 });
  await page.mouse.up();
}

test('add, drag, refused drop, cancel', async ({ page }) => {
  await db()`delete from salon where slug = 'kal-e2e'`;
  const s = await makeActiveSalon('kal-e2e', 601100000);
  const day = tomorrowWarsaw();
  // a returning client with 2 past visits
  const [c] =
    await db()`insert into client (salon_id, name, phone) values (${s.id}, 'Anna Nowak', '+48601223908')
    returning id`;
  const [svc] = await db()`select id from service where salon_id = ${s.id} and name = 'Strzyżenie damskie'`;
  for (const d of [40, 20]) {
    const past = Temporal.Now.plainDateISO('Europe/Warsaw').subtract({ days: d }).toString();
    await db()`insert into visit (salon_id, client_id, staff_id, service_id, starts_at, ends_at, blocked_until,
        status, source)
      values (${s.id}, ${c.id}, ${s.owner}, ${svc.id}, ${at(past, '10:00')}, ${at(past, '11:00')},
        ${at(past, '11:00')}, 'zakonczona', 'recepcja')`;
  }

  await loginPassword(page, '601 100 001', 'haslo-wlascicielki', 'kal-e2e');
  await page.goto(`/kal-e2e/panel?d=${day}`);
  const ola = page.getByTestId('col-Ola');
  const kasia = page.getByTestId('col-Kasia');
  await expect(ola).toBeVisible();
  await noHorizontalScroll(page);

  // tap a free time: "+ Dodaj wizytę" at 10:00, then the side sheet
  const p = await pointAt(ola, 10);
  await page.mouse.click(p.x, p.y);
  await expect(ola.getByTestId('free')).toContainText('+ Dodaj wizytę');
  await expect(ola.getByTestId('free')).toContainText('10:00');
  await ola.getByTestId('free').click();
  const sheet = page.getByRole('dialog', { name: 'Nowa wizyta' });
  await expect(sheet.getByTestId('sheet-who')).toContainText('Ola');
  await expect(sheet.getByTestId('sheet-who')).toContainText('10:00');
  await sheet.getByLabel('Telefon').pressSequentially('60122');
  await expect(sheet.getByTestId('client-hint')).toContainText('Anna Nowak');
  await expect(sheet.getByTestId('client-hint')).toContainText('601 223 908 · była 2 razy');
  await sheet.getByTestId('client-hint').click();
  await expect(sheet.getByLabel('Imię')).toHaveValue('Anna Nowak');
  await sheet.getByRole('button', { name: 'Strzyżenie damskie · 60 min' }).click();
  await sheet.getByRole('button', { name: 'Zapisz · 10:00–11:00' }).click();
  await expect(sheet).toHaveCount(0);
  const card = ola.getByTestId('visit').filter({ hasText: 'Anna Nowak' });
  await expect(card).toContainText('10:00 – 11:00');
  let [v] = await db()`select id, staff_id, client_id, starts_at, status from visit
    where salon_id = ${s.id} and starts_at > now() order by created_at desc limit 1`;
  expect(v).toMatchObject({ staff_id: s.owner, client_id: c.id, status: 'potwierdzona' });
  expect(v.starts_at.toISOString()).toBe(new Date(at(day, '10:00')).toISOString());

  // drag to Kasia at the same time
  await drag(page, card, await pointAt(kasia, 10));
  const moved = kasia.getByTestId('visit').filter({ hasText: 'Anna Nowak' });
  await expect(moved).toContainText('10:00 – 11:00');
  await expect
    .poll(async () => (await db()`select staff_id from visit where id = ${v.id}`)[0].staff_id)
    .toBe(s.kasia);

  // Ola is busy at 12:00; a drop of Kasia's card there is refused, the card goes back
  const r = await page.request.post('/api/kal-e2e/visits', {
    data: { serviceId: svc.id, staffId: s.owner, start: at(day, '12:00'), client: { name: 'Beata Kowal' } }
  });
  expect(r.status()).toBe(200);
  await page.reload();
  await expect(ola.getByTestId('visit').filter({ hasText: 'Beata Kowal' })).toBeVisible();
  await drag(page, kasia.getByTestId('visit').filter({ hasText: 'Anna Nowak' }), await pointAt(ola, 12));
  await expect(page.getByTestId('toast')).toHaveText('Ten termin jest już zajęty. Wybierz inny.');
  await expect(kasia.getByTestId('visit').filter({ hasText: 'Anna Nowak' })).toContainText('10:00 – 11:00');
  await expect(ola.getByTestId('visit').filter({ hasText: 'Anna Nowak' })).toHaveCount(0);
  [v] = await db()`select staff_id, starts_at from visit where id = ${v.id}`;
  expect(v.staff_id).toBe(s.kasia);
  expect(v.starts_at.toISOString()).toBe(new Date(at(day, '10:00')).toISOString());

  // the visit card: cancel frees the time
  await kasia.getByTestId('visit').filter({ hasText: 'Anna Nowak' }).click();
  const vs = page.getByRole('dialog', { name: 'Anna Nowak' });
  await expect(vs).toContainText('Strzyżenie damskie');
  await vs.getByRole('button', { name: 'Odwołaj wizytę' }).click();
  await expect(kasia.getByTestId('visit')).toHaveCount(0);
  const [gone] =
    await db()`select status, cancelled_by from visit where salon_id = ${s.id} and client_id = ${c.id}
    and starts_at > now()`;
  expect(gone).toEqual({ status: 'odwolana', cancelled_by: 'salon' });
  const k = await pointAt(kasia, 10);
  await page.mouse.click(k.x, k.y);
  await expect(kasia.getByTestId('free')).toContainText('10:00');
});
