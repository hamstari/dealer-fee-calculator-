(function () {
  'use strict';
  var C = window.DealerCalc;
  var STORE_KEY = 'dealer-fee-calc-v1';

  var DEFAULT_PLANS = [
    { name: '12 mo same-as-cash', fee: 6, apr: 0, months: 12 },
    { name: '18 mo no interest', fee: 9, apr: 0, months: 18 },
    { name: '9.99% APR, 10 yr', fee: 3, apr: 9.99, months: 120 },
    { name: '0% APR, 60 mo', fee: 14, apr: 0, months: 60 },
  ];

  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt = function (n) { return isFinite(n) ? money.format(n) : '—'; };
  var fmt2 = function (n) { return isFinite(n) ? money2.format(n) : '—'; };
  var pct = function (n) { return isFinite(n) ? (Math.round(n * 10) / 10) + '%' : '—'; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var val = function (id) { var n = parseFloat($(id).value); return isFinite(n) ? n : 0; };

  var FIELDS = ['materials', 'labor', 'subs', 'other', 'overheadPct', 'marginPct', 'directPrice', 'directProfit', 'down', 'share'];
  var plans = DEFAULT_PLANS.map(function (p) { return Object.assign({}, p); });
  var blendIndex = 0;

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { mode: mode(), plans: plans, blendIndex: blendIndex, fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!data) return;
      if (Array.isArray(data.plans) && data.plans.length) plans = data.plans;
      if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
      if (data.mode) document.querySelector('input[name=mode][value="' + data.mode + '"]').checked = true;
      if (typeof data.blendIndex === 'number') blendIndex = data.blendIndex;
    } catch (e) { /* ignore bad data */ }
  }

  function mode() { return document.querySelector('input[name=mode]:checked').value; }

  // ---------- plan editor ----------
  function renderPlanRows() {
    $('plan-rows').innerHTML = plans.map(function (p, i) {
      return '<tr data-i="' + i + '">' +
        '<td><input aria-label="Plan name" data-k="name" type="text" value="' + esc(p.name) + '"></td>' +
        '<td><span class="pct"><input aria-label="Dealer fee percent" data-k="fee" type="number" inputmode="decimal" min="0" max="99" step="any" value="' + esc(p.fee) + '"></span></td>' +
        '<td><span class="pct"><input aria-label="Customer APR" data-k="apr" type="number" inputmode="decimal" min="0" step="any" value="' + esc(p.apr) + '"></span></td>' +
        '<td><input aria-label="Term in months" data-k="months" type="number" inputmode="numeric" min="0" step="1" value="' + esc(p.months) + '"></td>' +
        '<td><button type="button" class="icon" data-remove="' + i + '" aria-label="Remove ' + esc(p.name) + '">×</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderBlendSelect() {
    if (blendIndex >= plans.length) blendIndex = 0;
    $('blend-plan').innerHTML = plans.map(function (p, i) {
      return '<option value="' + i + '"' + (i === blendIndex ? ' selected' : '') + '>' + esc(p.name || 'Plan ' + (i + 1)) + ' (' + pct(parseFloat(p.fee) || 0) + ')</option>';
    }).join('');
  }

  // ---------- main calculation ----------
  function getCash() {
    if (mode() === 'costs') {
      var r = C.cashPriceFromCosts({
        materials: val('materials'), labor: val('labor'), subs: val('subs'), other: val('other'),
        overheadPct: val('overheadPct'), marginPct: val('marginPct'),
      });
      return r;
    }
    var price = val('directPrice');
    var profitRaw = $('directProfit').value.trim();
    return { price: price, profit: profitRaw === '' ? null : parseFloat(profitRaw) || 0, direct: true };
  }

  function update() {
    var cash = getCash();
    var out = $('cash-summary');

    if (cash.error) {
      out.innerHTML = '<p class="err">' + esc(cash.error) + '</p>';
      $('result-rows').innerHTML = '';
      $('mistake').hidden = true;
      $('blend-out').innerHTML = '';
      save();
      return;
    }

    if (cash.direct) {
      out.innerHTML = stat('Cash price', fmt(cash.price), true) +
        (cash.profit != null ? stat('Profit', fmt(cash.profit)) + stat('Margin', pct(cash.price > 0 ? cash.profit / cash.price * 100 : 0)) : '');
    } else {
      out.innerHTML = stat('Job cost', fmt(cash.cost)) + stat('Overhead', fmt(cash.overhead)) +
        stat('Profit', fmt(cash.profit)) + stat('Markup on cost', pct(cash.markupPct)) +
        stat('Cash price', fmt(cash.price), true);
    }

    var down = val('down');
    var hasProfit = cash.profit != null;

    $('result-rows').innerHTML = plans.map(function (p) {
      var fee = parseFloat(p.fee) || 0;
      var g = C.grossUp(cash.price, fee, down);
      if (g.error) return '<tr><td>' + esc(p.name) + '</td><td colspan="6" class="err">' + esc(g.error) + '</td></tr>';
      var pay = C.monthlyPayment(g.financed, parseFloat(p.apr) || 0, parseFloat(p.months) || 0);
      var absorbCell = '—';
      if (hasProfit) {
        var a = C.absorbFee(cash.price, cash.profit, fee * Math.max(0, cash.price - down) / (cash.price || 1));
        absorbCell = '<span class="' + (a.profit < 0 ? 'neg' : 'muted') + '">' + fmt(a.profit) + ' profit (' + pct(a.marginPct) + ')</span>';
      }
      return '<tr>' +
        '<td data-l="Plan">' + esc(p.name) + ' <small class="muted">' + pct(fee) + ' fee</small></td>' +
        '<td data-l="Charge customer" class="big">' + fmt(g.price) + '</td>' +
        '<td data-l="Increase">+' + fmt(g.increase) + ' <small class="muted">(' + pct(g.increasePct) + ')</small></td>' +
        '<td data-l="Lender keeps">' + fmt(g.fee) + '</td>' +
        '<td data-l="You net">' + fmt(g.net) + '</td>' +
        '<td data-l="Est. payment">' + (pay > 0 ? fmt2(pay) + '/mo' : '—') + '</td>' +
        '<td data-l="If you absorb it">' + absorbCell + '</td>' +
        '</tr>';
    }).join('');

    // "common mistake" callout using the highest-fee plan
    var top = plans.reduce(function (best, p) { return (parseFloat(p.fee) || 0) > (parseFloat(best.fee) || 0) ? p : best; }, plans[0] || { fee: 0 });
    var topFee = parseFloat(top && top.fee) || 0;
    if (topFee > 0 && cash.price > 0) {
      var n = C.naiveMarkup(cash.price, topFee);
      var right = C.grossUp(cash.price, topFee, 0);
      $('mistake').hidden = false;
      $('mistake').innerHTML = '<strong>Don\'t just add ' + pct(topFee) + ' on top.</strong> On "' + esc(top.name) +
        '", ' + fmt(cash.price) + ' × ' + (1 + topFee / 100).toFixed(2) + ' = ' + fmt(n.price) +
        ', but the lender takes ' + fmt(n.fee) + ' and you net only ' + fmt(n.net) +
        ': <strong>' + fmt(n.shortfall) + ' short</strong>. Charge ' + fmt(right.price) + ' instead.';
    } else {
      $('mistake').hidden = true;
    }

    // blended pricing
    var bp = plans[blendIndex];
    if (bp) {
      var b = C.blendedPrice(cash.price, parseFloat(bp.fee) || 0, val('share'));
      $('blend-out').innerHTML = b.error ? '<p class="err">' + esc(b.error) + '</p>' :
        stat('Price for every customer', fmt(b.price), true) +
        stat('Increase over cash price', '+' + fmt(b.increase) + ' (' + pct(b.increasePct) + ')') +
        stat('You net on a cash sale', fmt(b.netIfCash)) +
        stat('You net on a financed sale', fmt(b.netIfFinanced)) +
        stat('Average net per job', fmt(b.expectedNet));
    } else {
      $('blend-out').innerHTML = '<p class="muted">Add a financing plan to see a blended price.</p>';
    }

    save();
  }

  function stat(label, value, hero) {
    return '<div class="stat' + (hero ? ' hero' : '') + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function setMode() {
    var m = mode();
    $('costs-fields').hidden = m !== 'costs';
    $('direct-fields').hidden = m !== 'direct';
  }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.k) {
      var i = +t.closest('tr').dataset.i;
      plans[i][t.dataset.k] = t.value;
      renderBlendSelect();
    }
    if (t.id === 'blend-plan') blendIndex = +t.value;
    update();
  });

  document.addEventListener('change', function (e) {
    if (e.target.name === 'mode') { setMode(); update(); }
    if (e.target.id === 'blend-plan') { blendIndex = +e.target.value; update(); }
  });

  $('plan-rows').addEventListener('click', function (e) {
    var r = e.target.closest('[data-remove]');
    if (!r) return;
    plans.splice(+r.dataset.remove, 1);
    renderPlanRows(); renderBlendSelect(); update();
  });

  $('add-plan').addEventListener('click', function () {
    plans.push({ name: 'New plan', fee: 5, apr: 0, months: 12 });
    renderPlanRows(); renderBlendSelect(); update();
    var inputs = $('plan-rows').querySelectorAll('input[data-k=name]');
    inputs[inputs.length - 1].select();
  });

  $('reset-plans').addEventListener('click', function () {
    plans = DEFAULT_PLANS.map(function (p) { return Object.assign({}, p); });
    blendIndex = 0;
    renderPlanRows(); renderBlendSelect(); update();
  });

  $('print').addEventListener('click', function () { window.print(); });

  // ---------- init ----------
  load();
  setMode();
  renderPlanRows();
  renderBlendSelect();
  update();
})();
