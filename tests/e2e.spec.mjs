// Live-site checks: hand-computed cases through the UI, pre-order post, tracking counters.
import { test, expect } from '@playwright/test';
const API = 'https://script.google.com/macros/s/AKfycbwuvwAEQ_dTI61JJtVUpUUJHFAvp6On3QaF_lS06sO52LZzzfJiSEyt40lVuwABf2FJ/exec';
const KEY = process.env.STATS_KEY || '';
// The secondary inputs (state, costs, rates, reliefs, tax paid) sit in a closed <details> under the button since 2026-10-19.
const more = async (page) => { await page.evaluate(() => { document.getElementById('more-fields').open = true; }); };
const ownRates = async (page, usd, gbp, eur) => {
  await more(page);
  await page.check('input[name=fxmode][value=own]');
  await page.fill('#fx_USD', String(usd)); await page.fill('#fx_GBP', String(gbp)); await page.fill('#fx_EUR', String(eur));
};
async function stats(request) {
  const r = await request.get(`${API}?action=stats&key=${KEY}`);
  return r.json();
}
const count = (s, f) => s.rows.filter(f).reduce((n, r) => n + r.count, 0);
// Our runs never count as visits: octave_notrack=1 sends every hit to the Exclus tab (reason notrack).
const ex = (s, f) => (s.excluded || []).filter((r) => r.reason === 'notrack' && f(r)).reduce((n, r) => n + r.count, 0);
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('octave_notrack', '1'); } catch {} }); });

test('case A: $3,000/month salary, rent 2.4m, Lagos', async ({ page }, info) => {
  await page.goto('./');
  await more(page);
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

test('cro.js loads before t.js; ?v= forces the price variant, prices and add-on follow it', async ({ page, request }) => {
  const js = await request.get('assets/cro.js');
  expect(js.ok()).toBe(true);
  await page.goto('pack.html?octave_notrack=1&v=p29a');
  await expect(page.locator('script[src$="assets/cro.js"][data-site="dollar-filer"]')).toHaveCount(1);
  expect(await page.evaluate(() => [window.octaveCro && octaveCro.v('price'), window.dfVariant, window.dfPrice, window.dfAddon,
    document.documentElement.dataset.xpPrice, sessionStorage.getItem('oxp_price'), localStorage.getItem('df_v')])).toEqual(['p29a', 'p29a', 29, true, 'p29a', 'p29a', null]);
  await expect(page.locator('[data-price]').first()).toHaveText('$29');
  await expect(page.locator('#addonbox')).toBeVisible();
  // Exact value first: ?v=p19 is p19 (no add-on), not p19a. Same tab, next page without ?v=: kept.
  await page.goto('pack.html?octave_notrack=1&v=p19');
  expect(await page.evaluate(() => [octaveCro.v('price'), window.dfPrice, window.dfAddon])).toEqual(['p19', 19, false]);
  await expect(page.locator('[data-price]').first()).toHaveText('$19');
  await expect(page.locator('#addonbox')).toBeHidden();
  await page.goto('./?octave_notrack=1');
  await expect(page.locator('#pricing [data-price]')).toHaveText('$19');
  expect(await page.evaluate(() => window.dfVariant)).toBe('p19');
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
    await expect(page.locator('footer a[href="https://jalonel.com/en/"]')).toHaveText('A Jalonel brand');
  }
  await page.goto('file.html');
  await page.check('input[name=q1][value=yes]'); await page.check('input[name=q2][value=yes]'); await page.check('input[name=q3][value=yes]');
  await expect(page.locator('#answer')).toContainText('Yes, you should file a return for 2026');
  await page.screenshot({ path: `shots/live-${info.project.name}-file.png`, fullPage: true });
});

test('tracking counters increment (as excluded test hits), reminder form posts', async ({ page, request }, info) => {
  test.skip(!KEY, 'STATS_KEY not set');
  const tag = `e2e-${info.project.name}-${Date.now()}`;
  const before = await stats(request);
  await page.goto(`pack.html?utm_source=${tag}&v=p29a`);
  await expect(page.locator('#buy')).toContainText('Pay $29.00', { timeout: 30000 });
  await expect(page.locator('#addonbox')).toBeVisible();
  const pre = page.locator('#pre');
  await pre.locator('#email').fill(`e2e-test+${info.project.name}@example.com`);
  await pre.locator('#addon').setChecked(true, { force: true }); await pre.locator('#consent').setChecked(true, { force: true });
  await expect(pre.locator('#consent')).toBeChecked();
  await pre.locator('#prebtn').click();
  await expect(page.locator('#premsg')).toContainText('You are on the list', { timeout: 30000 });
  await page.screenshot({ path: `shots/live-${info.project.name}-pack.png`, fullPage: true });
  await page.goto(`./?utm_source=${tag}`);
  await page.fill('#fs', '1000');
  await expect(page.locator('#r_tax')).toBeVisible();
  await page.waitForTimeout(4000);
  const after = await stats(request);
  expect(after.preorders).toBeGreaterThan(before.preorders);
  const delta = (f) => ex(after, f) - ex(before, f);
  expect(delta(r => r.event === 'view')).toBeGreaterThanOrEqual(2);
  expect(delta(r => r.event === 'calc_done')).toBeGreaterThanOrEqual(1);
  expect(delta(r => r.event === 'checkout_view' && r.variant === 'p29a')).toBeGreaterThanOrEqual(1);
  expect(delta(r => r.event === 'preorder_open')).toBeGreaterThanOrEqual(1);
  expect(count(after, r => r.source === tag), 'test hits must not count as visits').toBe(0);
});

// Live card checkout up to PaymentIntent creation. Confirmation is blocked at the network level (and the
// card number is Stripe's test card, which a live account declines anyway); the PI is then cancelled through
// the shared checkout's cancelIntent action. The client secret is never printed.
test('live checkout creates a USD PaymentIntent, never confirmed, then cancelled', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop-1440' && !process.env.PI_BOTH, 'one live PI per run');
  const confirms = [];
  await context.route(/api\.stripe\.com\/v1\/payment_intents\/[^/]+\/confirm/, (r) => { confirms.push(r.request().url().split('?')[0].replace(/_secret_[^/]+/, '')); return r.abort(); });
  let created = null;
  page.on('response', async (res) => {
    if (!/script\.(google|googleusercontent)\.com/.test(res.url())) return;
    try { const j = await res.json(); if (j && j.payment_intent && j.client_secret) created = j; } catch {}
  });
  const price = 19;
  await page.goto(`pack.html?v=p${price}`);
  const buy = page.locator('#buy');
  await expect(buy).toContainText(`Pay $${price}.00`, { timeout: 30000 });
  await buy.locator('input[type=email]').first().fill('e2e-test+checkout@example.com');
  await buy.locator('input[autocomplete=name], input[name=name]').first().fill('E2E Test Octave');
  const frame = page.frameLocator('#buy iframe[title*="payment" i], #buy iframe[name^="__privateStripeFrame"]').first();
  await frame.locator('input[name=number]').fill('4242424242424242');
  await frame.locator('input[name=expiry]').fill('12 / 34');
  await frame.locator('input[name=cvc]').fill('123');
  const country = frame.locator('select[name=country]');
  if (await country.count()) await country.selectOption('NG').catch(() => {});
  await buy.locator('button', { hasText: 'Pay' }).click();
  await expect.poll(() => created && created.payment_intent, { timeout: 45000 }).toMatch(/^pi_/);
  const pi = created.payment_intent;
  console.log('PI created:', pi);
  await page.waitForTimeout(3000);
  const cancel = await page.evaluate(async ({ api, pi, cs }) => {
    const r = await fetch(api, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'cancelIntent', payment_intent: pi, client_secret: cs }) });
    return r.json();
  }, { api: 'https://script.google.com/macros/s/AKfycbzHtgYXyyylvj1LFG16HuhxwFHkB7E2u-QKIlVH4hEJggjUvq_rcTK_MEodCwjTbATbuw/exec', pi, cs: created.client_secret });
  console.log('cancel:', JSON.stringify(cancel), 'confirm attempts blocked:', confirms.length);
  expect(cancel.ok).toBe(true);
  expect(cancel.status).toBe('canceled');
  await page.screenshot({ path: `shots/live-${info.project.name}-checkout.png`, fullPage: true });
});
