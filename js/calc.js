/*
 * Dealer fee calculator — pure pricing math.
 * Works as a browser global (window.DealerCalc) and as a CommonJS module (for tests).
 * All percentages are passed in as whole numbers (e.g. 8 means 8%).
 */
(function (root) {
  'use strict';

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Build a cash price from job costs using margin-on-price
   * (overhead and profit are expressed as a % of the selling price, not of cost).
   */
  function cashPriceFromCosts(input) {
    var cost = num(input.materials) + num(input.labor) + num(input.subs) + num(input.other);
    var oh = num(input.overheadPct) / 100;
    var m = num(input.marginPct) / 100;
    var denom = 1 - oh - m;
    if (denom <= 0) {
      return { cost: cost, error: 'Overhead + profit must be less than 100% of the price.' };
    }
    var price = cost / denom;
    return {
      cost: cost,
      price: price,
      overhead: price * oh,
      profit: price * m,
      markupPct: cost > 0 ? ((price - cost) / cost) * 100 : 0,
    };
  }

  /**
   * Gross up a price so that, after the lender takes its dealer fee on the
   * financed amount, the contractor still nets `net`.
   *   net = price - fee * (price - down)   =>   price = (net - fee*down) / (1 - fee)
   */
  function grossUp(net, feePct, down) {
    var f = num(feePct) / 100;
    var d = Math.max(0, num(down));
    if (f >= 1) return { error: 'Dealer fee must be under 100%.' };
    if (d >= net) {
      // Customer is paying it all in cash — nothing is financed.
      return { price: net, financed: 0, fee: 0, net: net, increase: 0, increasePct: 0 };
    }
    var price = (net - f * d) / (1 - f);
    var financed = price - d;
    var fee = financed * f;
    return {
      price: price,
      financed: financed,
      fee: fee,
      net: price - fee,
      increase: price - net,
      increasePct: net > 0 ? ((price - net) / net) * 100 : 0,
    };
  }

  /**
   * The common mistake: multiplying the price by (1 + fee%) instead of dividing by (1 - fee%).
   * Returns how much the contractor comes up short.
   */
  function naiveMarkup(net, feePct) {
    var f = num(feePct) / 100;
    var price = net * (1 + f);
    var fee = price * f;
    return { price: price, fee: fee, net: price - fee, shortfall: net - (price - fee) };
  }

  /**
   * One price for every customer (cash or financed) that covers the *expected*
   * dealer fees, given the share of customers you expect to finance.
   *   net = price * (1 - share * fee)
   */
  function blendedPrice(net, feePct, sharePct) {
    var f = num(feePct) / 100;
    var s = Math.min(1, Math.max(0, num(sharePct) / 100));
    var denom = 1 - f * s;
    if (denom <= 0) return { error: 'Invalid fee / share combination.' };
    var price = net / denom;
    var fee = price * f;
    return {
      price: price,
      increase: price - net,
      increasePct: net > 0 ? ((price - net) / net) * 100 : 0,
      netIfCash: price,
      netIfFinanced: price - fee,
      feeIfFinanced: fee,
      expectedNet: price - fee * s,
    };
  }

  /** What happens to your margin if you absorb the fee instead of passing it on. */
  function absorbFee(cashPrice, profit, feePct) {
    var fee = num(cashPrice) * (num(feePct) / 100);
    var newProfit = num(profit) - fee;
    return {
      fee: fee,
      profit: newProfit,
      marginPct: cashPrice > 0 ? (newProfit / cashPrice) * 100 : 0,
    };
  }

  /** Standard amortized monthly payment. 0% APR => principal / months. */
  function monthlyPayment(principal, aprPct, months) {
    var p = num(principal);
    var n = Math.round(num(months));
    if (n <= 0 || p <= 0) return 0;
    var r = num(aprPct) / 100 / 12;
    if (r === 0) return p / n;
    return (p * r) / (1 - Math.pow(1 + r, -n));
  }

  var api = {
    cashPriceFromCosts: cashPriceFromCosts,
    grossUp: grossUp,
    naiveMarkup: naiveMarkup,
    blendedPrice: blendedPrice,
    absorbFee: absorbFee,
    monthlyPayment: monthlyPayment,
    round2: round2,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DealerCalc = api;
})(typeof window !== 'undefined' ? window : this);
