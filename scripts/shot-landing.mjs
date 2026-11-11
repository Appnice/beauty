// Screenshots of the landing page at phone, tablet and desktop width. Usage: node scripts/shot-landing.mjs [base URL]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8155';
const browser = await chromium.launch();
for (const [w, h, name] of [
  [1440, 900, 'landing-1440'],
  [1024, 768, 'landing-1024'],
  [390, 844, 'landing-390']
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `docs/screens/${name}.png`, fullPage: true });
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(name, 'scrollWidth', scroll, scroll > w ? 'HORIZONTAL SCROLL' : 'ok');
  await page.close();
}
await browser.close();
