/**
 * Dollar Filer backend (Google Apps Script web app bound to its own Sheet).
 * Operator: READ FRANCE SAS (SIREN 988 741 773), run with Octave, an AI agent.
 *
 * POST text/plain JSON (no CORS preflight):
 *   {action:'track', event, page, variant, device, ref_domain, utm_source, utm_medium, utm_campaign}
 *       -> daily counters in the `Stats` tab. No IP (Apps Script never sees it), no user agent,
 *          no cookie, no identifier: whitelisted fields only, one counter row per day x page x event x
 *          variant x source, never one row per visit.
 *   {action:'preorder', email, variant, price, addon_shown, addon, state, consent, hp, page, utm_source}
 *       -> one row in `Preorders`. Nothing is charged: this is a pre-order list for the 2026 Return Pack.
 * GET ?action=ping -> {ok:true}
 * GET ?action=stats&key=... -> today's counters (key in Script Properties STATS_KEY), used by the e2e test.
 */

var SITE_ = 'dollar-filer';
var STATS_HEADER_ = ['date', 'page', 'event', 'variant', 'source', 'medium', 'campaign', 'count', 'mobile', 'desktop', 'updated_at'];
var STATS_KEYS_ = 7;
var PRE_HEADER_ = ['at', 'email', 'price_usd', 'variant', 'addon_shown', 'addon_wanted', 'state', 'source', 'page', 'status'];
var EVENTS_ = ['view', 'calc_done', 'print', 'pack_view', 'preorder_open', 'preorder_submit', 'sample_download', 'guide_check'];
var PAGES_ = ['/', '/file.html', '/pack.html', '/how-we-calculate.html', '/privacy.html', '/terms.html'];
var VARIANTS_ = ['', 'p19', 'p29', 'p19a', 'p29a'];
var STATES_ = ['', 'abia', 'adamawa', 'akwa-ibom', 'anambra', 'bauchi', 'bayelsa', 'benue', 'borno', 'cross-river', 'delta', 'ebonyi', 'edo', 'ekiti', 'enugu', 'fct', 'gombe', 'imo', 'jigawa', 'kaduna', 'kano', 'katsina', 'kebbi', 'kogi', 'kwara', 'lagos', 'nasarawa', 'niger', 'ogun', 'ondo', 'osun', 'oyo', 'plateau', 'rivers', 'sokoto', 'taraba', 'yobe', 'zamfara', 'abroad'];
var EMAIL_RE_ = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
var OWN_HOSTS_ = ['vin-cc.github.io', 'dollarfiler.github.io'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'init') {
      // First call after deployment creates the tabs and returns the stats key once; later calls get nothing.
      var props = PropertiesService.getScriptProperties();
      if (props.getProperty('STATS_KEY')) return json_({ ok: true, already: true });
      return json_({ ok: true, key: setup() });
    }
    if (p.action === 'stats') {
      var key = PropertiesService.getScriptProperties().getProperty('STATS_KEY');
      if (!key || p.key !== key) return json_({ ok: false, error: 'forbidden' });
      return json_({ ok: true, date: today_(), rows: statsOfDay_(p.date || today_()), preorders: preorderCount_() });
    }
    return json_({ ok: true, service: SITE_ });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad_json' });
  try {
    if (body.action === 'track') return json_(track_(body));
    if (body.action === 'preorder') return json_(preorder_(body));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    if (err && err.user) return json_({ ok: false, error: err.code });
    console.error(String(err && err.stack || err));
    return json_({ ok: false, error: 'server' });
  }
}

/* ---------------- helpers ---------------- */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function userError_(code) { var e = new Error(code); e.user = true; e.code = code; return e; }
function today_() { return Utilities.formatDate(new Date(), 'Africa/Lagos', 'yyyy-MM-dd'); }
function token_(v, max) { return v === undefined || v === null ? '' : String(v).toLowerCase().replace(/[^a-z0-9._ -]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function txt_(v) { var s = String(v === undefined || v === null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function tab_(name, header) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rateOk_(bucket, perMinute) {
  var cache = CacheService.getScriptCache();
  var k = 'rl:' + bucket + ':' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(k) || 0);
  if (n >= perMinute) return false;
  cache.put(k, String(n + 1), 120);
  return true;
}

function page_(p) {
  var s = String(p || '/').toLowerCase().replace(/[?#].*$/, '').replace(/^\/dollar-filer/, '');
  s = s.replace(/\/index\.html$/, '/') || '/';
  return PAGES_.indexOf(s) >= 0 ? s : '(other)';
}

/* ---------------- tracking ---------------- */

function track_(req) {
  var event = String(req.event || '');
  if (EVENTS_.indexOf(event) < 0) throw userError_('bad_event');
  var variant = String(req.variant || '');
  if (VARIANTS_.indexOf(variant) < 0) variant = '';
  var ref = String(req.ref_domain || '').toLowerCase().replace(/^www\./, '');
  if (ref && !/^[a-z0-9.-]{1,100}$/.test(ref)) ref = '';
  if (OWN_HOSTS_.indexOf(ref) >= 0) ref = '(internal)';
  var hit = {
    date: today_(),
    page: page_(req.page),
    event: event,
    variant: variant,
    source: token_(req.utm_source, 40) || ref || '(direct)',
    medium: token_(req.utm_medium, 30),
    campaign: token_(req.utm_campaign, 40),
    device: req.device === 'mobile' || req.device === 'desktop' ? req.device : ''
  };
  if (!rateOk_('track', 300)) return { ok: false, error: 'rate_limited' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { ok: false, error: 'busy' };
  try { increment_(hit); } finally { lock.releaseLock(); }
  return { ok: true };
}

function increment_(h) {
  var sh = tab_('Stats', STATS_HEADER_);
  var key = [h.date, h.page, h.event, h.variant, h.source, h.medium, h.campaign].join('\u001f');
  var last = sh.getLastRow();
  var n = Math.min(Math.max(last - 1, 0), 3000);
  var rowNum = 0;
  if (n > 0) {
    var vals = sh.getRange(last - n + 1, 1, n, STATS_KEYS_).getDisplayValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (vals[i][0] < h.date) break;
      if (vals[i].join('\u001f') === key) { rowNum = last - n + 1 + i; break; }
    }
  }
  var now = new Date().toISOString();
  if (!rowNum) {
    sh.appendRow([h.date, h.page, h.event, h.variant, h.source, h.medium, h.campaign, 1, h.device === 'mobile' ? 1 : 0, h.device === 'desktop' ? 1 : 0, now].map(function (v, j) { return j < STATS_KEYS_ ? txt_(v) : v; }));
  } else {
    var r = sh.getRange(rowNum, STATS_KEYS_ + 1, 1, 4);
    var c = r.getValues()[0];
    r.setValues([[Number(c[0] || 0) + 1, Number(c[1] || 0) + (h.device === 'mobile' ? 1 : 0), Number(c[2] || 0) + (h.device === 'desktop' ? 1 : 0), now]]);
  }
}

function statsOfDay_(date) {
  var sh = tab_('Stats', STATS_HEADER_);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, STATS_HEADER_.length).getDisplayValues();
  return vals.filter(function (v) { return v[0] === date; }).map(function (v) {
    var o = {};
    STATS_HEADER_.forEach(function (k, j) { o[k] = j >= STATS_KEYS_ && j < STATS_KEYS_ + 3 ? Number(v[j]) : v[j]; });
    return o;
  });
}

/* ---------------- pre-orders ---------------- */

function preorder_(req) {
  if (req.hp) return { ok: true }; // honeypot filled: silently drop
  var email = String(req.email || '').trim().slice(0, 254);
  if (!EMAIL_RE_.test(email)) throw userError_('bad_email');
  if (req.consent !== true) throw userError_('consent_required');
  var variant = VARIANTS_.indexOf(String(req.variant || '')) > 0 ? String(req.variant) : '';
  var price = variant.indexOf('p29') === 0 ? 29 : variant.indexOf('p19') === 0 ? 19 : '';
  var state = String(req.state || '').toLowerCase();
  if (STATES_.indexOf(state) < 0) state = '';
  if (!rateOk_('pre', 30)) throw userError_('rate_limited');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) throw userError_('busy');
  try {
    var sh = tab_('Preorders', PRE_HEADER_);
    sh.appendRow([new Date().toISOString(), txt_(email), price, variant, req.addon_shown ? 'yes' : 'no', req.addon ? 'yes' : 'no', state, token_(req.utm_source, 40) || '(direct)', page_(req.page), /e2e-test/.test(email) ? 'test' : 'new']);
    increment_({ date: today_(), page: page_(req.page), event: 'preorder_submit', variant: variant, source: '(server)', medium: '', campaign: '', device: '' });
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function preorderCount_() {
  var sh = tab_('Preorders', PRE_HEADER_);
  return Math.max(0, sh.getLastRow() - 1);
}

/** Run once from the editor or clasp: creates both tabs and a random STATS_KEY. */
function setup() {
  tab_('Stats', STATS_HEADER_);
  tab_('Preorders', PRE_HEADER_);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('STATS_KEY')) props.setProperty('STATS_KEY', Utilities.getUuid());
  return props.getProperty('STATS_KEY');
}
