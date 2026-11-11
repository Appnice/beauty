// Browser smoke of a running instance: headless Chromium, the production build and its headers (CSP).
//   node tools/deploy-browser-smoke.ts <base url>
// Fails on any console error or securitypolicyviolation event. Checks that the pages hydrate:
// /zaloz (the auto address follows the typed name), /demo/panel (demo manager login, calendar columns),
// /admin (login, 'Nowe salony'; only with env ADMIN_PASSWORD), /demo (the booking page lists services).
// Env: ADMIN_PASSWORD, DEMO_MANAGER_PASSWORD (demo1234), DEMO_PHONE (500 000 001). Never prints a password.
import { chromium, expect, type Page } from '@playwright/test';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node tools/deploy-browser-smoke.ts <base url>');
  process.exit(2);
}
const problems: string[] = [];
let checks = 0;
const ok = (m: string) => console.log(`browser-smoke: ok   ${m} (${++checks})`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: 'pl-PL', timezoneId: 'Europe/Warsaw' });
await ctx.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
  });
});

function watch(page: Page, name: string): void {
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`${name}: console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${name}: page error: ${e.message}`));
}

try {
  const p1 = await ctx.newPage();
  watch(p1, '/zaloz');
  await p1.setViewportSize({ width: 390, height: 844 });
  await p1.goto(`${base}/zaloz`);
  await p1.getByLabel('Nazwa salonu').fill('Studio Smoke Próba');
  await expect(p1.getByText('beauty.appnice.dev/studio-smoke-proba')).toBeVisible({ timeout: 10_000 });
  ok('/zaloz hydrates: the address follows the typed name');

  const p2 = await ctx.newPage();
  watch(p2, '/demo/panel');
  await p2.setViewportSize({ width: 1024, height: 768 });
  await p2.goto(`${base}/login?salon=demo`);
  await p2.getByLabel('Telefon').fill(process.env.DEMO_PHONE ?? '500 000 001');
  await p2.getByRole('button', { name: 'Dalej' }).click();
  await p2.getByRole('button', { name: 'Mam hasło' }).click();
  await p2.getByLabel('Hasło').fill(process.env.DEMO_MANAGER_PASSWORD ?? 'demo1234');
  await p2.getByRole('button', { name: 'Zaloguj się' }).click();
  await p2.waitForURL('**/demo/panel**', { timeout: 15_000 });
  await expect(p2.getByTestId('col-head').first()).toBeVisible({ timeout: 15_000 });
  ok(`/demo/panel: logged in, ${await p2.getByTestId('col-head').count()} calendar columns`);

  if (process.env.ADMIN_PASSWORD) {
    const p3 = await ctx.newPage();
    watch(p3, '/admin');
    await p3.setViewportSize({ width: 1280, height: 800 });
    await p3.goto(`${base}/admin/login`);
    await p3.getByLabel('Hasło').fill(process.env.ADMIN_PASSWORD);
    await p3.getByRole('button', { name: 'Zaloguj się' }).click();
    await expect(p3.getByText('Nowe salony').first()).toBeVisible({ timeout: 15_000 });
    ok("/admin: logged in, 'Nowe salony' shows");
  } else console.log('browser-smoke: skip /admin (ADMIN_PASSWORD not set)');

  const p4 = await ctx.newPage();
  watch(p4, '/demo');
  await p4.setViewportSize({ width: 390, height: 844 });
  await p4.goto(`${base}/demo`);
  await expect(p4.getByTestId('services')).toContainText('Strzyżenie', { timeout: 10_000 });
  ok('/demo booking page lists services');
} catch (e) {
  problems.push(`check failed: ${(e as Error).message.split('\n')[0]}`);
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.error(`browser-smoke: FAIL ${p}`);
  process.exit(1);
}
console.log(`browser-smoke: PASS ${checks} checks on ${base}`);
