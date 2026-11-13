(function () {
  'use strict';
  var C = window.DealerCalc;
  var LENDERS = window.LENDERS || [];
  var STORE_KEY = 'job-price-calc-v5';
  var OLD_KEY = 'job-price-calc-v4';

  var GOAL_WHY = {
    price: 'lowest dealer fee, so the lowest price for your customer',
    promo: 'lowest dealer fee among the plans with no interest for a while',
    payment: 'lowest monthly payment for your customer',
  };

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmt = function (x) { return isFinite(x) ? money.format(x) : '—'; };
  var pct = function (x) { return isFinite(x) ? (Math.round(x * 100) / 100) + '%' : '—'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
  var val = function (id) { return n($(id).value); };
  var radio = function (name) { var r = document.querySelector('input[name=' + name + ']:checked'); return r ? r.value : ''; };
  var setRadio = function (name, v) { var r = document.querySelector('input[name=' + name + '][value="' + v + '"]'); if (r) r.checked = true; };

  var FIELDS = ['materials', 'wastePct', 'laborHours', 'laborRate', 'subs', 'other', 'overheadPct', 'marginPct'];

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { score: radio('score'), goal: radio('goal'), fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (!data) return;
      if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
      if (data.score) setRadio('score', data.score);
      if (data.goal) setRadio('goal', data.goal);
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- financing ----------
  function renderFinancing(cashPrice) {
    if (!(cashPrice > 0)) {
      $('rec').innerHTML = '<p class="hint">Enter your costs above to see financing options.</p>';
      $('others').innerHTML = '';
      $('excluded-wrap').hidden = true;
      return;
    }
    var goal = radio('goal');
    var r = C.recommend(cashPrice, LENDERS, { score: n(radio('score')), goal: goal });

    if (!r.options.length) {
      $('rec').innerHTML = '<div class="no-rec"><strong>No plan fits this customer.</strong> ' +
        (goal === 'promo' ? 'Try "Lowest price" instead of "No interest for a while", or check the reasons below.' : 'See the reasons below. A co-signer or a bigger down payment may help.') + '</div>';
    } else {
      var best = r.options[0];
      $('rec').innerHTML =
        '<div class="rec-card">' +
          '<div class="rec-top"><span class="rec-badge">Recommended</span><span class="rec-lender">' + esc(best.lender) + '</span></div>' +
          '<div class="rec-plan">' + esc(best.plan) + '</div>' +
          '<div class="rec-grid">' +
            '<div><span>Charge the customer</span><strong class="rec-price">' + fmt(best.price) + '</strong></div>' +
            '<div><span>About</span><strong>' + fmt(best.payment) + '/mo</strong></div>' +
            '<div><span>Dealer fee</span><strong>' + pct(best.fee) + ' (' + fmt(best.lenderFee) + ')</strong></div>' +
          '</div>' +
          '<p class="rec-why">Why: ' + GOAL_WHY[goal] + ' for this credit score. You still get your full ' + fmt(cashPrice) + '.</p>' +
          (best.note ? '<p class="rec-note">' + esc(best.note) + '</p>' : '') +
        '</div>';
    }

    var rest = r.options.slice(1);
    $('others').innerHTML = rest.length ?
      '<h3 class="sub-title">Other plans this customer qualifies for</h3><ul class="plan-list">' + rest.map(function (o) {
        return '<li class="plan"><div class="plan-info"><div class="plan-name">' + esc(o.plan) + '</div>' +
          '<div class="plan-meta">' + esc(o.lender) + ' · ' + pct(o.fee) + ' fee · about ' + fmt(o.payment) + '/mo</div></div>' +
          '<div class="plan-price"><strong>' + fmt(o.price) + '</strong></div></li>';
      }).join('') + '</ul>' : '';

    $('excluded-wrap').hidden = !r.excluded.length;
    $('excluded-summary').textContent = r.excluded.length + (r.excluded.length === 1 ? ' plan doesn\'t' : ' plans don\'t') + ' fit this customer';
    $('excluded').innerHTML = r.excluded.map(function (o) {
      return '<li><span>' + esc(o.lender) + ', ' + esc(o.plan) + '</span><em>' + esc(o.reason) + '</em></li>';
    }).join('');
  }

  // ---------- main update ----------
  function update() {
    var cost = C.jobCost({
      materials: val('materials'), wastePct: val('wastePct'),
      laborHours: val('laborHours'), laborRate: val('laborRate'),
      subs: val('subs'), other: val('other'),
    });
    $('cost-total').textContent = fmt(cost.total);

    var price = C.cashPriceFromCosts({ materials: cost.total, overheadPct: val('overheadPct'), marginPct: val('marginPct') });
    var bad = !!price.error;
    $('price-error').hidden = !bad;
    if (bad) {
      $('price-error').textContent = price.error;
      $('cash-price').textContent = '—';
      $('markup-line').textContent = '';
      $('split-bar').innerHTML = '';
      $('split-legend').innerHTML = '';
      $('mistake').textContent = '';
      renderFinancing(0);
      save();
      return;
    }

    $('cash-price').textContent = fmt(price.price);
    $('markup-line').textContent = cost.total > 0 ? 'That\'s a ' + (Math.round(price.markupPct * 10) / 10) + '% markup on your costs.' : 'Enter your costs above.';

    var parts = [
      { label: 'Job cost', v: cost.total, cls: 's-cost' },
      { label: 'Overhead', v: price.overhead, cls: 's-oh' },
      { label: 'Profit', v: price.profit, cls: 's-profit' },
    ];
    var show = price.price > 0;
    $('split-bar').innerHTML = show ? parts.map(function (p) {
      return p.v > 0 ? '<span class="' + p.cls + '" style="flex:' + p.v + '"></span>' : '';
    }).join('') : '';
    $('split-legend').innerHTML = show ? parts.map(function (p) {
      return '<li><i class="' + p.cls + '"></i>' + p.label + ' <b>' + fmt(p.v) + '</b></li>';
    }).join('') : '';

    renderFinancing(price.price);

    // "why not add the fee on top" example, using a typical 10% fee
    if (show) {
      var nv = C.naiveMarkup(price.price, 10);
      var right = C.grossUp(price.price, 10, 0);
      $('mistake').innerHTML = 'Because the lender takes its fee from the <em>bigger</em> number. With a 10% fee: ' +
        fmt(price.price) + ' + 10% = ' + fmt(nv.price) + ', but the lender keeps ' + fmt(nv.fee) +
        ', so you get only ' + fmt(nv.net) + '. That\'s <strong>' + fmt(nv.shortfall) + ' short</strong>. Charge ' + fmt(right.price) + ' instead.';
    }

    save();
  }

  // ---------- events ----------
  document.addEventListener('input', update);
  document.addEventListener('change', function (e) { if (e.target.type === 'radio') update(); });
  $('print').addEventListener('click', function () { window.print(); });

  // select the whole number when tapping a field, so it's easy to type over
  document.addEventListener('focusin', function (e) {
    if (e.target.matches('input[type=number]')) setTimeout(function () { e.target.select(); }, 0);
  });

  // ---------- init ----------
  $('example-note').hidden = !window.EXAMPLE_RATES;
  load();
  update();
})();
