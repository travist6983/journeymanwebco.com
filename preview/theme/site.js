/* Concept-preview theme behaviour. Source: templates/site.js, copied to preview/theme/site.js by the build. */
(function () {
  var d = document, hdr = d.querySelector('.hdr');

  // Header shadow once scrolled
  var onScroll = function () { if (hdr) hdr.classList.toggle('scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Mobile drawer
  var drawer = d.querySelector('.drawer');
  var setOpen = function (open) {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    d.body.style.overflow = open ? 'hidden' : '';
    var b = d.querySelector('.burger'); if (b) b.setAttribute('aria-expanded', String(open));
  };
  d.addEventListener('click', function (e) {
    if (e.target.closest('.burger')) setOpen(true);
    else if (e.target.closest('.drawer-close, .drawer-bg') || (e.target.closest('.drawer-nav a'))) setOpen(false);
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

  // Scroll reveal
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    d.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    d.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // Open now / closes at, from data-hours JSON on [data-hours]
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var toMin = function (s) {
    var m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])/i.exec(s.trim()); if (!m) return null;
    var h = +m[1] % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0); return h * 60 + (+(m[2] || 0));
  };
  var expandDays = function (label) {
    // "Mon–Fri", "Mon-Fri", "Sat", "Mon, Wed, Fri"
    var out = [];
    label.toLowerCase().split(',').forEach(function (part) {
      var r = part.split(/[–\-]/).map(function (x) { return x.trim().slice(0, 3); });
      var a = DAYS.indexOf(r[0]), b = DAYS.indexOf(r[1] || r[0]);
      if (a < 0 || b < 0) return;
      for (var i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; }
    });
    return out;
  };
  var hoursEl = d.querySelector('[data-hours]');
  if (hoursEl) {
    try {
      var rows = JSON.parse(hoursEl.getAttribute('data-hours')), now = new Date(), today = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
      var todayRow = null;
      rows.forEach(function (r) { if (expandDays(r.days).indexOf(today) >= 0) todayRow = r; });
      var open = false, text = 'Closed today';
      if (todayRow && !todayRow.closed) {
        var o = toMin(todayRow.open), c = toMin(todayRow.close);
        if (o != null && c != null) {
          open = mins >= o && mins < c;
          text = open ? 'Open now · Closes ' + todayRow.close : (mins < o ? 'Opens today at ' + todayRow.open : 'Closed · Opens ' + nextOpen(rows, today));
        }
      } else text = 'Closed today · Opens ' + nextOpen(rows, today);
      d.querySelectorAll('[data-open-status]').forEach(function (el) {
        el.innerHTML = '<span class="dot' + (open ? '' : ' closed') + '"></span>' + text;
      });
      d.querySelectorAll('.hours tr[data-days]').forEach(function (tr) {
        if (expandDays(tr.getAttribute('data-days')).indexOf(today) >= 0) tr.classList.add('today');
      });
    } catch (e) {}
  }
  function nextOpen(rows, today) {
    for (var k = 1; k <= 7; k++) {
      var day = (today + k) % 7, hit = null;
      rows.forEach(function (r) { if (!r.closed && expandDays(r.days).indexOf(day) >= 0) hit = r; });
      if (hit) return (k === 1 ? 'tomorrow' : DAYS[day].charAt(0).toUpperCase() + DAYS[day].slice(1)) + ' at ' + hit.open;
    }
    return 'soon';
  }

  // Before / after sliders
  d.querySelectorAll('.ba input').forEach(function (r) {
    var box = r.closest('.ba'), set = function () { box.style.setProperty('--x', r.value + '%'); };
    r.addEventListener('input', set); set();
  });

  // Preview forms: show the note instead of sending
  d.querySelectorAll('form.f').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = f.querySelector('.formnote'); if (n) { n.classList.add('show'); n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  });

  // Animated counters: <b data-count="170" data-suffix="+">
  var countEls = d.querySelectorAll('[data-count]');
  if (countEls.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return; cio.unobserve(en.target);
        var el = en.target, target = parseFloat(el.getAttribute('data-count')), dec = (el.getAttribute('data-count').split('.')[1] || '').length;
        var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '', t0 = null;
        var step = function (ts) {
          if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1100), e2 = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + (target * e2).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suf;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    countEls.forEach(function (el) { cio.observe(el); });
  }
})();
