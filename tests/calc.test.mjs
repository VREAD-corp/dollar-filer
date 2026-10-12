// Hand-computed cases against calc.js. Each expected figure is worked out band by band in the comments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const DF = createRequire(import.meta.url)('../docs/assets/calc.js');

// Cumulative tax at each band top: 800k -> 0; 3M -> 330,000; 12M -> 1,950,000; 25M -> 4,680,000; 50M -> 10,430,000.
test('band tops', () => {
  for (const [ci, tax] of [[800000, 0], [3000000, 330000], [12000000, 1950000], [25000000, 4680000], [50000000, 10430000], [60000000, 12930000]])
    assert.equal(DF.bandTax(ci).tax, tax);
});

test('A: $36,000 salary at 1,365, rent 2.4m', () => {
  const r = DF.calculate({ fx: { USD: 1365 }, foreignSalary: { amount: 36000, cur: 'USD' }, rentPaid: 2400000 });
  assert.equal(r.totalIncome, 49140000);
  assert.equal(r.deductions, 480000); // 20% of 2.4m = 480k < 500k cap
  assert.equal(r.chargeable, 48660000);
  assert.equal(Math.round(r.netTax), 10121800); // 4,680,000 + 23,660,000 x 23% = 5,441,800
  assert.equal(r.effectiveRate.toFixed(4), '0.2060');
  assert.equal(Math.round(r.monthly), 843483);
});

test('B: £20,000 fees − £2,000 costs at 1,835, pension 600k', () => {
  const r = DF.calculate({ fx: { GBP: 1835 }, foreignFees: { amount: 20000, cur: 'GBP' }, foreignExpenses: { amount: 2000, cur: 'GBP' }, pension: 600000 });
  assert.equal(r.chargeable, 32430000);
  assert.equal(Math.round(r.netTax), 6388900); // 4,680,000 + 7,430,000 x 23% = 1,708,900
});

test('D: s.120 credit capped at Nigerian tax on foreign income', () => {
  const r = DF.calculate({ fx: { USD: 1400 }, foreignSalary: { amount: 50000, cur: 'USD' }, foreignTaxPaid: { amount: 5000, cur: 'USD' } });
  assert.equal(Math.round(r.grossTax), 15430000); // 10,430,000 + 20,000,000 x 25%
  assert.equal(Math.round(r.foreignTaxCredit), 7000000);
  assert.equal(Math.round(r.netTax), 8430000);
  const big = DF.calculate({ fx: { USD: 1400 }, foreignSalary: { amount: 50000, cur: 'USD' }, foreignTaxPaid: { amount: 20000, cur: 'USD' } });
  assert.equal(Math.round(big.foreignTaxCredit), 15430000);
  assert.equal(big.netTax, 0);
});

test('mixed income: credit is proportional (s.120(3))', () => {
  // foreign $20,000 x 1,500 = 30m; local salary 10m; total 40m; tax = 4,680,000 + 15m x 23% = 8,130,000
  // attributable = 8,130,000 x 30/40 = 6,097,500; paid abroad $5,000 = 7.5m -> credit 6,097,500
  const r = DF.calculate({ fx: { USD: 1500 }, foreignSalary: { amount: 20000, cur: 'USD' }, localSalary: 10000000, foreignTaxPaid: { amount: 5000, cur: 'USD' }, taxPaidNigeria: 1000000 });
  assert.equal(Math.round(r.grossTax), 8130000);
  assert.equal(Math.round(r.foreignTaxCredit), 6097500);
  assert.equal(Math.round(r.balance), 1032500);
});

test('rent relief cap and passive exemption', () => {
  const r = DF.calculate({ fx: { EUR: 1600 }, foreignPassive: { amount: 5000, cur: 'EUR' }, passiveViaApprovedChannel: true, localOther: 4000000, rentPaid: 6000000 });
  assert.equal(r.passiveExempt, 8000000);
  assert.equal(r.deductions, 500000);
  assert.equal(r.chargeable, 3500000);
  assert.equal(Math.round(r.netTax), 420000); // 330,000 + 500,000 x 18%
});

test('minimum wage and small salaries', () => {
  assert.equal(DF.calculate({ localSalary: 600000 }).netTax, 0);
  const m = DF.calculate({ localSalary: 840000 });
  assert.equal(m.minimumWageExempt, true);
  assert.equal(m.netTax, 0);
  assert.equal(Math.round(DF.calculate({ localSalary: 1000000 }).netTax), 30000); // 200,000 x 15%
});
