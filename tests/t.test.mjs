// docs/assets/t.js in a fake browser: crawlers, automated browsers and our tests are counted apart ("excluded"),
// prerendered pages count once opened, Do Not Track sends nothing, the user agent is never sent.
// The price variant comes from cro.js (experiment `price` of assets/xp.js), loaded before t.js on every page.
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = (f) => fs.readFileSync(new URL('../docs/assets/' + f, import.meta.url), 'utf8');
const src = read('t.js'), xp = read('xp.js'), cro = read('cro.js');
const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function run({ ua = CHROME, webdriver = false, search = '', store = {}, session = {}, prerendering = false, visibility = 'visible', dnt = '', host = 'vin-cc.github.io', withCro = false } = {}) {
  const sent = [], listeners = {};
  const doc = {
    referrer: '', prerendering, visibilityState: visibility, querySelectorAll: () => [], readyState: 'loading', forms: [],
    documentElement: { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); } }, currentScript: null,
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); }, removeEventListener: (k, f) => { listeners[k] = (listeners[k] || []).filter((g) => g !== f); },
  };
  const st = (o) => ({ getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } });
  const ls = st(store);
  const ctx = {
    navigator: { userAgent: ua, webdriver, doNotTrack: dnt }, document: doc, localStorage: ls, sessionStorage: st(session), innerWidth: 390, URLSearchParams, JSON, Math, Intl, RegExp,
    addEventListener: () => {},
    location: { hostname: host, pathname: '/dollar-filer/', search },
    fetch: (u, o) => { assert.equal(o.credentials, 'omit'); sent.push(JSON.parse(o.body)); return Promise.resolve(); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  if (withCro) {
    vm.runInContext(xp, ctx);
    doc.currentScript = { dataset: { site: 'dollar-filer', api: 'https://script.google.com/macros/s/TEST/exec', hosts: 'vin-cc.github.io' } };
    vm.runInContext(cro, ctx);
    doc.currentScript = null;
  }
  vm.runInContext(src, ctx);
  return { sent, store, session, doc, ctx, fire: (k) => (listeners[k] || []).slice().forEach((f) => f({})) };
}
const views = (r) => r.sent.filter((b) => b.event === 'view');

test('a normal visit is counted, without the user agent', () => {
  const r = run();
  assert.equal(views(r).length, 1);
  assert.ok(!('excluded' in r.sent[0]));
  assert.equal(r.sent[0].v, 2, 'snippet version: hits without it are counted as legacy');
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

test('price variant: from cro.js (experiment price), forced by ?v=, kept per tab only; old df_v removed', () => {
  for (const [v, price, addon] of [['p19', 19, false], ['p19a', 19, true], ['p29', 29, false], ['p29a', 29, true]]) {
    const r = run({ withCro: true, search: '?octave_notrack=1&v=' + v, store: { df_v: 'p19' } });
    assert.equal(r.ctx.octaveCro.v('price'), v, 'exact value first: ?v=p19 is p19, not p19a');
    assert.deepEqual([r.ctx.dfVariant, r.ctx.dfPrice, r.ctx.dfAddon], [v, price, addon]);
    assert.equal(r.session.oxp_price, v, 'kept in sessionStorage (this tab)');
    assert.equal(r.doc.documentElement.attrs['data-xp-price'], v);
    assert.ok(!('df_v' in r.store), 'the old per-browser draw is cleaned up');
    assert.equal(r.sent[0].variant, v, 'variant still sent with every hit');
  }
  // Same tab, next page: the drawn variant is kept; a fresh tab draws uniformly over the four.
  assert.equal(run({ withCro: true, session: { oxp_price: 'p29' } }).ctx.dfVariant, 'p29');
  const seen = {};
  for (let i = 0; i < 400; i++) { const v = run({ withCro: true }).ctx.dfVariant; seen[v] = (seen[v] || 0) + 1; }
  assert.deepEqual(Object.keys(seen).sort(), ['p19', 'p19a', 'p29', 'p29a']);
  Object.values(seen).forEach((n) => assert.ok(n > 60 && n < 140, 'uniform split: ' + JSON.stringify(seen)));
});

test('without cro.js the page still gets a valid variant (?v= or a draw), never stored', () => {
  let r = run({ search: '?v=p29a' });
  assert.deepEqual([r.ctx.dfVariant, r.ctx.dfPrice, r.ctx.dfAddon], ['p29a', 29, true]);
  r = run({ store: { df_v: 'p29' } });
  assert.match(r.ctx.dfVariant, /^p(19|29)a?$/);
  assert.ok(!('df_v' in r.store));
});
