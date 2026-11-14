(function () {
  'use strict';
  var C = window.DealerCalc;
  var LENDERS = C.expandSheets(window.LENDER_SHEETS || []);
  var STORE_KEY = 'job-price-calc-v6';
  var OLD_KEY = 'job-price-calc-v5';

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
  var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(x) ? x : 0; };
  var val = function (id) { return n($(id).value); };
  var radio = function (name) { var r = document.querySelector('input[name=' + name + ']:checked'); return r ? r.value : ''; };
  var setRadio = function (name, v) { var r = document.querySelector('input[name=' + name + '][value="' + v + '"]'); if (r) r.checked = true; };

  var FIELDS = ['materials', 'wastePct', 'laborHours', 'laborRate', 'subs', 'other', 'overheadPct', 'marginPct'];

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { v: 6, score: radio('score'), goal: radio('goal'), fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (!data) return;
      if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
      if (data.score && data.v === 6) setRadio('score', data.score);
      if (data.goal) setRadio('goal', data.goal);
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- financing ----------
  function payText(o) {
    if (o.kind === 'sac') return '$0 for ' + o.months + ' mo';
    return 'about ' + fmt(o.payment) + '/mo';
  }

  function renderFinancing(cashPrice) {
    if (!(cashPrice > 0)) {
      $('rec').innerHTML = '<p class="hint">Enter your costs above to see financing options.</p>';
      $('others').innerHTML = '';
      $('more-wrap').hidden = true;
      $('excluded-wrap').hidden = true;
      return;
    }
    var goal = radio('goal');
    var r = C.recommend(cashPrice, LENDERS, { score: n(radio('score')), goal: goal });

    if (!r.options.length) {
      $('rec').innerHTML = '<div class="no-rec">No plans available for this credit score.</div>';
    } else {
      var best = r.options[0];
      $('rec').innerHTML =
        '<div class="rec-card">' +
          '<div class="rec-head"><span class="rec-lender">' + esc(best.lender) + '</span><span class="rec-plan">' + esc(best.plan) + '</span></div>' +
          '<div class="rec-grid">' +
            '<div><span>Charge</span><strong class="rec-price">' + fmt(best.price) + '</strong></div>' +
            '<div><span>Payment</span><strong>' + payText(best).replace(/^about /, '') + '</strong></div>' +
            '<div><span>Dealer fee</span><strong>' + (best.fee === 0 ? 'None' : pct(best.fee) + ' (' + fmt(best.lenderFee) + ')') + '</strong></div>' +
          '</div>' +
        '</div>';
    }

    var rest = r.options.slice(1);
    var row = function (o) {
      return '<li class="plan"><div class="plan-info"><div class="plan-name">' + esc(o.plan) + '</div>' +
        '<div class="plan-meta">' + esc(o.lender) + ', ' + (o.fee === 0 ? 'no dealer fee' : pct(o.fee) + ' dealer fee') + '</div></div>' +
        '<div class="plan-figs"><strong>' + fmt(o.price) + '</strong><span>' + payText(o).replace(/^about /, '') + '</span></div></li>';
    };
    var SHOW = 3;
    $('others').innerHTML = rest.length ?
      '<ul class="plan-list">' + rest.slice(0, SHOW).map(row).join('') + '</ul>' : '';
    var more = rest.slice(SHOW);
    $('more-wrap').hidden = !more.length;
    $('more-summary').textContent = more.length + ' more';
    $('more').innerHTML = more.map(row).join('');

    $('excluded-wrap').hidden = !r.excluded.length;
    $('excluded-summary').textContent = r.excluded.length + ' not available';
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
      $('split-bar').innerHTML = '';
      $('split-legend').innerHTML = '';
      renderFinancing(0);
      save();
      return;
    }

    $('cash-price').textContent = fmt(price.price);

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

    save();
  }

  // ---------- sliders ----------
  var MONEY = ['materials', 'laborRate', 'subs', 'other'];
  var grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  function showValue(id, x) {
    $(id).value = MONEY.indexOf(id) >= 0 ? grouped.format(x) : String(Math.round(x * 100) / 100);
  }
  function syncSlider(id) {
    var r = document.querySelector('.slider[data-for="' + id + '"]');
    if (r) r.value = Math.min(n(r.max), Math.max(n(r.min), val(id)));
    if (r) r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.classList.contains('slider')) { showValue(t.dataset.for, n(t.value)); syncSlider(t.dataset.for); }
    else if (FIELDS.indexOf(t.id) >= 0) syncSlider(t.id);
    update();
  });
  // tidy the typed number (commas, no stray characters) when leaving a box
  document.addEventListener('focusout', function (e) {
    if (FIELDS.indexOf(e.target.id) >= 0) { showValue(e.target.id, val(e.target.id)); save(); }
  });
  document.addEventListener('change', function (e) { if (e.target.type === 'radio') update(); });

  // select the whole number when tapping a field, so it's easy to type over
  var justFocused = null;
  document.addEventListener('focusin', function (e) {
    if (FIELDS.indexOf(e.target.id) < 0) return;
    e.target.select();
    justFocused = e.target;
    setTimeout(function () { if (document.activeElement === e.target && justFocused === e.target) e.target.select(); }, 0);
  });
  // keep the selection when the focusing click/tap ends
  document.addEventListener('mouseup', function (e) {
    if (e.target === justFocused) e.preventDefault();
    justFocused = null;
  });
  document.addEventListener('keydown', function () { justFocused = null; });

  // ---------- init ----------
  $('rates-as-of').textContent = window.RATES_AS_OF ? 'Rates as of ' + window.RATES_AS_OF + '. Subject to lender approval.' : '';
  load();
  FIELDS.forEach(function (f) { showValue(f, val(f)); syncSlider(f); });
  update();
})();
