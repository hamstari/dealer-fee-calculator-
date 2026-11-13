(function () {
  'use strict';
  var C = window.DealerCalc;
  var STORE_KEY = 'dealer-fee-calc-v3';
  var OLD_STORE_KEY = 'dealer-fee-calc-v2';

  var DEFAULT_LENDERS = [
    {
      name: 'Lender A',
      approval: 70,
      plans: [
        { name: '12 mo same-as-cash', fee: 6, apr: 0, months: 12, split: 60 },
        { name: '18 mo no interest', fee: 9, apr: 0, months: 18, split: 30 },
        { name: '0% APR, 60 mo', fee: 14, apr: 0, months: 60, split: 10 },
      ],
    },
    {
      name: 'Lender B',
      approval: 50,
      plans: [
        { name: '9.99% APR, 10 yr', fee: 3, apr: 9.99, months: 120, split: 100 },
        { name: '6.99% APR, 7 yr', fee: 7, apr: 6.99, months: 84, split: 0 },
      ],
    },
  ];

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmt = function (x) { return isFinite(x) ? money.format(x) : '—'; };
  var pct = function (x) { return isFinite(x) ? (Math.round(x * 10) / 10) + '%' : '—'; };
  var count = function (x) { return String(Math.round(x * 10) / 10); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
  var val = function (id) { return n($(id).value); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var FIELDS = ['price', 'materials', 'labor', 'subs', 'other', 'overheadPct', 'marginPct', 'down', 'applyPct', 'declinedCashPct'];
  var TABS = ['job', 'blend', 'lenders'];
  var state = { lenders: clone(DEFAULT_LENDERS), costsOpen: false, tab: 'job' };

  function lenderName(li) { return state.lenders[li].name || 'Lender ' + (li + 1); }
  function planName(p, pi) { return p.name || 'Plan ' + (pi + 1); }
  function roleLabel(li) { return li === 0 ? 'Primary' : state.lenders.length > 2 ? 'Backup ' + li : 'Backup'; }

  // ---------- persistence (per-browser convenience only) ----------
  function save() {
    try {
      var data = { lenders: state.lenders, costsOpen: state.costsOpen, tab: state.tab, fields: {} };
      FIELDS.forEach(function (f) { data.fields[f] = $(f).value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!data) {
        var old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || 'null');
        if (old) {
          data = { lenders: old.lenders, costsOpen: old.mode === 'costs', fields: old.fields || {} };
          if (data.fields.directPrice != null) data.fields.price = data.fields.directPrice;
        }
      }
      if (!data) return;
      if (Array.isArray(data.lenders) && data.lenders.length) {
        state.lenders = data.lenders;
        state.lenders.forEach(function (l, li) {
          if (l.approval == null) l.approval = li === 0 ? 70 : 50;
          l.plans = l.plans || [];
          l.plans.forEach(function (p, pi) { if (p.split == null) p.split = pi === 0 ? 100 : 0; });
        });
      }
      if (data.fields) FIELDS.forEach(function (f) { if (data.fields[f] != null) $(f).value = data.fields[f]; });
      state.costsOpen = !!data.costsOpen;
      if (TABS.indexOf(data.tab) >= 0) state.tab = data.tab;
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- tabs ----------
  function showTab(tab) {
    state.tab = tab;
    TABS.forEach(function (t) {
      $('tab-' + t).setAttribute('aria-selected', String(t === tab));
      $('tab-' + t).tabIndex = t === tab ? 0 : -1;
      $('panel-' + t).hidden = t !== tab;
    });
    save();
  }

  // ---------- cash price ----------
  function getCash() {
    if (!state.costsOpen) return { price: val('price'), profit: null };
    return C.cashPriceFromCosts({
      materials: val('materials'), labor: val('labor'), subs: val('subs'), other: val('other'),
      overheadPct: val('overheadPct'), marginPct: val('marginPct'),
    });
  }

  function renderCosts(cash) {
    $('costs').hidden = !state.costsOpen;
    $('toggle-costs').setAttribute('aria-expanded', String(state.costsOpen));
    $('toggle-costs').textContent = state.costsOpen ? 'Type a price instead' : 'Work it out from my costs';
    $('price').readOnly = state.costsOpen;
    $('price').classList.toggle('computed', state.costsOpen);
    if (!state.costsOpen) return;
    if (cash.error) {
      $('cost-line').innerHTML = '<span class="neg">' + esc(cash.error) + '</span>';
      $('price').value = '';
      return;
    }
    $('price').value = Math.round(cash.price);
    $('cost-line').textContent = 'Costs ' + fmt(cash.cost) + ' + overhead ' + fmt(cash.overhead) +
      ' + profit ' + fmt(cash.profit) + ' = ' + fmt(cash.price) + ' (' + pct(cash.markupPct) + ' markup on cost)';
  }

  // ---------- tab 1: plan cards ----------
  function renderPlanCards(cash) {
    if (cash.error || !(cash.price > 0)) {
      $('plan-cards').innerHTML = '<p class="muted empty">Enter your cash price above.</p>';
      $('mistake').textContent = '';
      return;
    }
    var down = val('down');
    var minFee = Infinity, maxFee = 0, maxPlan = null;
    state.lenders.forEach(function (l) {
      l.plans.forEach(function (p) {
        var f = n(p.fee);
        if (f < minFee) minFee = f;
        if (f > maxFee) { maxFee = f; maxPlan = p; }
      });
    });
    var multipleFees = minFee !== maxFee;

    var html = state.lenders.map(function (l, li) {
      if (!l.plans.length) return '';
      var cards = l.plans.map(function (p, pi) {
        var fee = n(p.fee);
        var g = C.grossUp(cash.price, fee, down);
        if (g.error) return '<div class="plan-card"><div class="pc-name">' + esc(planName(p, pi)) + '</div><p class="neg">' + esc(g.error) + '</p></div>';
        var pay = C.monthlyPayment(g.financed, n(p.apr), n(p.months));
        var absorb = '';
        if (cash.profit != null) {
          var a = C.absorbFee(cash.price, cash.profit, fee * Math.max(0, cash.price - down) / cash.price);
          absorb = '<div class="pc-absorb">If you eat the fee instead: <span class="' + (a.profit < 0 ? 'neg' : '') + '">' + fmt(a.profit) + ' profit (' + pct(a.marginPct) + ')</span></div>';
        }
        return '<div class="plan-card">' +
          '<div class="pc-top"><span class="pc-name">' + esc(planName(p, pi)) + '</span>' +
            (multipleFees && fee === minFee ? '<span class="tag">Lowest price</span>' : '') + '</div>' +
          '<div class="pc-price">' + fmt(g.price) + '</div>' +
          '<div class="pc-sub">+' + fmt(g.increase) + ' covers the ' + pct(fee) + ' dealer fee</div>' +
          (pay > 0 ? '<div class="pc-sub">About ' + fmt(pay) + '/mo for ' + Math.round(n(p.months)) + ' months</div>' : '') +
          absorb +
          '</div>';
      }).join('');
      return '<div class="lender-group"><h3 class="group-title">' + esc(lenderName(li)) + '</h3><div class="cards">' + cards + '</div></div>';
    }).join('');
    $('plan-cards').innerHTML = html || '<p class="muted empty">No plans yet. Add your lenders in <button type="button" class="link inline-link" data-goto="lenders">My lenders</button>.</p>';

    if (maxFee > 0) {
      var nv = C.naiveMarkup(cash.price, maxFee);
      var right = C.grossUp(cash.price, maxFee, 0);
      $('mistake').innerHTML = 'Because the lender takes its fee from the <em>bigger</em> number. On "' + esc(maxPlan.name) + '" (' + pct(maxFee) + '): ' +
        fmt(cash.price) + ' + ' + pct(maxFee) + ' = ' + fmt(nv.price) + ', but the lender keeps ' + fmt(nv.fee) +
        ', so you get only ' + fmt(nv.net) + '. That\'s <strong>' + fmt(nv.shortfall) + ' short</strong>. The right price is ' + fmt(right.price) + '.';
    }
  }

  // ---------- tab 2: one price for all ----------
  var SEG_COLORS = ['var(--l1)', 'var(--l2)', 'var(--l3)', 'var(--l4)'];

  function renderBlend(cash) {
    var wf = C.waterfall({
      applyPct: val('applyPct'),
      declinedCashPct: val('declinedCashPct'),
      lenders: state.lenders.map(function (l) {
        return { approvalPct: l.approval, plans: l.plans.map(function (p) { return { fee: p.fee, splitPct: p.split }; }) };
      }),
    });

    // funnel bar + legend
    var segs = [{ label: 'Pay cash', v: 100 - Math.min(100, Math.max(0, val('applyPct'))), color: 'var(--cash)' }];
    wf.lenders.forEach(function (l, li) {
      segs.push({ label: 'Financed by ' + esc(lenderName(li)), v: l.approved, color: SEG_COLORS[li % SEG_COLORS.length] });
    });
    segs.push({ label: 'Declined, pay cash anyway', v: wf.declinedCash, color: 'var(--cash2)' });
    segs.push({ label: 'Declined, job lost', v: wf.lost, color: 'var(--lost)' });
    $('funnel-bar').innerHTML = segs.map(function (s) {
      return s.v > 0 ? '<span style="flex:' + s.v + ';background:' + s.color + '"></span>' : '';
    }).join('');
    $('funnel-legend').innerHTML = segs.map(function (s) {
      return '<li><i style="background:' + s.color + '"></i>' + s.label + '<b>' + count(s.v) + '</b></li>';
    }).join('');
    var backup = wf.lenders.slice(1).reduce(function (t, l) { return t + l.approved; }, 0);

    if (cash.error || !(cash.price > 0)) {
      $('blend-hero').innerHTML = '<p class="muted">Enter your cash price on the <button type="button" class="link inline-link" data-goto="job">Price a job</button> tab.</p>';
      $('breakdown-rows').innerHTML = '';
      return;
    }

    var b = C.blendedPriceMix(cash.price, wf.mix);
    if (b.error) {
      $('blend-hero').innerHTML = '<p class="neg">' + esc(b.error) + '</p>';
      return;
    }

    // lowest single-job net among plans that actually get customers
    var lowest = null, i = 0, rows = [];
    state.lenders.forEach(function (l, li) {
      l.plans.forEach(function (p, pi) {
        var share = wf.mix[i].share, net = b.perPlan[i].net;
        if (share > 0 && (!lowest || net < lowest.net)) lowest = { net: net, label: lenderName(li) + ', ' + planName(p, pi) };
        rows.push('<tr><td>' + esc(planName(p, pi)) + ' <small class="muted">' + esc(lenderName(li)) + '</small></td><td>' + pct(n(p.fee)) +
          '</td><td>' + pct(share) + '</td><td>' + fmt(net) + '</td></tr>');
        i++;
      });
    });
    rows.push('<tr class="muted"><td>Pay cash</td><td>0%</td><td>' + pct(wf.closed > 0 ? wf.cashBuyers / wf.closed * 100 : 0) + '</td><td>' + fmt(b.netIfCash) + '</td></tr>');
    $('breakdown-rows').innerHTML = rows.join('');

    $('blend-hero').innerHTML =
      '<div class="hero-label">Charge every customer</div>' +
      '<div class="hero-price">' + fmt(b.price) + '</div>' +
      '<div class="hero-sub">+' + fmt(b.increase) + ' (' + pct(b.increasePct) + ') over your ' + fmt(cash.price) + ' cash price</div>' +
      '<p class="hero-note">On average you get your full cash price per job.' +
        (lowest ? ' On a single job it can be as low as ' + fmt(lowest.net) + ' (' + esc(lowest.label) + ').' : '') +
        (backup > 0 ? ' Your backup lender saves about ' + count(backup) + ' jobs per 100 customers.' : '') +
      '</p>';
  }

  // ---------- tab 3: lenders ----------
  function renderLenders() {
    var L = state.lenders;
    $('lenders').innerHTML = L.map(function (l, li) {
      var rows = l.plans.map(function (p, pi) {
        return '<div class="plan-row" data-li="' + li + '" data-pi="' + pi + '">' +
          '<label class="f-name"><span>Plan</span><input data-k="name" type="text" value="' + esc(p.name) + '"></label>' +
          '<label><span>Dealer fee</span><span class="pct"><input data-k="fee" type="number" inputmode="decimal" min="0" max="99" step="any" value="' + esc(p.fee) + '"></span></label>' +
          '<label><span>APR</span><span class="pct"><input data-k="apr" type="number" inputmode="decimal" min="0" step="any" value="' + esc(p.apr) + '"></span></label>' +
          '<label><span>Months</span><input data-k="months" type="number" inputmode="numeric" min="0" step="1" value="' + esc(p.months) + '"></label>' +
          '<label><span>Mix</span><span class="pct"><input data-k="split" type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(p.split) + '"></span></label>' +
          '<button type="button" class="icon" data-remove-plan aria-label="Remove ' + esc(planName(p, pi)) + '">×</button>' +
          '</div>';
      }).join('');
      var splitSum = l.plans.reduce(function (t, p) { return t + Math.max(0, n(p.split)); }, 0);
      return '<div class="card lender" data-li="' + li + '">' +
        '<div class="lender-head">' +
          '<span class="role">' + roleLabel(li) + '</span>' +
          '<input class="lender-name" data-lender-name aria-label="Lender name" type="text" value="' + esc(l.name) + '" placeholder="Lender name">' +
          '<span class="lender-tools">' +
            (li > 0 ? '<button type="button" class="link" data-move-up>' + (li === 1 ? 'Make primary' : 'Move up') + '</button>' : '') +
            (L.length > 1 ? '<button type="button" class="link danger" data-remove-lender>Remove</button>' : '') +
          '</span>' +
        '</div>' +
        '<label class="approval">Approves <span class="pct"><input data-approval type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(l.approval) + '"></span> of the customers who apply' + (li === 0 ? '' : ' after being declined') + '</label>' +
        '<div class="plan-rows">' + (rows || '<p class="muted">No plans yet.</p>') + '</div>' +
        (l.plans.length > 1 ? '<p class="muted small-text" data-mix-note>' + mixNote(splitSum) + '</p>' : '') +
        '<button type="button" class="link" data-add-plan>+ Add plan</button>' +
        '</div>';
    }).join('');
  }

  function mixNote(sum) {
    var base = '<strong>Mix:</strong> of the customers this lender approves, about what % pick each plan.';
    return Math.abs(sum - 100) > 0.01 ? base + ' <span class="neg">Adds up to ' + pct(sum) + ', so we scale it to 100%.</span>' : base;
  }

  // ---------- main update ----------
  function update() {
    var cash = getCash();
    renderCosts(cash);
    renderPlanCards(cash);
    renderBlend(cash);
    save();
  }

  // ---------- events ----------
  document.addEventListener('input', function (e) {
    var t = e.target;
    var row = t.closest('.plan-row');
    var box = t.closest('.lender');
    if (row && t.dataset.k) {
      var l = state.lenders[+row.dataset.li];
      l.plans[+row.dataset.pi][t.dataset.k] = t.value;
      if (t.dataset.k === 'split') {
        var note = box.querySelector('[data-mix-note]');
        if (note) note.innerHTML = mixNote(l.plans.reduce(function (s, p) { return s + Math.max(0, n(p.split)); }, 0));
      }
    } else if (box && t.hasAttribute('data-lender-name')) {
      state.lenders[+box.dataset.li].name = t.value;
    } else if (box && t.hasAttribute('data-approval')) {
      state.lenders[+box.dataset.li].approval = t.value;
    }
    update();
  });

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-goto]');
    if (go) { showTab(go.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  $('lenders').addEventListener('click', function (e) {
    var box = e.target.closest('.lender');
    if (!box) return;
    var li = +box.dataset.li;
    var l = state.lenders[li];
    if (e.target.closest('[data-remove-plan]')) {
      l.plans.splice(+e.target.closest('.plan-row').dataset.pi, 1);
    } else if (e.target.closest('[data-add-plan]')) {
      l.plans.push({ name: 'New plan', fee: 5, apr: 0, months: 12, split: l.plans.length ? 0 : 100 });
    } else if (e.target.closest('[data-move-up]')) {
      state.lenders.splice(li - 1, 0, state.lenders.splice(li, 1)[0]);
    } else if (e.target.closest('[data-remove-lender]')) {
      if (!confirm('Remove ' + lenderName(li) + ' and its plans?')) return;
      state.lenders.splice(li, 1);
    } else {
      return;
    }
    renderLenders();
    update();
  });

  $('add-lender').addEventListener('click', function () {
    state.lenders.push({ name: 'Lender ' + String.fromCharCode(65 + state.lenders.length), approval: 50,
      plans: [{ name: 'New plan', fee: 5, apr: 0, months: 12, split: 100 }] });
    renderLenders(); update();
    var names = $('lenders').querySelectorAll('[data-lender-name]');
    names[names.length - 1].select();
  });

  $('reset-plans').addEventListener('click', function () {
    if (!confirm('Replace your lenders and plans with the examples?')) return;
    state.lenders = clone(DEFAULT_LENDERS);
    renderLenders(); update();
  });

  $('toggle-costs').addEventListener('click', function () {
    state.costsOpen = !state.costsOpen;
    update();
    if (state.costsOpen) $('materials').focus();
    else $('price').focus();
  });

  // tabs: click + arrow keys
  TABS.forEach(function (t, i) {
    var el = $('tab-' + t);
    el.addEventListener('click', function () { showTab(t); });
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var next = TABS[(i + d + TABS.length) % TABS.length];
      showTab(next);
      $('tab-' + next).focus();
    });
  });

  $('print').addEventListener('click', function () { window.print(); });

  // ---------- init ----------
  load();
  renderLenders();
  showTab(state.tab);
  update();
})();
