(function () {
  'use strict';
  var C = window.DealerCalc;
  var STORE_KEY = 'dealer-fee-calc-v2';
  var OLD_STORE_KEY = 'dealer-fee-calc-v1';

  var DEFAULT_LENDERS = [
    {
      name: 'Lender A',
      approval: 70,
      plans: [
        { name: '12 mo same-as-cash', fee: 6, apr: 0, months: 12, share: 20, split: 60 },
        { name: '18 mo no interest', fee: 9, apr: 0, months: 18, share: 0, split: 30 },
        { name: '0% APR, 60 mo', fee: 14, apr: 0, months: 60, share: 0, split: 10 },
      ],
    },
    {
      name: 'Lender B',
      approval: 50,
      plans: [
        { name: '9.99% APR, 10 yr', fee: 3, apr: 9.99, months: 120, share: 15, split: 100 },
        { name: '6.99% APR, 7 yr', fee: 7, apr: 6.99, months: 84, share: 0, split: 0 },
      ],
    },
  ];

  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt = function (n) { return isFinite(n) ? money.format(n) : '—'; };
  var fmt2 = function (n) { return isFinite(n) ? money2.format(n) : '—'; };
  var pct = function (n) { return isFinite(n) ? (Math.round(n * 10) / 10) + '%' : '—'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
  var val = function (id) { return n($(id).value); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var FIELDS = ['materials', 'labor', 'subs', 'other', 'overheadPct', 'marginPct', 'directPrice', 'directProfit', 'down', 'applyPct', 'declinedCashPct'];
  var lenders = clone(DEFAULT_LENDERS);

  function lenderLabel(l, li) { return l.name || 'Lender ' + (li + 1); }
  function roleLabel(li) { return li === 0 ? 'Primary' : lenders.length > 2 ? 'Backup ' + li : 'Backup'; }
  function planLabel(p, pi) { return p.name || 'Plan ' + (pi + 1); }

  /** Flat list of every plan with its lender, in display order. */
  function allPlans() {
    var out = [];
    lenders.forEach(function (l, li) {
      l.plans.forEach(function (p, pi) { out.push({ lender: l, li: li, plan: p, pi: pi }); });
    });
    return out;
  }

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { mode: mode(), mixMode: mixMode(), lenders: lenders, fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!data) {
        // migrate the single-lender format
        var old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || 'null');
        if (old) {
          data = { mode: old.mode, fields: old.fields || {} };
          if (Array.isArray(old.plans) && old.plans.length) {
            data.lenders = [{ name: 'My lender', plans: old.plans.map(function (p) { return Object.assign({ share: 0 }, p); }) }];
          }
        }
      }
      if (!data) return;
      if (Array.isArray(data.lenders) && data.lenders.length) {
        lenders = data.lenders;
        // fill in fields added by the approval waterfall
        lenders.forEach(function (l, li) {
          if (l.approval == null) l.approval = li === 0 ? 70 : 50;
          (l.plans || []).forEach(function (p, pi) { if (p.split == null) p.split = pi === 0 ? 100 : 0; });
        });
      }
      if (data.mixMode) {
        var mm = document.querySelector('input[name=mixMode][value="' + data.mixMode + '"]');
        if (mm) mm.checked = true;
      }
      if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
      if (data.mode) {
        var r = document.querySelector('input[name=mode][value="' + data.mode + '"]');
        if (r) r.checked = true;
      }
    } catch (e) { /* ignore bad data */ }
  }

  function mode() { return document.querySelector('input[name=mode]:checked').value; }
  function mixMode() { return document.querySelector('input[name=mixMode]:checked').value; }

  // ---------- lender / plan editor ----------
  function renderLenders() {
    $('lenders').innerHTML = lenders.map(function (l, li) {
      var rows = l.plans.map(function (p, pi) {
        return '<tr data-li="' + li + '" data-pi="' + pi + '">' +
          '<td><input aria-label="Plan name" data-k="name" type="text" value="' + esc(p.name) + '"></td>' +
          '<td><span class="pct"><input aria-label="Dealer fee percent" data-k="fee" type="number" inputmode="decimal" min="0" max="99" step="any" value="' + esc(p.fee) + '"></span></td>' +
          '<td><span class="pct"><input aria-label="Customer APR" data-k="apr" type="number" inputmode="decimal" min="0" step="any" value="' + esc(p.apr) + '"></span></td>' +
          '<td><input aria-label="Term in months" data-k="months" type="number" inputmode="numeric" min="0" step="1" value="' + esc(p.months) + '"></td>' +
          '<td><button type="button" class="icon" data-remove-plan aria-label="Remove ' + esc(planLabel(p, pi)) + '">×</button></td>' +
          '</tr>';
      }).join('');
      return '<div class="lender" data-li="' + li + '">' +
        '<div class="lender-head">' +
          '<span class="role">' + roleLabel(li) + '</span>' +
          '<input class="lender-name" data-lender-name aria-label="Lender name" type="text" value="' + esc(l.name) + '" placeholder="Lender name">' +
          (li > 0 ? '<button type="button" class="btn ghost small" data-move-up title="Applicants are sent to lenders in this order">' + (li === 1 ? 'Make primary' : 'Move up') + '</button>' : '') +
          (lenders.length > 1 ? '<button type="button" class="btn ghost small" data-remove-lender>Remove lender</button>' : '') +
        '</div>' +
        '<div class="table-scroll"><table class="plans">' +
          '<thead><tr><th>Plan name</th><th>Dealer fee</th><th>Customer APR</th><th>Term (mo)</th><th><span class="sr">Remove</span></th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="5" class="muted">No plans yet.</td></tr>') + '</tbody>' +
        '</table></div>' +
        '<button type="button" class="btn small" data-add-plan>+ Add plan</button>' +
        '</div>';
    }).join('');
  }

  // ---------- financing mix (step 4) ----------
  function renderMix(blend) {
    var html = [];
    lenders.forEach(function (l, li) {
      if (!l.plans.length) return;
      html.push('<tr class="group"><th colspan="4">' + esc(lenderLabel(l, li)) + '</th></tr>');
      l.plans.forEach(function (p, pi) {
        html.push('<tr data-li="' + li + '" data-pi="' + pi + '">' +
          '<td data-l="Plan">' + esc(planLabel(p, pi)) + '</td>' +
          '<td data-l="Dealer fee">' + pct(n(p.fee)) + '</td>' +
          '<td data-l="% of customers"><span class="pct"><input aria-label="Percent of customers on ' + esc(planLabel(p, pi)) + '" data-share type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(p.share || 0) + '"></span></td>' +
          '<td data-l="You net on this plan" data-net>—</td>' +
          '</tr>');
      });
    });
    html.push('<tr class="cash-row"><td data-l="Plan">Pay cash</td><td data-l="Dealer fee">0%</td><td data-l="% of customers" data-cash-share>—</td><td data-l="You net on this plan" data-cash-net>—</td></tr>');
    $('mix-rows').innerHTML = html.join('');
  }

  function fillMix(blend) {
    var netCells = $('mix-rows').querySelectorAll('[data-net]');
    allPlans().forEach(function (x, i) {
      if (netCells[i]) netCells[i].textContent = blend && !blend.error ? fmt(blend.perPlan[i].net) : '—';
    });
    var cashShare = blend && !blend.error ? Math.max(0, 100 - blend.financedShare) : NaN;
    $('mix-rows').querySelector('[data-cash-share]').textContent = pct(cashShare);
    $('mix-rows').querySelector('[data-cash-net]').textContent = blend && !blend.error ? fmt(blend.netIfCash) : '—';
  }

  // ---------- approval waterfall (step 4) ----------
  function runWaterfall() {
    return C.waterfall({
      applyPct: val('applyPct'),
      declinedCashPct: val('declinedCashPct'),
      lenders: lenders.map(function (l) {
        return { approvalPct: l.approval, plans: l.plans.map(function (p) { return { fee: p.fee, splitPct: p.split }; }) };
      }),
    });
  }

  function renderWaterfall() {
    var html = [];
    lenders.forEach(function (l, li) {
      html.push('<tr class="group wf-lender" data-li="' + li + '"><th colspan="5">' +
        '<span class="wf-head"><span>' + roleLabel(li) + ': ' + esc(lenderLabel(l, li)) + '</span>' +
        '<label class="approval">approves <span class="pct"><input aria-label="' + esc(lenderLabel(l, li)) + ' approval rate" data-approval type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(l.approval) + '"></span> of applicants it sees</label>' +
        '<span class="wf-note" data-wf-note></span></span></th></tr>');
      l.plans.forEach(function (p, pi) {
        html.push('<tr data-li="' + li + '" data-pi="' + pi + '">' +
          '<td data-l="Plan">' + esc(planLabel(p, pi)) + '</td>' +
          '<td data-l="Dealer fee">' + pct(n(p.fee)) + '</td>' +
          '<td data-l="Split of approvals"><span class="pct"><input aria-label="Share of ' + esc(lenderLabel(l, li)) + ' approvals on ' + esc(planLabel(p, pi)) + '" data-split type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(p.split) + '"></span></td>' +
          '<td data-l="Share of closed jobs" data-wf-share>—</td>' +
          '<td data-l="You net on this plan" data-net>—</td>' +
          '</tr>');
      });
    });
    html.push('<tr class="cash-row"><td data-l="Plan">Pay cash</td><td data-l="Dealer fee">0%</td><td data-l="Split of approvals"></td><td data-l="Share of closed jobs" data-cash-share>—</td><td data-l="You net on this plan" data-cash-net>—</td></tr>');
    $('wf-rows').innerHTML = html.join('');
  }

  function fillWaterfall(wf, blend) {
    var body = $('wf-rows');
    var notes = body.querySelectorAll('[data-wf-note]');
    var shareCells = body.querySelectorAll('[data-wf-share]');
    var netCells = body.querySelectorAll('[data-net]');
    var i = 0;
    wf.lenders.forEach(function (l, li) {
      var warn = l.plans.length > 1 && Math.abs(l.splitSum - 100) > 0.01 ? ' <span class="neg">Splits add to ' + pct(l.splitSum) + '; scaled to 100%.</span>' : '';
      if (notes[li]) notes[li].innerHTML = 'Sees ' + pct(l.reached) + ' of customers, funds ' + pct(l.approved) + '.' + warn;
      l.plans.forEach(function () {
        if (shareCells[i]) shareCells[i].textContent = pct(wf.mix[i].share);
        if (netCells[i]) netCells[i].textContent = blend && !blend.error ? fmt(blend.perPlan[i].net) : '—';
        i++;
      });
    });
    body.querySelector('[data-cash-share]').textContent = wf.closed > 0 ? pct(wf.cashBuyers / wf.closed * 100) : '—';
    body.querySelector('[data-cash-net]').textContent = blend && !blend.error ? fmt(blend.netIfCash) : '—';

    var parts = [fmtCount(100 - val('applyPct')) + ' pay cash'];
    wf.lenders.forEach(function (l, li) { parts.push(fmtCount(l.approved) + ' financed by ' + esc(lenderLabel(lenders[li], li))); });
    parts.push(fmtCount(wf.declinedCash) + ' declined but buy with cash');
    parts.push('<span class="' + (wf.lost > 0 ? 'neg' : '') + '">' + fmtCount(wf.lost) + ' declined and lost</span>');
    var backupFunded = wf.lenders.slice(1).reduce(function (t, l) { return t + l.approved; }, 0);
    $('funnel').innerHTML = '<strong>Out of 100 customers:</strong> ' + parts.join(' · ') +
      (backupFunded > 0 ? '<br><span class="muted">Your backup lender' + (wf.lenders.length > 2 ? 's save ' : ' saves ') + fmtCount(backupFunded) + ' jobs per 100 customers that would otherwise be declined.</span>' : '');
  }

  function fmtCount(x) { return (Math.round(x * 10) / 10).toString(); }

  // ---------- main calculation ----------
  function getCash() {
    if (mode() === 'costs') {
      return C.cashPriceFromCosts({
        materials: val('materials'), labor: val('labor'), subs: val('subs'), other: val('other'),
        overheadPct: val('overheadPct'), marginPct: val('marginPct'),
      });
    }
    var profitRaw = $('directProfit').value.trim();
    return { price: val('directPrice'), profit: profitRaw === '' ? null : n(profitRaw), direct: true };
  }

  function stat(label, value, hero) {
    return '<div class="stat' + (hero ? ' hero' : '') + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function resultRow(p, cash, down) {
    var fee = n(p.fee);
    var g = C.grossUp(cash.price, fee, down);
    if (g.error) return '<tr><td>' + esc(p.name) + '</td><td colspan="6" class="err">' + esc(g.error) + '</td></tr>';
    var pay = C.monthlyPayment(g.financed, n(p.apr), n(p.months));
    var absorbCell = '—';
    if (cash.profit != null) {
      // absorbing: the fee applies to whatever the customer finances at the cash price
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
  }

  function update() {
    var cash = getCash();
    var out = $('cash-summary');
    var useWf = mixMode() === 'waterfall';
    if (!$('mix-rows').contains(document.activeElement)) renderMix();
    if (!$('wf-rows').contains(document.activeElement)) renderWaterfall();
    var wf = runWaterfall();

    if (cash.error) {
      out.innerHTML = '<p class="err">' + esc(cash.error) + '</p>';
      $('result-rows').innerHTML = '';
      $('mistake').hidden = true;
      $('blend-out').innerHTML = '';
      fillMix(null);
      fillWaterfall(wf, null);
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

    // step 3: grouped by lender
    var down = val('down');
    $('result-rows').innerHTML = lenders.map(function (l, li) {
      if (!l.plans.length) return '';
      return '<tr class="group"><th colspan="7">' + esc(lenderLabel(l, li)) + '</th></tr>' +
        l.plans.map(function (p) { return resultRow(p, cash, down); }).join('');
    }).join('');

    // "common mistake" callout using the highest-fee plan across all lenders
    var plans = allPlans();
    var top = plans.reduce(function (best, x) { return !best || n(x.plan.fee) > n(best.plan.fee) ? x : best; }, null);
    var topFee = top ? n(top.plan.fee) : 0;
    if (topFee > 0 && cash.price > 0) {
      var nv = C.naiveMarkup(cash.price, topFee);
      var right = C.grossUp(cash.price, topFee, 0);
      $('mistake').hidden = false;
      $('mistake').innerHTML = '<strong>Don\'t just add ' + pct(topFee) + ' on top.</strong> On ' + esc(lenderLabel(top.lender, top.li)) + '\'s "' + esc(top.plan.name) +
        '", ' + fmt(cash.price) + ' × ' + (1 + topFee / 100).toFixed(2) + ' = ' + fmt(nv.price) +
        ', but the lender takes ' + fmt(nv.fee) + ' and you net only ' + fmt(nv.net) +
        ': <strong>' + fmt(nv.shortfall) + ' short</strong>. Charge ' + fmt(right.price) + ' instead.';
    } else {
      $('mistake').hidden = true;
    }

    // step 4: blended price across the whole mix
    var mix = useWf ? wf.mix : plans.map(function (x) { return { fee: x.plan.fee, share: x.plan.share }; });
    var blend = C.blendedPriceMix(cash.price, mix);
    if (useWf) fillWaterfall(wf, blend); else fillMix(blend);
    if (blend.error) {
      $('blend-out').innerHTML = '<p class="err">' + esc(blend.error) + '</p>';
    } else {
      // lowest net among plans customers actually use
      var lowestNet = blend.perPlan.reduce(function (m, x, i) {
        return n(mix[i].share) > 0 ? Math.min(m, x.net) : m;
      }, blend.netIfCash);
      $('blend-out').innerHTML =
        stat('Price for every customer', fmt(blend.price), true) +
        stat('Increase over cash price', '+' + fmt(blend.increase) + ' (' + pct(blend.increasePct) + ')') +
        stat(useWf ? 'Closed jobs financed' : 'Customers who finance', pct(blend.financedShare) + (blend.financedShare > 0 ? ' <small>avg fee ' + pct(blend.avgFeePct) + '</small>' : '')) +
        stat('Lowest net on one job', fmt(lowestNet)) +
        stat('Average net per job', fmt(blend.expectedNet));
    }

    save();
  }

  function setMode() {
    var m = mode();
    $('costs-fields').hidden = m !== 'costs';
    $('direct-fields').hidden = m !== 'direct';
    var wfMode = mixMode() === 'waterfall';
    $('waterfall-panel').hidden = !wfMode;
    $('manual-panel').hidden = wfMode;
  }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    var row = t.closest('tr[data-li]');
    var box = t.closest('.lender');
    if (t.dataset.k && row) lenders[+row.dataset.li].plans[+row.dataset.pi][t.dataset.k] = t.value;
    else if (t.hasAttribute('data-share') && row) lenders[+row.dataset.li].plans[+row.dataset.pi].share = t.value;
    else if (t.hasAttribute('data-split') && row) lenders[+row.dataset.li].plans[+row.dataset.pi].split = t.value;
    else if (t.hasAttribute('data-approval')) lenders[+t.closest('tr').dataset.li].approval = t.value;
    else if (t.hasAttribute('data-lender-name') && box) lenders[+box.dataset.li].name = t.value;
    update();
  });

  document.addEventListener('change', function (e) {
    if (e.target.name === 'mode' || e.target.name === 'mixMode') { setMode(); update(); }
  });

  $('lenders').addEventListener('click', function (e) {
    var box = e.target.closest('.lender');
    if (!box) return;
    var l = lenders[+box.dataset.li];
    if (e.target.closest('[data-remove-plan]')) {
      l.plans.splice(+e.target.closest('tr').dataset.pi, 1);
    } else if (e.target.closest('[data-add-plan]')) {
      l.plans.push({ name: 'New plan', fee: 5, apr: 0, months: 12, share: 0, split: l.plans.length ? 0 : 100 });
    } else if (e.target.closest('[data-move-up]')) {
      var li = +box.dataset.li;
      lenders.splice(li - 1, 0, lenders.splice(li, 1)[0]);
    } else if (e.target.closest('[data-remove-lender]')) {
      if (!confirm('Remove ' + lenderLabel(l, +box.dataset.li) + ' and its plans?')) return;
      lenders.splice(+box.dataset.li, 1);
    } else {
      return;
    }
    renderLenders(); update();
  });

  $('add-lender').addEventListener('click', function () {
    lenders.push({ name: 'Lender ' + String.fromCharCode(65 + lenders.length), approval: 50, plans: [{ name: 'New plan', fee: 5, apr: 0, months: 12, share: 0, split: 100 }] });
    renderLenders(); update();
    var names = $('lenders').querySelectorAll('[data-lender-name]');
    names[names.length - 1].select();
  });

  $('reset-plans').addEventListener('click', function () {
    if (!confirm('Replace your lenders and plans with the examples?')) return;
    lenders = clone(DEFAULT_LENDERS);
    renderLenders(); update();
  });

  $('print').addEventListener('click', function () { window.print(); });

  // ---------- init ----------
  load();
  setMode();
  renderLenders();
  update();
})();
