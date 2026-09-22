// Page behaviours for journeymanwebco.com, loaded with defer after config.js and pricing.js.
// Motion is skipped under prefers-reduced-motion.
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. billing toggle and every price: see pricing.js

  // Recent work: the A-1 case study appears only when config.js turns it on,
  // and its quote only if /assets/work/a1-quote.txt exists.
  var cfg = window.JWC_CONFIG || {}, a1 = document.querySelector('[data-case="a1"]');
  if (a1 && cfg.showA1CaseStudy) {
    a1.hidden = false;
    a1.parentNode.classList.add('has-a1');
    fetch('/assets/work/a1-quote.txt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var line = (t || '').trim().split('\n')[0];
      if (!line) return;
      var q = a1.querySelector('[data-a1-quote]');
      q.textContent = '\u201c' + line.replace(/^["\u201c]|["\u201d]$/g, '') + '\u201d';
      q.hidden = false;
    }).catch(function () {});
  }

  // 2. scroll reveals. Content is visible unless this script marks an element
  // that starts below the fold; no JS or reduced motion means no hiding at all.
  if (!reduced && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = (el.getAttribute('data-reveal') || 0) + 'ms';
        el.classList.add('revealed');
        el.classList.remove('pre-reveal');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      if (el.getBoundingClientRect().top < innerHeight) return;
      el.classList.add('pre-reveal');
      io.observe(el);
    });
  }

  // 3. process timeline
  document.querySelectorAll('[data-timeline]').forEach(function (tl) {
    var steps = [].slice.call(tl.querySelectorAll('[data-step]'));
    function done(s, instant) {
      var node = s.querySelector('[data-node]'), num = s.querySelector('[data-num]'), chk = s.querySelector('[data-chk]');
      if (!node || !num || !chk) return;
      node.style.background = 'var(--color-accent)';
      node.style.borderColor = 'var(--color-accent)';
      num.style.opacity = '0';
      chk.style.opacity = '1';
      chk.style.strokeDashoffset = '0';
      if (!instant) {
        node.style.transform = 'scale(1.15)';
        setTimeout(function () { node.style.transform = 'scale(1)'; }, 200);
      }
    }
    if (reduced) {
      steps.forEach(function (s) {
        var r = s.querySelector('[data-rail]');
        if (r) { r.style.transition = 'none'; r.style.transform = 'scaleX(1)'; }
        done(s, true);
      });
      return;
    }
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        steps.forEach(function (s, i) {
          var d = i * 520;
          setTimeout(function () {
            var r = s.querySelector('[data-rail]');
            if (r) r.style.transform = 'scaleX(1)';
          }, d);
          setTimeout(function () { done(s, false); }, d + 440);
        });
        tio.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    tio.observe(tl);
  });

  // 4. free review form: send to the journeyman-contact Worker (Turnstile + Resend)
  var rf = document.getElementById('review-form');
  var ts = document.getElementById('rv-turnstile'), tsLoading = false;
  function loadTurnstile() {
    if (tsLoading || !ts) return;
    tsLoading = true;
    window.jwcTurnstileReady = function () {
      window.jwcTurnstileId = turnstile.render(ts, {
        sitekey: ts.getAttribute('data-sitekey'), theme: 'light', size: innerWidth < 400 ? 'compact' : 'normal'
      });
    };
    var sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=jwcTurnstileReady';
    sc.async = true;
    document.head.appendChild(sc);
  }
  if (ts && 'IntersectionObserver' in window) {
    var tsio = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { tsio.disconnect(); loadTurnstile(); }
    }, { rootMargin: '800px 0px' });
    tsio.observe(document.getElementById('review'));
  } else {
    loadTurnstile();
  }
  if (rf) {
    rf.addEventListener('focusin', loadTurnstile);
    var btn = rf.querySelector('button[type="submit"]'), label = btn.textContent;
    var err = document.getElementById('review-error'), sent = document.getElementById('review-sent');
    var fail = function (msg) {
      // Fixable problems show the Worker's message; anything else shows phone and email.
      var m = err.querySelector('[data-msg]');
      m.textContent = msg || ''; m.hidden = !msg;
      err.querySelector('[data-fallback]').hidden = !!msg;
      err.hidden = false;
      if (window.turnstile) turnstile.reset(window.jwcTurnstileId);
      btn.disabled = false; btn.textContent = label;
    };
    rf.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var f = rf.elements, v = function (n) { return (f.namedItem(n).value || '').trim(); };
      var token = window.turnstile && window.jwcTurnstileId != null ? turnstile.getResponse(window.jwcTurnstileId) : '';
      if (!token) { fail('Finish the quick bot check above the button, then send it again.'); return; }
      btn.disabled = true; btn.textContent = 'Sending...';
      fetch(rf.getAttribute('data-endpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: v('website'), name: v('name'), business: v('business'),
          phone: v('phone'), email: v('email'), notes: v('notes'), package: v('package'),
          hp: f.namedItem('bf_check').value, turnstileToken: token
        })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (!(x.r.ok && x.d.ok)) { fail(x.r.status < 500 ? x.d.error : ''); return; }
          rf.hidden = true; sent.hidden = false; sent.focus();
        })
        .catch(function () { fail(''); });
    });
  }

  // 5. "Start with ..." buttons pick the package (and the monthly/upfront view) in the review form
  var pkg = document.getElementById('rv-package');
  document.querySelectorAll('[data-package]').forEach(function (a) {
    a.addEventListener('click', function () {
      var mode = document.querySelector('input[name="wb-billing"]:checked');
      if (pkg) pkg.value = a.getAttribute('data-package') + ', ' + (mode ? mode.value : 'monthly');
    });
  });

  // 6. phones: sticky Call / Free review bar, tucked away while the form is on screen
  var bar = document.getElementById('callbar'), formCard = document.querySelector('.wb-review-form');
  if (bar && formCard && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var away = es[0].isIntersecting;
      bar.classList.toggle('is-hidden', away);
      bar.inert = away; // no tabbing onto links that are slid out of view
    }).observe(formCard);
  }

  // 7. FAQ: answers open on wide screens, tap-to-open on phones
  if (matchMedia('(min-width: 900px)').matches) {
    document.querySelectorAll('.wb-qa').forEach(function (d) { d.open = true; });
  }
})();
