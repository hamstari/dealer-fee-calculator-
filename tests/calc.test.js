const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const close = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('cash price uses margin on price, not markup on cost', () => {
  const r = C.cashPriceFromCosts({ materials: 4000, labor: 3000, subs: 0, other: 0, overheadPct: 10, marginPct: 20 });
  close(r.cost, 7000);
  close(r.price, 10000);
  close(r.overhead, 1000);
  close(r.profit, 2000);
  close(r.markupPct, 42.857);
});

test('cash price errors when overhead + margin >= 100%', () => {
  assert.ok(C.cashPriceFromCosts({ materials: 1, overheadPct: 50, marginPct: 50 }).error);
});

test('gross-up nets the contractor exactly the cash price', () => {
  const r = C.grossUp(10000, 10, 0);
  close(r.price, 11111.11);
  close(r.fee, 1111.11);
  close(r.net, 10000);
});

test('gross-up only charges the fee on the financed portion', () => {
  const r = C.grossUp(10000, 10, 2000);
  close(r.financed, r.price - 2000);
  close(r.net, 10000);
  close(r.price, 10888.89);
});

test('down payment covering the whole job means nothing is financed', () => {
  const r = C.grossUp(10000, 10, 12000);
  assert.equal(r.fee, 0);
  assert.equal(r.price, 10000);
});

test('naive markup leaves money on the table', () => {
  const r = C.naiveMarkup(10000, 10);
  close(r.price, 11000);
  close(r.net, 9900);
  close(r.shortfall, 100);
});

test('blended price covers expected fees', () => {
  const r = C.blendedPrice(10000, 10, 50);
  close(r.price, 10526.32);
  close(r.expectedNet, 10000);
  close(r.netIfFinanced, 9473.68);
});

test('absorbing the fee cuts margin', () => {
  const r = C.absorbFee(10000, 2000, 8);
  close(r.fee, 800);
  close(r.marginPct, 12);
});

test('monthly payment', () => {
  close(C.monthlyPayment(12000, 0, 12), 1000);
  close(C.monthlyPayment(10000, 9.99, 120), 132.10, 0.01);
  assert.equal(C.monthlyPayment(10000, 5, 0), 0);
});

test('blended mix across two lenders covers expected fees', () => {
  const r = C.blendedPriceMix(10000, [{ fee: 6, share: 20 }, { fee: 3, share: 20 }]);
  // weighted fee = 0.2*0.06 + 0.2*0.03 = 0.018
  close(r.price, 10183.30);
  close(r.expectedNet, 10000);
  close(r.financedShare, 40);
  close(r.avgFeePct, 4.5);
  close(r.perPlan[0].net, 10183.30 * 0.94);
});

test('blended mix rejects shares over 100%', () => {
  assert.ok(C.blendedPriceMix(10000, [{ fee: 6, share: 70 }, { fee: 3, share: 40 }]).error);
});

test('blended mix with no financing is the cash price', () => {
  close(C.blendedPriceMix(10000, []).price, 10000);
});
