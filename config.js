// Site switches for journeymanwebco.com. Flip these here; the page reads them.
// Prices and plan terms live in pricing.js.
window.JWC_CONFIG = {
  // A-1 Bracket Group case study in Recent work. The rebuilt site is live at a-1bracket.com.
  // Before/after images are in /assets/work. An optional one-line client quote goes in
  // /assets/work/a1-quote.txt; it stays hidden while that file is missing or empty.
  showA1CaseStudy: true,

  // Where the "Live site" buttons on the A-1 Recent work cards go.
  a1SiteUrl: 'https://a-1bracket.com',

  // The offer line under the Packages heading:
  //   'case-study'  three businesses this fall at case-study pricing (review + permission to show the site)
  //   'launch'      fall launch pricing from launchOffer in pricing.js; hides itself after its last day
  //   'none'        no offer line
  OFFER_MODE: 'case-study',

  // Cloudflare Web Analytics site token. The beacon loads only on the live domain.
  cfAnalyticsToken: '56f282fbce194f33ad8f498c74c3ded6'
};

// Cloudflare Web Analytics (no cookies): live domain only (home page and /preview/ pages), never localhost.
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
