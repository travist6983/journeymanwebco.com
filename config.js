// Site switches for journeymanwebco.com. Flip these here; the page reads them.
// Prices and plan terms live in pricing.js.
window.JWC_CONFIG = {
  // TODO(A-1): set to true when you want the A-1 Bracket Group case study on the page.
  // Before/after images are in /assets/work. The "after" is the redesign preview;
  // a-1bracket.com, which the card links to, still shows the old site.
  // An optional one-line client quote goes in /assets/work/a1-quote.txt.
  showA1CaseStudy: false,

  // TODO(analytics): paste the Cloudflare Web Analytics site token here to turn on the beacon.
  // Empty means no analytics script loads at all.
  cfAnalyticsToken: ''
};

// Cloudflare Web Analytics (no cookies). Loads only when a token is set above.
(function () {
  var token = window.JWC_CONFIG.cfAnalyticsToken;
  if (!token) return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
