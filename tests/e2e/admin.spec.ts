// S2.C2: the admin logs in at /admin, sees the new salon with every "O salonie" field and accepts it: the
// salon is active, its page lists services, the owner gets one SMS and the admin got one notice (log SMS +
// POST to the fake ntfy). A second salon is rejected: its owner login is refused in Polish, and the purge
// with a moved clock deletes it after 30 days.
import { expect, test } from '@playwright/test';
import { purgeRejected } from '../../src/lib/server/approval.ts';
import { closeDb, db, FAKE, forgetSignupIps, signupApi } from './helpers.ts';

test.use({ viewport: { width: 1280, height: 820 } });
test.afterAll(closeDb);

test('accept one salon, reject another, purge after 30 days', async ({ page, request }) => {
  await db()`delete from salon where phone in ('+48512900211', '+48698441020')`;
  await forgetSignupIps();
  await fetch(`${FAKE}/received`, { method: 'DELETE' });
  const a = await signupApi(request, 'Barber Rynek', '512 900 211');
  const b = await signupApi(request, 'Nails by Kasia', '698 441 020', {
    city: 'Chojnów',
    street: 'Legnicka 3',
    link: 'nailsbykasia.pl',
    about: 'Manicure hybrydowy, pedicure.'
  });
  expect(a.status).toBe('pending');

  // wrong password first, then the right one
  await page.goto('/admin');
  await page.waitForURL('**/admin/login');
  await page.getByLabel('Hasło').fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page.getByRole('alert')).toHaveText('Nieprawidłowe hasło.');
  await page.getByLabel('Hasło').fill('e2e-admin-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL('**/admin');

  const card = page.getByTestId('salon-card').filter({ hasText: 'Barber Rynek' });
  await expect(card).toContainText('Legnica · Rynek 7');
  await expect(card).toContainText('Strzyżenie męskie i broda.');
  await expect(card).toContainText('1 os.');
  await expect(card).toContainText('512 900 211');
  await expect(card.getByRole('link', { name: 'facebook.com/barberrynek' })).toHaveAttribute(
    'href',
    'https://facebook.com/barberrynek'
  );
  await expect(card).toContainText(/dziś \d{1,2}:\d{2}/);
  await card.getByRole('button', { name: 'Akceptuj' }).click();
  await expect(card).toHaveCount(0);

  const [sa] = await db()`select status, decided_at from salon where id = ${a.id}`;
  expect(sa.status).toBe('active');
  await page.goto(`/${a.slug}`);
  await expect(page.getByTestId('services')).toContainText('Strzyżenie męskie');
  await expect(page.getByText('Zapisy online wkrótce')).toHaveCount(0);

  const ownerSms =
    await db()`select body from notification where salon_id = ${a.id} and type = 'salon_przyjety'`;
  expect(ownerSms).toHaveLength(1);
  expect(ownerSms[0].body).toBe(
    `Salon przyjety. Zapisy online dzialaja: https://beauty.vote2build.com/${a.slug}`
  );
  const adminSms =
    await db()`select to_phone from notification where salon_id = ${a.id} and type = 'admin_nowy_salon'`;
  expect(adminSms).toEqual([{ to_phone: '+48500900900' }]);
  const posts = (await (await fetch(`${FAKE}/received`)).json()) as { path: string; body: string }[];
  expect(posts.filter((p) => p.body.startsWith('Nowy salon: Barber Rynek, Legnica.'))).toHaveLength(1);
  expect(posts[0].path).toBe('/beauty-admin');

  // reject the second one with a reason
  await page.goto('/admin');
  const card2 = page.getByTestId('salon-card').filter({ hasText: 'Nails by Kasia' });
  await expect(card2).toContainText('Chojnów · Legnicka 3');
  await card2.getByRole('button', { name: 'Odrzuć' }).click();
  await card2.getByPlaceholder('Powód (można pominąć)').fill('Brak salonu pod adresem.');
  await card2.getByRole('button', { name: 'Odrzuć salon' }).click();
  await expect(card2).toHaveCount(0);
  await page.getByRole('button', { name: /^Odrzucone · / }).click();
  await expect(page.getByTestId('salon-card').filter({ hasText: 'Nails by Kasia' })).toContainText(
    'Powód: Brak salonu pod adresem.'
  );
  const [sb] = await db()`select status, reject_reason, decided_at from salon where id = ${b.id}`;
  expect(sb).toMatchObject({ status: 'rejected', reject_reason: 'Brak salonu pod adresem.' });
  const rejSms =
    await db()`select body from notification where salon_id = ${b.id} and type = 'salon_odrzucony'`;
  expect(rejSms).toHaveLength(1);
  const audit = await db()`select action, salon_slug from admin_audit where salon_id in (${a.id}, ${b.id})
    order by created_at`;
  expect(audit.map((x) => `${x.action}:${x.salon_slug}`)).toEqual([`accept:${a.slug}`, `reject:${b.slug}`]);

  // the rejected owner cannot log in
  const owner = await page.context().browser()!.newContext({ baseURL: 'http://localhost:8151' });
  const op = await owner.newPage();
  await op.goto(`/login?salon=${b.slug}`);
  await op.getByLabel('Telefon').fill('698 441 020');
  await op.getByRole('button', { name: 'Dalej' }).click();
  await op.getByRole('button', { name: 'Mam hasło' }).click();
  await op.getByLabel('Hasło').fill('haslo-wlascicielki');
  await op.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(op.getByRole('alert')).toHaveText('Ten salon nie został przyjęty.');
  await op.getByRole('button', { name: 'Wstecz' }).click();
  await op.getByRole('button', { name: 'Wyślij kod SMS' }).click();
  await expect(op.getByRole('alert')).toHaveText('Ten salon nie został przyjęty.');
  await owner.close();

  // the purge with a moved clock: 29 days keep it, 30 days delete it and its data
  const decided = Temporal.Instant.from(sb.decided_at.toISOString());
  expect(await purgeRejected(db() as never, decided.add({ hours: 24 * 29 }))).not.toContain(b.slug);
  // (+1 s: the DB keeps microseconds, a JS Date only milliseconds)
  expect(await purgeRejected(db() as never, decided.add({ hours: 24 * 30, seconds: 1 }))).toContain(b.slug);
  expect(await db()`select 1 from salon where id = ${b.id}`).toHaveLength(0);
  expect(await db()`select 1 from service where salon_id = ${b.id}`).toHaveLength(0);
  const [kept] = await db()`select salon_name from admin_audit where salon_id = ${b.id} and action = 'purge'`;
  expect(kept.salon_name).toBe('Nails by Kasia');
  // the accepted one stays
  expect(await db()`select 1 from salon where id = ${a.id}`).toHaveLength(1);
});

test('/admin without the admin cookie goes to the login; the API answers 401', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForURL('**/admin/login');
  const r = await page.request.get('/api/admin/salons');
  expect(r.status()).toBe(401);
});
