/*! Dollar Filer anonymous counters. No cookie, no identifier, no IP stored, nothing you type.
 * Sends {event, page, variant, device, ref_domain, utm_*} to a counter sheet; skipped under Do Not Track / GPC.
 * Runs after cro.js (behaviour counters and the price variant, see assets/xp.js).
 * Crawlers, automated browsers and our own tests are flagged `excluded` and counted apart, never as visits. */
(function (n, l, d) {
  var E = 'https://script.google.com/macros/s/AKfycbwuvwAEQ_dTI61JJtVUpUUJHFAvp6On3QaF_lS06sO52LZzzfJiSEyt40lVuwABf2FJ/exec';
  var q = new URLSearchParams(l.search), c = window.octaveCro, v = c && c.v ? c.v('price') || '' : '';
  // Price test: the variant comes from cro.js (assets/xp.js, experiment `price`): drawn once per tab and kept in
  // sessionStorage only, ?v=<variant> forces one. Fallback if cro.js did not load: ?v=, else a draw for this page.
  if (!/^p(19|29)a?$/.test(v)) v = q.get('v') || '';
  if (!/^p(19|29)a?$/.test(v)) v = ['p19', 'p19a', 'p29', 'p29a'][Math.random() * 4 | 0];
  try { localStorage.removeItem('df_v'); } catch (e) {} // the old per-browser draw (before 2026-10-13)
  window.dfVariant = v;
  window.dfPrice = v.indexOf('p29') === 0 ? 29 : 19;
  window.dfAddon = /a$/.test(v);
  var on = !(n.doNotTrack == '1' || n.globalPrivacyControl) && /(^|\.)github\.io$/.test(l.hostname);
  // Not a visit: our tests (?octave_notrack=1, kept in this browser; =0 clears it), navigator.webdriver, crawler or
  // headless user agents. The user agent is only read here, never sent.
  var x = '', s;
  try { s = localStorage; if (q.has('octave_notrack')) q.get('octave_notrack') == '1' ? s.setItem('octave_notrack', '1') : s.removeItem('octave_notrack'); x = s.getItem('octave_notrack') == '1' ? 'notrack' : ''; } catch (e) {}
  if (!x && q.get('octave_notrack') == '1') x = 'notrack';
  if (!x && n.webdriver) x = 'webdriver';
  if (!x && /bot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|googleother|mediapartners|bingpreview|phantom|puppeteer|playwright|selenium/i.test(n.userAgent || '')) x = 'bot';
  var b = { action: 'track', page: l.pathname, variant: v, ref_domain: (d.referrer.split('/')[2] || ''), device: innerWidth < 768 ? 'mobile' : 'desktop', v: 2 };
  ['source', 'medium', 'campaign'].forEach(function (k) { b['utm_' + k] = q.get('utm_' + k) || ''; });
  if (x) b.excluded = x;
  window.dfTrack = function (ev) {
    if (!on) return;
    b.event = ev;
    try { fetch(E, { method: 'POST', keepalive: true, credentials: 'omit', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(b) }).catch(function () {}); } catch (e) {}
  };
  // A prerendered or prefetched page counts only once the visitor actually opens it.
  var go = function () { window.dfTrack('view'); };
  if (d.prerendering) d.addEventListener('prerenderingchange', go, { once: true });
  else if (d.visibilityState == 'prerender') d.addEventListener('visibilitychange', function w() { if (d.visibilityState != 'prerender') { d.removeEventListener('visibilitychange', w); go(); } });
  else go();
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track]');
    if (!a) return;
    window.dfTrack(a.getAttribute('data-track'));
    if (a.getAttribute('data-track') == 'sample_download' && window.octaveCro) window.octaveCro.goal('download');
  }, true);
  d.addEventListener('DOMContentLoaded', function () {
    d.querySelectorAll('[data-price]').forEach(function (el) { el.textContent = '$' + window.dfPrice; });
  });
})(navigator, location, document);
