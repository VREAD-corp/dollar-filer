/*! Dollar Filer anonymous counters. No cookie, no identifier, no IP stored, nothing you type.
 * Sends {event, page, variant, device, ref_domain, utm_*} to a counter sheet; skipped under Do Not Track / GPC. */
(function (n, l, d) {
  var E = 'https://script.google.com/macros/s/AKfycbwuvwAEQ_dTI61JJtVUpUUJHFAvp6On3QaF_lS06sO52LZzzfJiSEyt40lVuwABf2FJ/exec';
  var q = new URLSearchParams(l.search), v = '';
  // Price test: a random label kept on this device only (localStorage), never sent with anything that identifies you.
  try { v = localStorage.getItem('df_v') || ''; } catch (e) {}
  if (!/^p(19|29)a?$/.test(v)) {
    v = (Math.random() < 0.5 ? 'p19' : 'p29') + (Math.random() < 0.5 ? 'a' : '');
    try { localStorage.setItem('df_v', v); } catch (e) {}
  }
  if (/^p(19|29)a?$/.test(q.get('v') || '')) v = q.get('v');
  window.dfVariant = v;
  window.dfPrice = v.indexOf('p29') === 0 ? 29 : 19;
  window.dfAddon = /a$/.test(v);
  var on = !(n.doNotTrack == '1' || n.globalPrivacyControl) && /(^|\.)github\.io$/.test(l.hostname);
  var b = { action: 'track', page: l.pathname, variant: v, ref_domain: (d.referrer.split('/')[2] || ''), device: innerWidth < 768 ? 'mobile' : 'desktop' };
  ['source', 'medium', 'campaign'].forEach(function (k) { b['utm_' + k] = q.get('utm_' + k) || ''; });
  window.dfTrack = function (ev) {
    if (!on) return;
    b.event = ev;
    try { fetch(E, { method: 'POST', keepalive: true, credentials: 'omit', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(b) }).catch(function () {}); } catch (e) {}
  };
  window.dfTrack('view');
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-track]');
    if (a) window.dfTrack(a.getAttribute('data-track'));
  }, true);
  d.addEventListener('DOMContentLoaded', function () {
    d.querySelectorAll('[data-price]').forEach(function (el) { el.textContent = '$' + window.dfPrice; });
  });
})(navigator, location, document);
