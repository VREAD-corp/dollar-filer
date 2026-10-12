// Builds docs/rates.json from the Central Bank of Nigeria's own exchange-rate feed.
// Source page: https://www.cbn.gov.ng/rates/ExchRateByCurrency.html (the page calls /api/GetAllExchangeRates).
// We keep the CBN "central rate" (naira per unit) for USD, GBP and EUR: latest day, month averages,
// and the year-to-date average. Node 18+, no dependencies. Usage: node scripts/cbn-rates.mjs [input.json]
import fs from 'node:fs';

const OUT = new URL('../docs/rates.json', import.meta.url);
const NAMES = { 'US DOLLAR': 'USD', 'POUNDS STERLING': 'GBP', 'POUND STERLING': 'GBP', 'EURO': 'EUR' };

async function load() {
  if (process.argv[2]) return JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch('https://www.cbn.gov.ng/api/GetAllExchangeRates', {
        headers: { 'user-agent': 'Mozilla/5.0 (dollar-filer rates job; contact octave@vread.fr)', accept: 'application/json' },
        signal: AbortSignal.timeout(280000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.error('attempt', i, e.message);
      if (i === 3) throw e;
      await new Promise((res) => setTimeout(res, 20000));
    }
  }
}

const rows = await load();
const by = { USD: [], GBP: [], EUR: [] };
const seen = new Set();
for (const x of rows) {
  const cur = NAMES[String(x.currency || '').trim().toUpperCase()];
  const date = String(x.ratedate || '').slice(0, 10);
  const rate = Number(x.centralrate);
  if (!cur || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(rate > 0)) continue;
  const k = cur + date;
  if (seen.has(k)) continue;
  seen.add(k);
  by[cur].push({ date, rate });
}
const r2 = (n) => Math.round(n * 100) / 100;
const avg = (a) => (a.length ? r2(a.reduce((s, x) => s + x.rate, 0) / a.length) : null);
const out = { source: 'Central Bank of Nigeria, exchange rates (central rate, naira per unit)', source_url: 'https://www.cbn.gov.ng/rates/ExchRateByCurrency.html', fetched_at: new Date().toISOString(), latest: {}, ytd: {}, months: {} };
let latestDate = '';
for (const cur of Object.keys(by)) {
  const a = by[cur].sort((p, q) => (p.date < q.date ? -1 : 1));
  if (!a.length) throw new Error('no rows for ' + cur);
  const last = a[a.length - 1];
  out.latest[cur] = { date: last.date, rate: last.rate };
  if (last.date > latestDate) latestDate = last.date;
  const year = last.date.slice(0, 4);
  const ytd = a.filter((x) => x.date.startsWith(year));
  out.ytd[cur] = { year, from: ytd[0].date, to: last.date, days: ytd.length, rate: avg(ytd) };
  for (const y of [String(Number(year) - 1), year]) {
    for (let m = 1; m <= 12; m++) {
      const key = y + '-' + String(m).padStart(2, '0');
      const v = avg(a.filter((x) => x.date.startsWith(key)));
      if (v) (out.months[key] ||= {})[cur] = v;
    }
  }
}
out.latest_date = latestDate;
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('rates.json', latestDate, JSON.stringify(out.latest), JSON.stringify(out.ytd));
