/* Dollar Filer calculator UI. All maths is in calc.js; nothing typed here is sent anywhere. */
(function () {
  'use strict';
  var DF = window.DollarFiler, R = DF.RULES;
  var $ = function (id) { return document.getElementById(id); };
  var FALLBACK = { date: '2026-10-12', ytd: { USD: 1365.12, GBP: 1835.2, EUR: 1583.51 }, latest: { USD: 1331.6, GBP: 1761.97, EUR: 1488.59 } };
  var rates = { ytd: FALLBACK.ytd, latest: FALLBACK.latest, date: FALLBACK.date, from: '2026-01-02' };

  var STATES = [['abia','Abia'],['adamawa','Adamawa'],['akwa-ibom','Akwa Ibom'],['anambra','Anambra'],['bauchi','Bauchi'],['bayelsa','Bayelsa'],['benue','Benue'],['borno','Borno'],['cross-river','Cross River'],['delta','Delta'],['ebonyi','Ebonyi'],['edo','Edo'],['ekiti','Ekiti'],['enugu','Enugu'],['fct','FCT (Abuja)'],['gombe','Gombe'],['imo','Imo'],['jigawa','Jigawa'],['kaduna','Kaduna'],['kano','Kano'],['katsina','Katsina'],['kebbi','Kebbi'],['kogi','Kogi'],['kwara','Kwara'],['lagos','Lagos'],['nasarawa','Nasarawa'],['niger','Niger'],['ogun','Ogun'],['ondo','Ondo'],['osun','Osun'],['oyo','Oyo'],['plateau','Plateau'],['rivers','Rivers'],['sokoto','Sokoto'],['taraba','Taraba'],['yobe','Yobe'],['zamfara','Zamfara']];
  var AUTH = {
    lagos: { name: 'Lagos State Internal Revenue Service (LIRS)', how: 'File and pay on LIRS eTax at <a href="https://etax.lirs.net" rel="noopener">etax.lirs.net</a>. You create your payer ID there with your BVN and date of birth; payment is a "Direct Assessment" bill.' },
    fct: { name: 'FCT Internal Revenue Service (FCT-IRS)', how: 'File on the FCT-IRS portal at <a href="https://taxporta.fctirs.gov.ng" rel="noopener">taxporta.fctirs.gov.ng</a>. FCT-IRS says e-filing is the approved method and asks that your NIN, phone and address match.' }
  };

  var sel = $('state');
  sel.innerHTML = '<option value="">Choose your state</option>' + STATES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '<option value="abroad">I live outside Nigeria</option>';

  function fmt(n) { return (n < 0 ? '−₦' : '₦') + Math.abs(Math.round(n)).toLocaleString('en-NG'); }
  function fmt2(n, cur) { return (cur === 'USD' ? '$' : cur === 'GBP' ? '£' : '€') + Math.round(n).toLocaleString('en-NG'); }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function v(id) { return DF.num($(id).value); }
  function money(id) { return { amount: v(id) * Number(($(id + '_per') || { value: 1 }).value), cur: $(id + '_cur').value }; }
  function mode() { var r = document.querySelector('input[name=fxmode]:checked'); return r ? r.value : 'ytd'; }
  function fillFx() {
    var m = mode();
    if (m === 'own') return;
    ['USD', 'GBP', 'EUR'].forEach(function (c) { $('fx_' + c).value = String(m === 'latest' ? rates.latest[c] : rates.ytd[c]); });
  }
  function notes() {
    $('fx_ytd_note').textContent = '(' + rates.from + ' to ' + rates.date + ')';
    $('fx_latest_note').textContent = '(' + rates.date + ')';
    $('fx_src_date').textContent = 'the copy in use is dated ' + rates.date;
  }

  fetch('rates.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.ytd || !j.latest) return;
    rates = { date: j.latest_date, from: j.ytd.USD.from, ytd: {}, latest: {} };
    ['USD', 'GBP', 'EUR'].forEach(function (c) { rates.ytd[c] = j.ytd[c].rate; rates.latest[c] = j.latest[c].rate; });
    notes(); fillFx(); run();
  }).catch(function () {});
  notes(); fillFx();

  function input() {
    return {
      fx: { USD: v('fx_USD'), GBP: v('fx_GBP'), EUR: v('fx_EUR') },
      foreignSalary: money('fs'), foreignFees: money('ff'), foreignExpenses: money('fe'),
      foreignPassive: money('fp'), passiveViaApprovedChannel: $('fp_ok').checked,
      localSalary: v('ls'), localBusiness: v('lb'), localOther: v('lo'),
      rentPaid: v('rent'), pension: v('pen'), nhf: v('nhf'), nhis: v('nhis'), mortgageInterest: v('mort'), lifeInsurance: v('life'),
      taxPaidNigeria: v('paye'), foreignTaxPaid: { amount: v('ftax'), cur: $('ftax_cur').value }
    };
  }

  var tracked = false;
  function run(fromSubmit) {
    var inp = input(), r = DF.calculate(inp), st = sel.value, res = $('resident').value;
    var out = [];
    if (r.totalIncome <= 0 && !fromSubmit) { $('out').innerHTML = '<p class="small">Type an amount on the left. The estimate updates as you type.</p>'; return; }
    if (res === 'no' || st === 'abroad') out.push('<div class="note"><strong>If you are not a Nigerian tax resident,</strong> your foreign pay is generally outside Nigerian tax: non-residents are taxed on income from Nigeria, and money merely brought into Nigeria is not taxed for that reason (NTA 2025 s.4, s.17). The figures below assume you are resident, so they overstate your position.</div>');
    if (res === 'unsure') out.push('<div class="note">The residence test is wide: any one of these makes you resident for 2026: domiciled in Nigeria, a home available to you here, your habitual abode here, substantial economic and family ties here, 183 days or more here in 12 months (NTA 2025 s.202). <a href="file.html#resident">Check the test</a>.</div>');
    var usd = inp.fx.USD || 0;
    out.push('<p class="small" style="margin:0">Estimated income tax for 2026</p>');
    out.push('<p class="big" id="r_tax">' + fmt(r.netTax) + '</p>');
    if (usd) out.push('<p class="small" style="margin:0">about ' + fmt2(r.netTax / usd, 'USD') + ' at ₦' + usd.toLocaleString('en-NG') + '/$</p>');
    out.push('<div class="kpis">' +
      '<div class="kpi"><span>Effective rate</span><strong id="r_eff">' + pct(r.effectiveRate) + '</strong></div>' +
      '<div class="kpi"><span>Set aside each month</span><strong id="r_month">' + fmt(r.monthly) + '</strong></div>' +
      '<div class="kpi"><span>Chargeable income</span><strong id="r_charge">' + fmt(r.chargeable) + '</strong></div>' +
      '<div class="kpi"><span>' + (r.balance >= 0 ? 'Still to pay after tax already paid' : 'Paid more than the estimate by') + '</span><strong id="r_bal">' + fmt(Math.abs(r.balance)) + '</strong></div></div>');
    if (r.minimumWageExempt) out.push('<div class="note ok">Your only income is employment income at or below the national minimum wage (₦70,000 a month): it is exempt (NTA 2025 s.58, s.163(1)(t)).</div>');

    var rows = '<tr><th>Step</th><th class="n">₦</th></tr>';
    function line(label, n, cite, cls) { rows += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + (cite ? ' <span class="cite">' + cite + '</span>' : '') + '</td><td class="n">' + fmt(n) + '</td></tr>'; }
    if (r.foreignSalary) line('Foreign salary', r.foreignSalary, 's.12, s.13(1)(a)');
    if (r.foreignFees) line('Freelance fees less costs (' + fmt(r.foreignFees) + ' − ' + fmt(r.foreignExpenses) + ')', r.foreignBusiness, 's.20');
    if (r.foreignPassive) line('Foreign investment income' + (r.passiveExempt ? ', exempt via approved channel' : ''), r.foreignPassive - r.passiveExempt, r.passiveExempt ? 's.163(1)(s)' : 's.12');
    if (r.localSalary) line('Nigerian salary', r.localSalary, 's.4(2)');
    if (r.localBusiness) line('Nigerian business profit', r.localBusiness, 's.4(1)(a)');
    if (r.localOther) line('Other income', r.localOther, 's.4');
    line('<strong>Total income</strong>', r.totalIncome, 's.28');
    r.deductionLines.forEach(function (d) { if (d.amount) line('less ' + d.label, -d.amount, d.cite); });
    line('<strong>Chargeable income</strong>', r.chargeable, 's.30(1)');
    out.push('<h3>How we got there</h3><table>' + rows + '</table>');

    var b = '<tr><th>Band (Fourth Schedule)</th><th class="n">Rate</th><th class="n">Taxed</th><th class="n">Tax</th></tr>';
    r.bands.forEach(function (x) {
      var lab = x.to === null ? 'Above ' + fmt(x.from) : (x.from === 0 ? 'First ' : 'Next ') + fmt(x.to - x.from);
      b += '<tr class="' + (x.taxable ? '' : 'zero') + '"><td>' + lab + '</td><td class="n">' + Math.round(x.rate * 100) + '%</td><td class="n">' + fmt(x.taxable) + '</td><td class="n">' + fmt(x.tax) + '</td></tr>';
    });
    b += '<tr><td colspan="3"><strong>Tax before credits</strong></td><td class="n"><strong id="r_gross">' + fmt(r.grossTax) + '</strong></td></tr>';
    if (r.foreignTaxCredit) b += '<tr><td colspan="3">less foreign tax credit <span class="cite">s.120</span></td><td class="n">' + fmt(-r.foreignTaxCredit) + '</td></tr>';
    if (r.taxPaidNigeria) b += '<tr><td colspan="3">less PAYE / withholding already paid</td><td class="n">' + fmt(-r.taxPaidNigeria) + '</td></tr>';
    out.push('<h3>Tax by band</h3><table id="bands">' + b + '</table>');
    if (r.foreignTaxPaid > r.foreignTaxCredit) out.push('<div class="note">You paid ' + fmt(r.foreignTaxPaid) + ' abroad but the credit stops at the Nigerian tax on that income (' + fmt(r.foreignTaxCredit) + '). The rest is not refunded by Nigeria (s.120(2)).</div>');
    if (r.warnings.indexOf('business_loss') >= 0) out.push('<div class="note">Your costs are higher than your fees. We count the freelance line as zero; a loss can only be carried forward against future profit of the same business (s.28(3)).</div>');

    var a = AUTH[st], where;
    if (a) where = '<strong>Where you file:</strong> ' + a.name + '. ' + a.how;
    else if (st && st !== 'abroad') where = '<strong>Where you file:</strong> the internal revenue service of ' + sel.options[sel.selectedIndex].text + ' State, because that is where you lived on 1 January (Twelfth Schedule, para. 1 and 6). We have not checked that state\'s portal ourselves; use the address on its official site.';
    else where = '<strong>Where you file:</strong> the internal revenue service of the state where you lived on 1 January 2026.';
    out.push('<div class="note ok">' + where + ' Return and payment for 2026 income: by <strong>31 March 2027</strong> on our reading (<a href="file.html#deadline">why we say "our reading"</a>).</div>');
    out.push('<details class="no-print"><summary>Known gaps in this estimate</summary><ul class="small">' +
      '<li>NTAA s.39 says tax "shall be assessed in the currency of transaction". Nobody has said how states will apply this to a person paid in dollars; we compute in naira because the bands are in naira.</li>' +
      '<li>The deadline is not printed in NTAA s.13; state services announce 31 March and have extended it before (FCT-IRS moved 2026 to 30 April).</li>' +
      '<li>Version ' + R.version + ' follows the Act as gazetted on 26 June 2025. If it has been amended since, we may be behind.</li></ul></details>');
    out.push('<p class="no-print"><button type="button" class="btn ghost" id="printbtn">Print or save this summary</button></p>');
    out.push('<p class="small">Rules v' + R.version + ' · CBN rates used: $1 = ₦' + (inp.fx.USD || 0).toLocaleString('en-NG') + ', £1 = ₦' + (inp.fx.GBP || 0).toLocaleString('en-NG') + ', €1 = ₦' + (inp.fx.EUR || 0).toLocaleString('en-NG') + '. Estimate only, not tax advice.</p>');
    $('out').innerHTML = out.join('');
    $('printbtn').onclick = function () { $('printed').textContent = new Date().toISOString().slice(0, 10); if (window.dfTrack) window.dfTrack('print'); window.print(); };
    if (!tracked && r.totalIncome > 0 && window.dfTrack) { tracked = true; window.dfTrack('calc_done'); }
  }

  document.querySelectorAll('.rv').forEach(function (e) { e.textContent = R.version; });
  $('calc').addEventListener('input', function (e) {
    if (/^fx_(USD|GBP|EUR)$/.test(e.target.id)) document.querySelector('input[name=fxmode][value=own]').checked = true;
    if (e.target.name === 'fxmode') fillFx();
    run();
  });
  $('calc').addEventListener('change', function (e) { if (e.target.name === 'fxmode') { fillFx(); run(); } });
  $('calc').addEventListener('submit', function (e) { e.preventDefault(); run(true); if (window.innerWidth < 900) $('result').scrollIntoView({ behavior: 'smooth' }); });
})();
