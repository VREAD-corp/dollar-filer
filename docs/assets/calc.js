/* Dollar Filer: Nigerian personal income tax estimator, 2026 rules.
 * Source of every number: Nigeria Tax Act 2025 (Act No. 7, gazetted 26 June 2025, in force 1 January 2026)
 * and Nigeria Tax Administration Act 2025 (Act No. 5). Section numbers are in RULES.cite.
 * Pure functions, no DOM: the same file runs in the browser and in Node tests. */
(function (root) {
  'use strict';
  var RULES = {
    version: '2026.1',
    checked: '2026-10-13',
    yearOfIncome: 2026,
    // Fourth Schedule NTA 2025 (s.58): width of each band in naira, then rate.
    bands: [
      { width: 800000, rate: 0 },
      { width: 2200000, rate: 0.15 },
      { width: 9000000, rate: 0.18 },
      { width: 13000000, rate: 0.21 },
      { width: 25000000, rate: 0.23 },
      { width: Infinity, rate: 0.25 }
    ],
    rentReliefRate: 0.2,      // s.30(2)(a)(vi): 20% of annual rent paid
    rentReliefCap: 500000,    // s.30(2)(a)(vi): maximum N500,000
    // s.58 and s.163(1)(t): employment income of a minimum-wage earner is exempt.
    // N70,000 a month under the National Minimum Wage (Amendment) Act 2024, the Act the NTA points to.
    minimumWageAnnual: 840000,
    cite: {
      residence: 'NTA 2025 s.202 (definition of "resident individual") and s.12',
      worldwide: 'NTA 2025 s.12',
      employment: 'NTA 2025 s.13(1)(a)',
      business: 'NTA 2025 s.20 and s.21',
      fxExpense: 'NTA 2025 s.20(4)',
      foreignPassiveExempt: 'NTA 2025 s.163(1)(s)',
      reliefs: 'NTA 2025 s.30(2)(a)',
      claimInWriting: 'NTA 2025 s.31 and s.32',
      bands: 'NTA 2025 s.58 and Fourth Schedule',
      minimumWage: 'NTA 2025 s.58 and s.163(1)(t)',
      foreignTaxCredit: 'NTA 2025 s.120',
      stateOfResidence: 'NTA 2025 Twelfth Schedule, para. 1 and 6',
      returnDuty: 'NTAA 2025 s.13 and s.34',
      currency: 'NTAA 2025 s.39',
      records: 'NTAA 2025 s.31(5)',
      penalties: 'NTAA 2025 s.65, s.100 and s.101'
    }
  };

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s₦$£€]/g, ''));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /** Tax on chargeable income, band by band. Returns {tax, rows:[{from,to,rate,taxable,tax}]} */
  function bandTax(chargeable) {
    var left = Math.max(0, chargeable), from = 0, tax = 0, rows = [];
    for (var i = 0; i < RULES.bands.length; i++) {
      var b = RULES.bands[i];
      var taxable = Math.min(left, b.width);
      var t = taxable * b.rate;
      rows.push({ from: from, to: b.width === Infinity ? null : from + b.width, rate: b.rate, taxable: taxable, tax: t });
      tax += t;
      left -= taxable;
      from += b.width;
    }
    return { tax: tax, rows: rows };
  }

  /**
   * input = {
   *   fx: {USD: n, GBP: n, EUR: n},                 naira per unit
   *   foreignSalary: {amount, cur},                 paid by a foreign employer
   *   foreignFees: {amount, cur}, foreignExpenses: {amount, cur},   freelance / contract
   *   foreignPassive: {amount, cur}, passiveViaApprovedChannel: bool
   *   localSalary, localBusiness, localOther,       naira, gross
   *   pension, nhf, nhis, mortgageInterest, lifeInsurance, rentPaid,   naira paid in the year
   *   foreignTaxPaid: {amount, cur},                tax already paid abroad on that income
   *   taxPaidNigeria                                PAYE / withholding already deducted in Nigeria (naira)
   * }
   */
  function calculate(input) {
    input = input || {};
    var fx = input.fx || {};
    var warnings = [];
    function toNaira(m) {
      if (!m) return 0;
      var a = num(m.amount);
      if (!a) return 0;
      var cur = m.cur || 'USD';
      if (cur === 'NGN') return a;
      var r = num(fx[cur]);
      if (!r) { warnings.push('missing_rate_' + cur); return 0; }
      return a * r;
    }
    var foreignSalary = toNaira(input.foreignSalary);
    var fees = toNaira(input.foreignFees);
    var expenses = toNaira(input.foreignExpenses);
    var foreignBusiness = Math.max(0, fees - expenses);
    if (expenses > fees && fees > 0) warnings.push('business_loss');
    var passive = toNaira(input.foreignPassive);
    var passiveExempt = input.passiveViaApprovedChannel ? passive : 0;
    var passiveTaxable = passive - passiveExempt;
    var localSalary = num(input.localSalary);
    var localBusiness = num(input.localBusiness);
    var localOther = num(input.localOther);

    var foreignIncome = foreignSalary + foreignBusiness + passiveTaxable;
    var totalIncome = foreignIncome + localSalary + localBusiness + localOther;

    var rentRelief = Math.min(num(input.rentPaid) * RULES.rentReliefRate, RULES.rentReliefCap);
    var deductionLines = [
      { key: 'pension', label: 'Pension contributions (Pension Reform Act)', amount: num(input.pension), cite: 's.30(2)(a)(iii)' },
      { key: 'nhf', label: 'National Housing Fund', amount: num(input.nhf), cite: 's.30(2)(a)(i)' },
      { key: 'nhis', label: 'National Health Insurance', amount: num(input.nhis), cite: 's.30(2)(a)(ii)' },
      { key: 'mortgageInterest', label: 'Interest on loan for your own home', amount: num(input.mortgageInterest), cite: 's.30(2)(a)(iv)' },
      { key: 'lifeInsurance', label: 'Life insurance or deferred annuity premiums', amount: num(input.lifeInsurance), cite: 's.30(2)(a)(v)' },
      { key: 'rentRelief', label: 'Rent relief (20% of rent, max ₦500,000)', amount: rentRelief, cite: 's.30(2)(a)(vi)' }
    ];
    var deductions = 0;
    deductionLines.forEach(function (d) { deductions += d.amount; });
    var deductionsUsed = Math.min(deductions, totalIncome);
    var chargeable = Math.max(0, totalIncome - deductionsUsed);

    var onlyEmployment = foreignBusiness === 0 && passiveTaxable === 0 && localBusiness === 0 && localOther === 0;
    var employmentTotal = foreignSalary + localSalary;
    var minimumWageExempt = onlyEmployment && employmentTotal > 0 && employmentTotal <= RULES.minimumWageAnnual;

    var bt = bandTax(minimumWageExempt ? 0 : chargeable);
    var tax = bt.tax;

    // s.120: credit = lower of (Nigerian tax x foreign income / total income) and tax paid abroad.
    var foreignTaxPaid = toNaira(input.foreignTaxPaid);
    var attributable = totalIncome > 0 ? tax * (foreignIncome / totalIncome) : 0;
    var credit = Math.min(attributable, foreignTaxPaid);
    var netTax = Math.max(0, tax - credit);
    var paidNigeria = num(input.taxPaidNigeria);
    var balance = netTax - paidNigeria;

    return {
      rulesVersion: RULES.version,
      foreignSalary: foreignSalary,
      foreignFees: fees,
      foreignExpenses: expenses,
      foreignBusiness: foreignBusiness,
      foreignPassive: passive,
      passiveExempt: passiveExempt,
      foreignIncome: foreignIncome,
      localSalary: localSalary,
      localBusiness: localBusiness,
      localOther: localOther,
      totalIncome: totalIncome,
      deductionLines: deductionLines,
      deductions: deductionsUsed,
      chargeable: minimumWageExempt ? 0 : chargeable,
      minimumWageExempt: minimumWageExempt,
      bands: bt.rows,
      grossTax: tax,
      foreignTaxPaid: foreignTaxPaid,
      foreignTaxCredit: credit,
      netTax: netTax,
      taxPaidNigeria: paidNigeria,
      balance: balance,
      effectiveRate: totalIncome > 0 ? netTax / totalIncome : 0,
      monthly: netTax / 12,
      warnings: warnings
    };
  }

  var api = { RULES: RULES, calculate: calculate, bandTax: bandTax, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DollarFiler = api;
})(typeof self !== 'undefined' ? self : this);
