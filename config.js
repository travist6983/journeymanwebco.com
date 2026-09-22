// Site switches for journeymanwebco.com. Flip these here; the page reads them.
// Prices and plan terms live in pricing.js.
window.JWC_CONFIG = {
  // TODO(A-1): set to true when you want the A-1 Bracket Group case study on the page.
  // Before/after images are in /assets/work. The "after" is the redesign preview;
  // a-1bracket.com, which the case study links to, still shows the old site.
  // An optional one-line client quote goes in /assets/work/a1-quote.txt.
  showA1CaseStudy: false,

  // Where "See the site" on the A-1 Recent work card goes.
  a1SiteUrl: 'https://travist6983.github.io/a-1bracket/index.html',

  // Cloudflare Web Analytics site token. The beacon loads only on the live domain.
  cfAnalyticsToken: '56f282fbce194f33ad8f498c74c3ded6'
};

// Cloudflare Web Analytics (no cookies): live site only, never localhost or previews.
(function () {
  var token = window.JWC_CONFIG.cfAnalyticsToken;
  if (!token || location.hostname !== 'journeymanwebco.com') return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();

// Links whose URL lives in this file: <a data-config-href="a1SiteUrl">.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-config-href]').forEach(function (a) {
    var url = window.JWC_CONFIG[a.getAttribute('data-config-href')];
    if (url) a.href = url;
  });
});
