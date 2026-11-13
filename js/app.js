(function () {
  'use strict';
  var C = window.DealerCalc;
  var STORE_KEY = 'job-price-calc-v4';
  var OLD_KEYS = ['dealer-fee-calc-v3', 'dealer-fee-calc-v2'];

  var DEFAULT_PLANS = [
    { lender: 'Lender A', name: '12 mo same-as-cash', fee: 6 },
    { lender: 'Lender A', name: '18 mo no interest', fee: 9 },
    { lender: 'Lender A', name: '0% APR, 60 mo', fee: 14 },
    { lender: 'Lender B', name: '9.99% APR, 10 yr', fee: 3 },
    { lender: 'Lender B', name: '6.99% APR, 7 yr', fee: 7 },
  ];

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmt = function (x) { return isFinite(x) ? money.format(x) : '—'; };
  var pct = function (x) { return isFinite(x) ? (Math.round(x * 10) / 10) + '%' : '—'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
  var val = function (id) { return n($(id).value); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var FIELDS = ['materials', 'wastePct', 'laborHours', 'laborRate', 'subs', 'other', 'overheadPct', 'marginPct'];
  var plans = clone(DEFAULT_PLANS);

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { plans: plans, fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (data) {
        if (Array.isArray(data.plans)) plans = data.plans;
        if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
        return;
      }
      // carry lenders/plans over from the earlier versions
      for (var i = 0; i < OLD_KEYS.length; i++) {
        var old = JSON.parse(localStorage.getItem(OLD_KEYS[i]) || 'null');
        if (old && Array.isArray(old.lenders)) {
          var flat = [];
          old.lenders.forEach(function (l) {
            (l.plans || []).forEach(function (p) { flat.push({ lender: l.name || '', name: p.name || '', fee: p.fee }); });
          });
          if (flat.length) plans = flat;
          var f = old.fields || {};
          ['materials', 'subs', 'other', 'overheadPct', 'marginPct'].forEach(function (k) { if (f[k] != null) $(k).value = f[k]; });
          return;
        }
      }
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- plan editor ----------
  function renderEditor() {
    $('plan-editor').innerHTML = plans.map(function (p, i) {
      return '<div class="plan-edit" data-i="' + i + '">' +
        '<label><span>Lender</span><input data-k="lender" type="text" value="' + esc(p.lender) + '" placeholder="Lender"></label>' +
        '<label><span>Plan</span><input data-k="name" type="text" value="' + esc(p.name) + '" placeholder="e.g. 12 mo same-as-cash"></label>' +
        '<label><span>Dealer fee</span><span class="pct"><input data-k="fee" type="number" inputmode="decimal" min="0" max="99" step="any" value="' + esc(p.fee) + '"></span></label>' +
        '<button type="button" class="icon" data-remove aria-label="Remove ' + esc(p.name || 'plan') + '">×</button>' +
        '</div>';
    }).join('') || '<p class="hint block">No plans yet.</p>';
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
      $('plan-list').innerHTML = '<li class="hint">Fix your overhead and profit above.</li>';
      $('mistake').textContent = '';
      save();
      return;
    }

    $('cash-price').textContent = fmt(price.price);
    $('markup-line').textContent = cost.total > 0 ? 'That\'s a ' + pct(price.markupPct) + ' markup on your costs.' : 'Enter your costs above.';

    // where the money goes
    var parts = [
      { label: 'Job cost', v: cost.total, cls: 's-cost' },
      { label: 'Overhead', v: price.overhead, cls: 's-oh' },
      { label: 'Profit', v: price.profit, cls: 's-profit' },
    ];
    $('split-bar').innerHTML = price.price > 0 ? parts.map(function (p) {
      return p.v > 0 ? '<span class="' + p.cls + '" style="flex:' + p.v + '"></span>' : '';
    }).join('') : '';
    $('split-legend').innerHTML = price.price > 0 ? parts.map(function (p) {
      return '<li><i class="' + p.cls + '"></i>' + p.label + ' <b>' + fmt(p.v) + '</b></li>';
    }).join('') : '';

    // financing
    var fees = plans.map(function (p) { return n(p.fee); });
    var minFee = Math.min.apply(null, fees.length ? fees : [0]);
    var maxFee = Math.max.apply(null, fees.length ? fees : [0]);
    $('plan-list').innerHTML = plans.length ? plans.map(function (p) {
      var g = C.grossUp(price.price, n(p.fee), 0);
      if (g.error) return '<li class="plan"><div class="plan-name">' + esc(p.name) + '</div><div class="neg">' + esc(g.error) + '</div></li>';
      return '<li class="plan">' +
        '<div class="plan-info"><div class="plan-name">' + esc(p.name || 'Plan') +
          (fees.length > 1 && minFee !== maxFee && n(p.fee) === minFee ? ' <span class="tag">Lowest</span>' : '') + '</div>' +
          '<div class="plan-meta">' + (p.lender ? esc(p.lender) + ' · ' : '') + pct(n(p.fee)) + ' dealer fee</div></div>' +
        '<div class="plan-price"><strong>' + fmt(g.price) + '</strong><span>+' + fmt(g.increase) + '</span></div>' +
        '</li>';
    }).join('') : '<li class="hint">No plans yet. Open "Edit financing plans" to add one.</li>';

    if (maxFee > 0 && price.price > 0) {
      var top = plans[fees.indexOf(maxFee)];
      var nv = C.naiveMarkup(price.price, maxFee);
      var right = C.grossUp(price.price, maxFee, 0);
      $('mistake').innerHTML = 'Because the lender takes its fee from the <em>bigger</em> number. With "' + esc(top.name) + '" (' + pct(maxFee) + '): ' +
        fmt(price.price) + ' + ' + pct(maxFee) + ' = ' + fmt(nv.price) + ', but the lender keeps ' + fmt(nv.fee) +
        ', so you get only ' + fmt(nv.net) + '. That\'s <strong>' + fmt(nv.shortfall) + ' short</strong>. Charge ' + fmt(right.price) + ' instead.';
    } else {
      $('mistake').textContent = 'Add a financing plan to see an example.';
    }

    save();
  }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    var row = t.closest('.plan-edit');
    if (row && t.dataset.k) plans[+row.dataset.i][t.dataset.k] = t.value;
    update();
  });

  $('plan-editor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]');
    if (!b) return;
    plans.splice(+b.closest('.plan-edit').dataset.i, 1);
    renderEditor(); update();
  });

  $('add-plan').addEventListener('click', function () {
    var last = plans[plans.length - 1];
    plans.push({ lender: last ? last.lender : '', name: '', fee: 5 });
    renderEditor(); update();
    var names = $('plan-editor').querySelectorAll('input[data-k=name]');
    names[names.length - 1].focus();
  });

  $('reset-plans').addEventListener('click', function () {
    if (!confirm('Replace your financing plans with the examples?')) return;
    plans = clone(DEFAULT_PLANS);
    renderEditor(); update();
  });

  $('print').addEventListener('click', function () { window.print(); });

  // select the whole number when tapping a field, so it's easy to type over
  document.addEventListener('focusin', function (e) {
    if (e.target.matches('input[type=number]')) setTimeout(function () { e.target.select(); }, 0);
  });

  // ---------- init ----------
  load();
  renderEditor();
  update();
})();
