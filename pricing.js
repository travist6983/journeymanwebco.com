// Journeyman Web Co pricing: the one place prices and plan terms live.
//
// index.html holds the words and marks each number with data-p="path"
// (a leading $ formats it as money, e.g. data-p="$tiers.growth.upfront").
// This file fills them in, so changing a price here changes it everywhere.
// Derived numbers (build portion, two-year totals, founding prices) are
// computed below and never typed into the page.
(function () {
  var PRICING = {
    termMonths: 24,
    extraWorkRate: 75,
    editMinutesIncluded: 30,
    careMinimumMonths: 12, // Hosting & Care is required this long on upfront builds
    cancelNoticeDays: 30,
    tiers: {
      essentials: { upfront: 2000, monthly: 149, care: 49, careAnnual: 490 },
      growth:     { upfront: 4000, monthly: 249, care: 49, careAnnual: 490 },
      industrial: { upfront: 6500, monthly: 399, care: 79, careAnnual: 790 }
    },
    foundingOffer: {
      enabled: true,
      endsOn: '2026-10-31', // last day, inclusive, in America/Detroit time
      spots: 5,
      buildDiscountPct: 20,
      monthlyFreeMonths: 3
    }
  };

  // Everything the page can reference: the config plus derived values.
  var P = PRICING, F = P.foundingOffer, V = { tiers: {} };
  Object.keys(P).forEach(function (k) { if (k !== 'tiers') V[k] = P[k]; });
  Object.keys(P.tiers).forEach(function (k) {
    var t = P.tiers[k];
    V.tiers[k] = {
      upfront: t.upfront, monthly: t.monthly, care: t.care, careAnnual: t.careAnnual,
      buildPortion: t.monthly - t.care,
      totalUpfront: t.upfront + t.care * P.termMonths,
      totalMonthly: t.monthly * P.termMonths,
      foundingBuild: Math.round(t.upfront * (100 - F.buildDiscountPct) / 100),
      annualMonthsFree: 12 - t.careAnnual / t.care
    };
  });
  var ends = F.endsOn.split('-');
  V.foundingOffer = {
    spots: F.spots, buildDiscountPct: F.buildDiscountPct, monthlyFreeMonths: F.monthlyFreeMonths,
    endsOnLabel: new Date(Date.UTC(+ends[0], ends[1] - 1, +ends[2]))
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  };
  V.termYears = P.termMonths / 12;
  V.minCare = Math.min.apply(null, Object.keys(P.tiers).map(function (k) { return P.tiers[k].care; }));
  // Pay-off example in the plan terms: Essentials halfway through the term.
  V.payoffExample = { month: P.termMonths / 2, monthsLeft: P.termMonths - P.termMonths / 2 };
  V.payoffExample.amount = V.payoffExample.monthsLeft * V.tiers.essentials.buildPortion;

  function lookup(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, V);
  }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  document.querySelectorAll('[data-p]').forEach(function (el) {
    var key = el.getAttribute('data-p'), isMoney = key.charAt(0) === '$';
    var v = lookup(isMoney ? key.slice(1) : key);
    if (typeof v !== 'number' && typeof v !== 'string') { console.error('pricing: no value for', key); return; }
    el.textContent = isMoney ? money(v) : String(v);
  });
  // Count-up numbers (job sheet) animate to data-count, so hand them the value.
  document.querySelectorAll('[data-p-count]').forEach(function (el) {
    var v = lookup(el.getAttribute('data-p-count'));
    el.setAttribute('data-count', v);
    el.textContent = (el.getAttribute('data-pre') || '') + v.toLocaleString('en-US') + (el.getAttribute('data-suf') || '');
  });

  // Founding client banner: only while the offer is on and not past its last day.
  var today;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) {
    today = new Date().toISOString().slice(0, 10);
  }
  var foundingOn = F.enabled && today <= F.endsOn;
  document.querySelectorAll('[data-founding]').forEach(function (el) { el.hidden = !foundingOn; });

  // Monthly subscription / Pay upfront toggle.
  function show(mode) {
    document.querySelectorAll('[data-view]').forEach(function (el) {
      el.hidden = el.getAttribute('data-view') !== mode;
    });
  }
  var radios = document.querySelectorAll('input[name="wb-billing"]');
  radios.forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) show(r.value); });
    if (r.checked) show(r.value);
  });

  window.JWC_PRICING = { config: PRICING, values: V, foundingOn: foundingOn };
})();
