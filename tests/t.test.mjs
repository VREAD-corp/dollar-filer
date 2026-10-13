// docs/assets/t.js in a fake browser: crawlers, automated browsers and our tests are counted apart ("excluded"),
// prerendered pages count once opened, Do Not Track sends nothing, the user agent is never sent.
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../docs/assets/t.js', import.meta.url), 'utf8');
const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function run({ ua = CHROME, webdriver = false, search = '', store = {}, prerendering = false, visibility = 'visible', dnt = '', host = 'vin-cc.github.io' } = {}) {
  const sent = [], listeners = {};
  const doc = {
    referrer: '', prerendering, visibilityState: visibility, querySelectorAll: () => [],
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); }, removeEventListener: (k, f) => { listeners[k] = (listeners[k] || []).filter((g) => g !== f); },
  };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx = {
    navigator: { userAgent: ua, webdriver, doNotTrack: dnt }, document: doc, localStorage: ls, innerWidth: 390, URLSearchParams, JSON, Math,
    location: { hostname: host, pathname: '/dollar-filer/', search },
    fetch: (u, o) => { assert.equal(o.credentials, 'omit'); sent.push(JSON.parse(o.body)); return Promise.resolve(); },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  return { sent, store, doc, ctx, fire: (k) => (listeners[k] || []).slice().forEach((f) => f({})) };
}
const views = (r) => r.sent.filter((b) => b.event === 'view');

test('a normal visit is counted, without the user agent', () => {
  const r = run();
  assert.equal(views(r).length, 1);
  assert.ok(!('excluded' in r.sent[0]));
  assert.ok(!JSON.stringify(r.sent).includes('Chrome'));
});

test('crawlers, headless and webdriver browsers are flagged, never silently counted', () => {
  assert.equal(run({ webdriver: true }).sent[0].excluded, 'webdriver');
  const g = run({ ua: GOOGLEBOT });
  assert.equal(g.sent[0].excluded, 'bot');
  assert.ok(!JSON.stringify(g.sent).includes('Googlebot'));
  assert.equal(run({ ua: CHROME.replace('Chrome/', 'HeadlessChrome/') }).sent[0].excluded, 'bot');
});

test('octave_notrack=1 (query, remembered; =0 clears) flags our own tests, for every event', () => {
  let r = run({ search: '?octave_notrack=1' });
  assert.equal(r.sent[0].excluded, 'notrack');
  assert.equal(r.store.octave_notrack, '1');
  r.ctx.dfTrack('calc_done');
  assert.equal(r.sent[1].excluded, 'notrack');
  assert.equal(run({ store: { octave_notrack: '1' } }).sent[0].excluded, 'notrack');
  r = run({ search: '?octave_notrack=0', store: { octave_notrack: '1' } });
  assert.ok(!('excluded' in r.sent[0]) && !('octave_notrack' in r.store));
});

test('Do Not Track and foreign hosts send nothing', () => {
  assert.equal(run({ dnt: '1' }).sent.length, 0);
  assert.equal(run({ host: 'localhost' }).sent.length, 0);
});

test('prerendered pages count only once opened', () => {
  let r = run({ prerendering: true });
  assert.equal(r.sent.length, 0);
  r.fire('prerenderingchange');
  assert.equal(views(r).length, 1);
  r = run({ visibility: 'prerender' });
  assert.equal(r.sent.length, 0);
  r.doc.visibilityState = 'visible'; r.fire('visibilitychange'); r.fire('visibilitychange');
  assert.equal(views(r).length, 1);
});
