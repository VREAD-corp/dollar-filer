// Live-site checks: hand-computed cases through the UI, pre-order post, tracking counters.
import { test, expect } from '@playwright/test';
const API = 'https://script.google.com/macros/s/AKfycbwuvwAEQ_dTI61JJtVUpUUJHFAvp6On3QaF_lS06sO52LZzzfJiSEyt40lVuwABf2FJ/exec';
const KEY = process.env.STATS_KEY || '';
const ownRates = async (page, usd, gbp, eur) => {
  await page.check('input[name=fxmode][value=own]');
  await page.fill('#fx_USD', String(usd)); await page.fill('#fx_GBP', String(gbp)); await page.fill('#fx_EUR', String(eur));
};
async function stats(request) {
  const r = await request.get(`${API}?action=stats&key=${KEY}`);
  return r.json();
}
const count = (s, f) => s.rows.filter(f).reduce((n, r) => n + r.count, 0);

test('case A: $3,000/month salary, rent 2.4m, Lagos', async ({ page }, info) => {
  await page.goto('./');
  await page.selectOption('#state', 'lagos');
  await ownRates(page, 1365, 1835, 1584);
  await page.fill('#fs', '3000'); await page.selectOption('#fs_per', '12');
  await page.fill('#rent', '2400000');
  await page.click('button[type=submit]');
  await expect(page.locator('#r_tax')).toHaveText('₦10,121,800');
  await expect(page.locator('#r_charge')).toHaveText('₦48,660,000');
  await expect(page.locator('#r_eff')).toHaveText('20.6%');
  await expect(page.locator('#r_month')).toHaveText('₦843,483');
  await expect(page.locator('#bands tr').nth(5)).toContainText('₦5,441,800');
  await expect(page.locator('#out')).toContainText('etax.lirs.net');
  await page.screenshot({ path: `shots/live-${info.project.name}-caseA.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: `shots/live-${info.project.name}-print.png`, fullPage: true });
});

test('case B: £20,000 fees less £2,000 costs, pension 600k', async ({ page }) => {
  await page.goto('./');
  await ownRates(page, 1365, 1835, 1584);
  await page.fill('#ff', '20000'); await page.selectOption('#ff_cur', 'GBP');
  await page.fill('#fe', '2000'); await page.selectOption('#fe_cur', 'GBP');
  await page.fill('#pen', '600000');
  await expect(page.locator('#r_charge')).toHaveText('₦32,430,000');
  await expect(page.locator('#r_tax')).toHaveText('₦6,388,900');
});

test('case D: $50,000 salary with $5,000 foreign tax (s.120 credit)', async ({ page }) => {
  await page.goto('./');
  await ownRates(page, 1400, 1835, 1584);
  await page.fill('#fs', '50000'); await page.selectOption('#fs_per', '1');
  await page.fill('#ftax', '5000');
  await expect(page.locator('#r_gross')).toHaveText('₦15,430,000');
  await expect(page.locator('#r_tax')).toHaveText('₦8,430,000');
});

test('CBN rates load from rates.json', async ({ page, request }) => {
  const j = await (await request.get('rates.json')).json();
  await page.goto('./');
  await expect(page.locator('#fx_USD')).toHaveValue(String(j.ytd.USD.rate));
  expect(j.ytd.USD.rate).toBeGreaterThan(1000);
});

test('file guide answers and no horizontal scroll', async ({ page }, info) => {
  for (const p of ['./', 'file.html', 'pack.html', 'how-we-calculate.html', 'privacy.html', 'terms.html']) {
    await page.goto(p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.use.viewport.width);
    await expect(page.locator('footer')).toContainText('988 741 773');
  }
  await page.goto('file.html');
  await page.check('input[name=q1][value=yes]'); await page.check('input[name=q2][value=yes]'); await page.check('input[name=q3][value=yes]');
  await expect(page.locator('#answer')).toContainText('Yes, you should file a return for 2026');
  await page.screenshot({ path: `shots/live-${info.project.name}-file.png`, fullPage: true });
});

test('tracking counters increment, pre-order posts', async ({ page, request }, info) => {
  test.skip(!KEY, 'STATS_KEY not set');
  const tag = `e2e-${info.project.name}-${Date.now()}`;
  const before = await stats(request);
  const preBefore = before.preorders;
  await page.goto(`pack.html?utm_source=${tag}&v=p29a`);
  await expect(page.locator('#prebtn')).toContainText('$29');
  await expect(page.locator('#addonbox')).toBeVisible();
  await page.fill('#email', `e2e-test+${info.project.name}@example.com`);
  await page.check('#addon'); await page.check('#consent');
  await page.click('#prebtn');
  await expect(page.locator('#premsg')).toContainText('You are on the list', { timeout: 30000 });
  await page.screenshot({ path: `shots/live-${info.project.name}-preorder.png`, fullPage: true });
  await page.goto(`./?utm_source=${tag}`);
  await page.fill('#fs', '1000');
  await expect(page.locator('#r_tax')).toBeVisible();
  await page.waitForTimeout(4000);
  const after = await stats(request);
  expect(after.preorders).toBeGreaterThan(preBefore);
  expect(count(after, r => r.source === tag && r.event === 'view')).toBeGreaterThanOrEqual(2);
  expect(count(after, r => r.source === tag && r.event === 'calc_done')).toBeGreaterThanOrEqual(1);
  expect(count(after, r => r.source === tag && r.event === 'preorder_open' && r.variant === 'p29a')).toBeGreaterThanOrEqual(1);
});
