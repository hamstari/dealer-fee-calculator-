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

test('waterfall sends declined customers to the backup lender', () => {
  const w = C.waterfall({
    applyPct: 50, declinedCashPct: 20,
    lenders: [
      { approvalPct: 70, plans: [{ fee: 6, splitPct: 100 }] },
      { approvalPct: 50, plans: [{ fee: 3, splitPct: 50 }, { fee: 9, splitPct: 50 }] },
    ],
  });
  close(w.lenders[0].approved, 35);   // 50 * .7
  close(w.lenders[1].reached, 15);
  close(w.lenders[1].approved, 7.5);
  close(w.lenders[1].plans[0].share, 3.75);
  close(w.declined, 7.5);
  close(w.declinedCash, 1.5);
  close(w.lost, 6);
  close(w.closed, 94);
  close(w.cashBuyers, 51.5);
  // mix is % of closed jobs and sums with cash to 100
  const total = w.mix.reduce((t, m) => t + m.share, 0) + w.cashBuyers / w.closed * 100;
  close(total, 100);
});

test('waterfall normalizes plan splits and defaults to first plan', () => {
  const w = C.waterfall({ applyPct: 100, declinedCashPct: 0, lenders: [
    { approvalPct: 100, plans: [{ fee: 5, splitPct: 0 }, { fee: 8, splitPct: 0 }] },
  ] });
  close(w.lenders[0].plans[0].share, 100);
  close(w.lenders[0].plans[1].share, 0);
  const w2 = C.waterfall({ applyPct: 100, declinedCashPct: 0, lenders: [
    { approvalPct: 100, plans: [{ fee: 5, splitPct: 30 }, { fee: 8, splitPct: 30 }] },
  ] });
  close(w2.lenders[0].plans[0].share, 50);
});

test('waterfall result feeds blended price', () => {
  const w = C.waterfall({ applyPct: 40, declinedCashPct: 100, lenders: [{ approvalPct: 100, plans: [{ fee: 10, splitPct: 100 }] }] });
  const b = C.blendedPriceMix(10000, w.mix);
  close(b.price, 10000 / (1 - 0.4 * 0.1));
});
