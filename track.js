// Lead link tracking (?r=). No cookies; sessionStorage only.
(function () { try {
var S = sessionStorage, u = new URL(location.href), q = u.searchParams.get('r');
if (q && /^[a-z0-9]{6,8}$/.test(q)) S.setItem('jwc_r', q);
if (u.searchParams.has('r')) {
  u.searchParams.delete('r');
  history.replaceState(history.state, '', u.pathname + u.search + u.hash);
}
var r = S.getItem('jwc_r'), f = document.getElementById('review-form'), D = {}, t;
if (!r || !f || navigator.webdriver) return;
var api = f.getAttribute('data-endpoint') + '/t';
var send = function (type, d) { try {
  var b = JSON.stringify({ r: r, type: type, detail: String(d || '').trim().slice(0, 120), path: location.pathname + location.hash });
  navigator.sendBeacon && navigator.sendBeacon(api, new Blob([b], { type: 'text/plain' })) ||
    fetch(api, { method: 'POST', body: b, keepalive: true, mode: 'no-cors' }).catch(function () {});
} catch (e) {} };
var once = function (k, type, d) { if (D[k] || S.getItem(k)) return; D[k] = S[k] = 1; send(type, d); };
// visit = 5s on screen (link scanners open, then leave)
var watch = function () {
  clearTimeout(t);
  if (document.visibilityState == 'visible') t = setTimeout(function () { once('jwc_v', 'visit'); }, 5000);
};
document.addEventListener('visibilitychange', watch);
watch();
// engaged = 30% scrolled, or a data-track click
addEventListener('scroll', function () {
  var h = document.documentElement.scrollHeight - innerHeight;
  if (!D.jwc_e && h > 0 && scrollY / h >= .3) once('jwc_e', 'engaged', 'scroll 30%');
}, { passive: true });
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-track]'), k = el && el.getAttribute('data-track');
  if (!k) return;
  send(k, el.getAttribute('data-track-detail') || el.textContent);
  once('jwc_e', 'engaged', k);
}, true);
f.addEventListener('focusin', function () { once('jwc_fs', 'form_start'); });
f.addEventListener('submit', function () { send('form_submit', f.elements.package.value); });
} catch (e) {} })();
