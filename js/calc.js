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
   * Total job cost from estimating inputs:
   * materials plus a waste allowance, labor as hours x rate, subs and other.
   */
  function jobCost(input) {
    var materials = Math.max(0, num(input.materials));
    var waste = materials * (Math.max(0, num(input.wastePct)) / 100);
    var labor = Math.max(0, num(input.laborHours)) * Math.max(0, num(input.laborRate));
    var subs = Math.max(0, num(input.subs));
    var other = Math.max(0, num(input.other));
    return {
      materials: materials + waste,
      waste: waste,
      labor: labor,
      subs: subs,
      other: other,
      total: materials + waste + labor + subs + other,
    };
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

  /**
   * Blended price across a mix of plans (e.g. several lenders).
   * mix: [{ fee: pct, share: pct of all customers }]. Remaining share pays cash.
   *   net = price * (1 - sum(share_i * fee_i))
   */
  function blendedPriceMix(net, mix) {
    var totalShare = 0, weighted = 0;
    (mix || []).forEach(function (m) {
      var s = Math.max(0, num(m.share)) / 100;
      totalShare += s;
      weighted += s * (num(m.fee) / 100);
    });
    if (totalShare > 1.0000001) return { error: 'Shares add up to more than 100% of customers.' };
    var denom = 1 - weighted;
    if (denom <= 0) return { error: 'Invalid fee / share combination.' };
    var price = net / denom;
    return {
      price: price,
      increase: price - net,
      increasePct: net > 0 ? ((price - net) / net) * 100 : 0,
      financedShare: totalShare * 100,
      avgFeePct: totalShare > 0 ? (weighted / totalShare) * 100 : 0,
      netIfCash: price,
      expectedNet: price * denom,
      perPlan: (mix || []).map(function (m) {
        var fee = price * (num(m.fee) / 100);
        return { fee: fee, net: price - fee };
      }),
    };
  }

  /**
   * Approval waterfall: customers who want financing go to lenders in order;
   * anyone declined moves to the next lender. Declined by all => some still
   * buy with cash, the rest are lost.
   *   opts.applyPct         % of all customers who apply for financing
   *   opts.declinedCashPct  % of fully-declined customers who still buy with cash
   *   opts.lenders          [{ approvalPct, plans: [{ fee, splitPct }] }] in waterfall order
   * Plan splits within a lender are normalized to 100% (all on the first plan if they sum to 0).
   * Returns shares as % of ALL customers, and `mix` as % of CLOSED jobs, ready for blendedPriceMix.
   */
  function waterfall(opts) {
    var apply = Math.min(1, Math.max(0, num(opts.applyPct) / 100));
    var remaining = apply;
    var lenders = (opts.lenders || []).map(function (l) {
      var r = Math.min(1, Math.max(0, num(l.approvalPct) / 100));
      var reached = remaining;
      var approved = reached * r;
      remaining = reached - approved;
      var plans = l.plans || [];
      var splitSum = plans.reduce(function (t, p) { return t + Math.max(0, num(p.splitPct)); }, 0);
      return {
        reached: reached * 100,
        approved: approved * 100,
        splitSum: splitSum,
        plans: plans.map(function (p, i) {
          var w = splitSum > 0 ? Math.max(0, num(p.splitPct)) / splitSum : (i === 0 ? 1 : 0);
          return { fee: num(p.fee), share: approved * w * 100 };
        }),
      };
    });
    var dc = Math.min(1, Math.max(0, num(opts.declinedCashPct) / 100));
    var declined = remaining;
    var lost = declined * (1 - dc);
    var closed = 1 - lost;
    var mix = [];
    lenders.forEach(function (l) {
      l.plans.forEach(function (p) { mix.push({ fee: p.fee, share: closed > 0 ? p.share / closed : 0 }); });
    });
    return {
      lenders: lenders,
      declined: declined * 100,
      declinedCash: declined * dc * 100,
      lost: lost * 100,
      cashBuyers: (1 - apply + declined * dc) * 100,
      closed: closed * 100,
      mix: mix,
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
    jobCost: jobCost,
    cashPriceFromCosts: cashPriceFromCosts,
    grossUp: grossUp,
    naiveMarkup: naiveMarkup,
    blendedPrice: blendedPrice,
    blendedPriceMix: blendedPriceMix,
    waterfall: waterfall,
    absorbFee: absorbFee,
    monthlyPayment: monthlyPayment,
    round2: round2,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DealerCalc = api;
})(typeof window !== 'undefined' ? window : this);
