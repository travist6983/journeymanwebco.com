// Ross Towing concept: one truck, one road.
//
// Desktop (wide screen with a mouse): the road is an SVG generated from the page layout, so it
// always runs in the empty column beside the copy. The truck's front rides a line ANCHOR of the
// way down the viewport, and its spot on the road is looked up by height, so it never wanders
// off screen. It stops twice (hook-up, winch out) while the page keeps scrolling, then catches up.
// Mobile / touch: a straight lane down the left edge and a small fixed truck that changes state.
// Reduced motion: no smooth scroll, nothing moves; still trucks are drawn in each stage.
// Every word on the page is real HTML; this file only draws decoration.

const D = document, W = window;
const journey = D.getElementById('journey');
const mqDesk = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
// ?reduce forces the reduced-motion path for QA (same as the OS setting)
const FORCE_REDUCE = new URLSearchParams(location.search).has('reduce');
if (FORCE_REDUCE) D.documentElement.classList.add('rm');
const DESK = mqDesk.matches, REDUCE = mqReduce.matches || FORCE_REDUCE;
const ANCHOR = 0.64, ANCHOR_M = 0.56;
const OFF = 19;              // truck drives in the right-hand lane, this far from the center line
const DECEL = 90, CATCH = 560;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
const DEG = 180 / Math.PI;
const f1 = (n) => Math.round(n * 10) / 10;

// ---------- small things that work with or without GSAP ----------
(function menu() {
  const btn = D.querySelector('.menu-btn'), nav = D.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    btn.textContent = open ? 'Close' : 'Menu';
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && nav.classList.contains('open')) { btn.click(); }
  });
})();

// Forms, Towbook and the next auction banner live in src/main.js (works with or without this file).

// Mode changes (window dragged across the breakpoint, motion setting flipped): rebuild cleanly.
[mqDesk, mqReduce].forEach((mq) => mq.addEventListener('change', () => location.reload()));

// ---------- truck art (top-down, nose pointing +x, origin at the front bumper) ----------
const svgWrap = (x, y, w, h, body) =>
  `<svg viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" style="left:${x}px;top:${y}px" aria-hidden="true" focusable="false">${body}</svg>`;
const TAILS = (x, y1, y2) => `<rect class="tail" x="${x}" y="${y1}" width="3" height="6" rx="1" fill="#E0362C"/><rect class="tail" x="${x}" y="${y2}" width="3" height="6" rx="1" fill="#E0362C"/>`;
const REV = (x) => `<rect class="rev" x="${x}" y="-12" width="3" height="4" fill="#fff"/><rect class="rev" x="${x}" y="8" width="3" height="4" fill="#fff"/>`;

const UNIT = svgWrap(-132, -54, 290, 108, `
  <path class="beams" d="M0 -15 L150 -50 L150 50 L0 15Z" fill="url(#rt-beam)"/>
  <g class="v-wrecker">
    <rect x="-121" y="-18" width="122" height="42" rx="6" fill="#000" opacity=".3" transform="translate(3 4)"/>
    <rect x="-127" y="-13" width="5" height="26" rx="1" fill="#454B53"/>
    <rect x="-123" y="-8" width="17" height="16" fill="#2B2F35"/>
    <rect x="-108" y="-20" width="68" height="40" rx="3" fill="#3B4047"/>
    <path d="M-102 -10h58M-102 0h58M-102 10h58" stroke="#4E555D" stroke-width="1" stroke-dasharray="2 3"/>
    <rect x="-108" y="-20" width="68" height="3" fill="#C70606"/><rect x="-108" y="17" width="68" height="3" fill="#C70606"/>
    <rect x="-108" y="-20" width="6" height="40" fill="url(#rt-chev)"/>
    ${TAILS(-109, -19, 13)}${REV(-109)}
    <g class="boom">
      <circle cx="-62" cy="0" r="11" fill="#23272C" stroke="#4E555D" stroke-width="1.5"/>
      <rect x="-116" y="-5" width="56" height="10" rx="2" fill="#B30707" stroke="#4A0202" stroke-width="1"/>
      <rect x="-121" y="-4" width="6" height="8" rx="1" fill="#2B2F35"/>
      <circle cx="-62" cy="0" r="4" fill="#15171A"/>
    </g>
  </g>
  <g class="v-rig">
    <rect x="-78" y="-18" width="80" height="42" rx="6" fill="#000" opacity=".3" transform="translate(3 4)"/>
    <rect x="-78" y="-13" width="38" height="26" rx="2" fill="#2B2F35"/>
    <rect x="-76" y="-22" width="22" height="5" rx="2" fill="#454B53"/><rect x="-76" y="17" width="22" height="5" rx="2" fill="#454B53"/>
    <circle cx="-60" cy="0" r="10" fill="#3A3F46" stroke="#5E656D" stroke-width="1.5"/><path d="M-60 0h-12" stroke="#5E656D" stroke-width="3"/>
    <circle cx="-45" cy="-17" r="2.6" fill="#B8BDC3"/><circle cx="-45" cy="17" r="2.6" fill="#B8BDC3"/>
    ${TAILS(-79, -13, 7)}
  </g>
  <rect x="-42" y="-21" width="42" height="42" rx="7" fill="#C70606"/>
  <rect x="-14" y="-19" width="13" height="38" rx="5" fill="#E2211F"/><rect x="-13" y="-19.5" width="3" height="39" rx="1" fill="#D9DEE2"/>
  <path d="M-23 -17.5 L-14 -19 L-14 19 L-23 17.5Z" fill="#1D2630"/>
  <rect x="-40" y="-18" width="17" height="36" rx="3" fill="#A30606"/>
  <rect x="-34" y="-17" width="5" height="34" rx="2" fill="#2A2E34"/>
  <rect class="lb-a" x="-34" y="-17" width="5" height="9" rx="1.5" fill="#FFC23A"/>
  <rect class="lb-a" x="-34" y="8" width="5" height="9" rx="1.5" fill="#FFC23A"/>
  <rect class="lb-b" x="-34" y="-4.5" width="5" height="9" rx="1.5" fill="#FFC23A"/>
  <rect x="-21" y="-25" width="4" height="4" rx="1" fill="#C9CED3"/><rect x="-21" y="21" width="4" height="4" rx="1" fill="#C9CED3"/><circle cx="-43.5" cy="-18.5" r="2.4" fill="#D9DEE2" stroke="#7D868C" stroke-width=".8"/><circle cx="-43.5" cy="18.5" r="2.4" fill="#D9DEE2" stroke="#7D868C" stroke-width=".8"/>
  <rect x="-2.5" y="-17" width="2.5" height="6" rx="1" fill="#FFF6D5"/><rect x="-2.5" y="11" width="2.5" height="6" rx="1" fill="#FFF6D5"/>
  <circle class="lb-glow-a" cx="-31.5" cy="-13" r="24" fill="url(#rt-glow)"/>
  <circle class="lb-glow-a" cx="-31.5" cy="13" r="24" fill="url(#rt-glow)"/>
  <circle class="lb-glow-b" cx="-31.5" cy="0" r="24" fill="url(#rt-glow)"/>`);

const carBody = (fill = '#6F8194', hood = '#8094A8', roof = '#65778A') => `
  <rect x="-86" y="-16" width="86" height="36" rx="11" fill="#000" opacity=".3" transform="translate(3 3)"/>
  <rect x="-86" y="-18" width="86" height="36" rx="11" fill="${fill}"/>
  <rect x="-20" y="-16" width="18" height="32" rx="7" fill="${hood}"/>
  <path d="M-33 -15 L-20 -16.5 L-20 16.5 L-33 15Z" fill="#1D2630"/>
  <rect x="-61" y="-15" width="28" height="30" rx="4" fill="${roof}"/>
  <path d="M-70 -14 L-61 -15 L-61 15 L-70 14Z" fill="#1D2630"/>
  <rect x="-25" y="-22" width="4" height="4" rx="1" fill="#3A4450"/><rect x="-25" y="18" width="4" height="4" rx="1" fill="#3A4450"/>`;
const CAR = svgWrap(-96, -28, 104, 56, `${carBody()}
  <rect class="tail" x="-86" y="-16" width="2.5" height="7" fill="#B02A22"/><rect class="tail" x="-86" y="9" width="2.5" height="7" fill="#B02A22"/>
  <rect x="-2.5" y="-15" width="2.5" height="6" fill="#EDEFF2"/><rect x="-2.5" y="9" width="2.5" height="6" fill="#EDEFF2"/>
  <g class="hz">
    <circle cx="-3" cy="-16" r="10" fill="url(#rt-glow)"/><circle cx="-3" cy="16" r="10" fill="url(#rt-glow)"/>
    <circle cx="-84" cy="-16" r="10" fill="url(#rt-glow)"/><circle cx="-84" cy="16" r="10" fill="url(#rt-glow)"/>
    <rect x="-5" y="-18" width="4" height="3" fill="#FFC23A"/><rect x="-5" y="15" width="4" height="3" fill="#FFC23A"/>
    <rect x="-86" y="-18" width="4" height="3" fill="#FFC23A"/><rect x="-86" y="15" width="4" height="3" fill="#FFC23A"/>
  </g>`);

const TRAILER = svgWrap(-244, -30, 262, 60, `
  <rect x="-236" y="-21" width="246" height="42" rx="2" fill="#000" opacity=".3" transform="translate(3 4)"/>
  <rect x="-236" y="-21" width="246" height="42" rx="2" fill="#7A6249"/>
  <path d="M-234 -14h242M-234 -7h242M-234 0h242M-234 7h242M-234 14h242" stroke="#66503B" stroke-width="1"/>
  <rect x="-236" y="-21" width="246" height="3" fill="#2F343A"/><rect x="-236" y="18" width="246" height="3" fill="#2F343A"/>
  ${TAILS(-237, -19, 13)}${REV(-237)}
  <rect x="-206" y="-22" width="92" height="12" rx="5" fill="#1B1E22"/><rect x="-206" y="10" width="92" height="12" rx="5" fill="#1B1E22"/>
  <path d="M-202 -16h84M-202 16h84" stroke="#4A5058" stroke-width="7" stroke-dasharray="2 3"/>
  <rect x="-199" y="-15" width="12" height="30" rx="3" fill="#7E878F" stroke="#2B2F35" stroke-width="1.2"/>
  <rect x="-188" y="-16" width="54" height="32" rx="5" fill="#D6DADE" stroke="#2B2F35" stroke-width="1.5"/>
  <rect x="-152" y="-16" width="16" height="13" rx="2" fill="#1D2630"/>
  <rect x="-138" y="-3" width="76" height="10" rx="3" fill="#BAC1C8" stroke="#2B2F35" stroke-width="1.3"/>
  <rect x="-74" y="-8" width="36" height="9" rx="3" fill="#A3ABB3" stroke="#2B2F35" stroke-width="1.2"/>
  <rect x="-46" y="-11" width="13" height="15" rx="2" fill="#2B2F35"/>
  <path d="M-212 -21L-201 -14M-212 21L-201 14M-110 -21L-119 -14M-110 21L-119 14" stroke="#D5D8DC" stroke-width="1.4" stroke-dasharray="2 1.6"/>`);

const BOXTRUCK = svgWrap(-68, -28, 130, 56, `
  <rect x="-62" y="-20" width="118" height="44" rx="4" fill="#000" opacity=".3" transform="translate(3 3)"/>
  <rect x="-62" y="-22" width="88" height="44" rx="3" fill="#E6E3DC"/>
  <path d="M-52 -22v44M-38 -22v44M-24 -22v44M-10 -22v44M4 -22v44M18 -22v44" stroke="#CFCAC0" stroke-width="1"/>
  <rect x="27" y="-19" width="29" height="38" rx="6" fill="#7D8790"/>
  <path d="M43 -17 L52 -18 L52 18 L43 17Z" fill="#1D2630"/>
  <rect x="-63" y="-20" width="2.5" height="7" fill="#B02A22"/><rect x="-63" y="13" width="2.5" height="7" fill="#B02A22"/>`);

const HITCH = { 0: -124, 1: -60 };
const TOW_LEN = { 0: 80, 1: 205 };
const RIG_LEN = 300;

function makeLayer(cls = '') {
  const el = D.createElement('div');
  el.className = 'truck-layer ' + cls;
  el.innerHTML = `<div class="part unit">${UNIT}</div><div class="part tow-car">${CAR}</div><div class="part tow-trailer">${TRAILER}</div><div class="part winch" hidden><i></i></div>`;
  const L = { el, unit: el.children[0], car: el.children[1], trailer: el.children[2], winch: el.children[3], boom: el.querySelector('.boom'), state: -1, clip: '' };
  setState(L, 0);
  return L;
}
function setState(L, st) {
  if (L.state === st) return;
  L.state = st;
  L.el.classList.toggle('st-rig', st === 1);
  L.el.classList.toggle('st-wrecker', st !== 1);
  L.car.hidden = st !== 0;
  L.trailer.hidden = st !== 1;
  if (st !== 0) { L.winch.hidden = true; setBoom(L, 0); }
}
function setT(el, x, y, a, s) {
  el.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,0) rotate(${f1(a * DEG)}deg)${s ? ` scale(${s})` : ''}`;
}
function setBoom(L, rad) {
  const d = f1(rad * DEG);
  if (L.boomDeg === d) return;
  L.boomDeg = d;
  L.boom.setAttribute('transform', `rotate(${d} -62 0)`);
}
function setClip(L, clip) {
  if (L.clip === clip) return;
  L.clip = clip;
  L.el.style.clipPath = clip;
}

// ---------- static scenery (SVG strings in journey coordinates) ----------
const FONT = `font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700"`;
function greenSign(x, y, w, h, lines, size = 17, tab) {
  let s = `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="${-w / 2 + 3}" y="${-h / 2 + 4}" width="${w}" height="${h}" rx="5" fill="#000" opacity=".22"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="5" fill="#0E6B45"/><rect x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="3" fill="none" stroke="#fff" stroke-width="1.5"/>`;
  if (tab) s += `<rect x="${w / 2 - 46}" y="${-h / 2 - 15}" width="40" height="17" rx="3" fill="#0E6B45"/><text x="${w / 2 - 26}" y="${-h / 2 - 2.5}" text-anchor="middle" fill="#fff" font-size="12" ${FONT}>${tab}</text>`;
  const lh = size * 1.1, top = -((lines.length - 1) * lh) / 2 + size * 0.36;
  lines.forEach((t, i) => { s += `<text x="0" y="${f1(top + i * lh)}" text-anchor="middle" fill="#fff" font-size="${size}" ${FONT}>${t}</text>`; });
  return s + '</g>';
}
function shieldI(x, y, num) {
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-20 -20 Q0 -26 20 -20 Q24 2 0 23 Q-24 2 -20 -20Z" fill="#fff" stroke="#15171A" stroke-width="1"/>
    <path d="M-17.5 -17.5 Q0 -22.5 17.5 -17.5 Q21 2 0 19.5 Q-21 2 -17.5 -17.5Z" fill="#1D4F91"/>
    <path d="M-17.5 -17.5 Q0 -22.5 17.5 -17.5 L18.6 -9 L-18.6 -9Z" fill="#C8102E"/>
    <text y="10" text-anchor="middle" fill="#fff" font-size="${num.length > 2 ? 14 : 17}" ${FONT}>${num}</text></g>`;
}
function shieldM(x, y, num) {
  return `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="-16" y="-16" width="32" height="32" transform="rotate(45)" fill="#fff" stroke="#15171A" stroke-width="2.5"/>
    <text y="-3" text-anchor="middle" fill="#15171A" font-size="11" ${FONT}>M</text><text y="12" text-anchor="middle" fill="#15171A" font-size="15" ${FONT}>${num}</text></g>`;
}
function iconSign(x, y, icon) {
  return `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="-15" y="-13" width="32" height="32" rx="6" fill="#000" opacity=".3"/><rect x="-17" y="-16" width="32" height="32" rx="6" fill="#ECE7DB"/>
    <use href="#${icon}" x="-11" y="-10" width="20" height="20" fill="none" stroke="#15171A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function parkedCar(x, y, a, fill) {
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a}) translate(43 0)">${carBody(fill, fill, fill)}</g>`;
}
// The Telegraph Rd yard. gate 'bottom' = start of the trip, 'top' = back at the yard.
function yard(cx, cy, gate, scale) {
  const w = 300 * scale, x0 = cx - w / 2;
  const top = gate === 'bottom' ? cy - 210 : cy - 160, h = 250;
  const bx = cx + 34 * scale, by = gate === 'bottom' ? top + 22 : top + h - 100;
  let s = `<g>`;
  s += `<rect x="${f1(x0)}" y="${f1(top)}" width="${f1(w)}" height="${h}" rx="16" fill="#181B1F" stroke="#4E535B" stroke-width="2" stroke-dasharray="7 6"/>`;
  s += `<circle cx="${f1(cx - 70 * scale)}" cy="${f1(top + 60)}" r="120" fill="url(#rt-pool)"/><circle cx="${f1(cx + 80 * scale)}" cy="${f1(top + h - 60)}" r="110" fill="url(#rt-pool)"/>`;
  s += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(100 * scale)}" height="78" rx="3" fill="#262A30" stroke="#3D434B" stroke-width="1.5"/>`;
  s += `<rect x="${f1(bx + 10)}" y="${f1(by + 10)}" width="16" height="12" fill="#31363D"/><rect x="${f1(bx + 32)}" y="${f1(by + 10)}" width="16" height="12" fill="#31363D"/>`;
  s += `<text x="${f1(bx + 50 * scale)}" y="${f1(by + 60)}" text-anchor="middle" fill="#E0201F" font-size="26" opacity=".95" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" letter-spacing="2">ROSS</text>`;
  const stallTop = gate === 'bottom' ? top + 28 : top + 70;
  s += `<path d="M${f1(cx - 52 * scale)} ${f1(stallTop)}v92M${f1(cx - 96 * scale)} ${f1(stallTop)}v92M${f1(cx - 140 * scale)} ${f1(stallTop)}v92M${f1(cx + 8)} ${f1(stallTop)}v92" stroke="#3A3F46" stroke-width="2"/>`;
  s += parkedCar(cx - 74 * scale, stallTop + 46, -90, '#4A525C') + parkedCar(cx - 118 * scale, stallTop + 46, -90, '#5A4F4A');
  const gy = gate === 'bottom' ? top + h : top;
  s += `<rect x="${f1(cx - 52)}" y="${f1(gy - 7)}" width="12" height="14" fill="url(#rt-chev)"/><rect x="${f1(cx + 40)}" y="${f1(gy - 7)}" width="12" height="14" fill="url(#rt-chev)"/>`;
  return s + '</g>';
}
function overpass(cx, Y, hw, id, sign) {
  let s = `<g mask="url(#${id})">`;
  s += `<rect x="${f1(cx - hw)}" y="${f1(Y + 34)}" width="${f1(hw * 2)}" height="28" fill="url(#rt-shade)"/>`;
  s += `<rect x="${f1(cx - hw)}" y="${f1(Y - 34)}" width="${f1(hw * 2)}" height="68" fill="#9C9EA2"/>`;
  s += `<rect x="${f1(cx - hw)}" y="${f1(Y - 34)}" width="${f1(hw * 2)}" height="6" fill="#C9CBCE"/><rect x="${f1(cx - hw)}" y="${f1(Y + 28)}" width="${f1(hw * 2)}" height="6" fill="#77797E"/>`;
  s += `<rect x="${f1(cx - hw)}" y="${f1(Y - 23)}" width="${f1(hw * 2)}" height="46" fill="#3A3E44"/>`;
  s += `<path d="M${f1(cx - hw)} ${f1(Y)}h${f1(hw * 2)}" stroke="#E8C14A" stroke-width="2" stroke-dasharray="14 12"/>`;
  s += `</g>`;
  if (sign) s += greenSign(cx - OFF, Y + 52, sign.w, 30, [sign.text], 16);
  return s;
}
function fadeMask(id, cx, Y, hw) {
  return `<linearGradient id="${id}-g" x1="${f1(cx - hw)}" x2="${f1(cx + hw)}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".16" stop-color="#fff"/><stop offset=".84" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="${id}" maskUnits="userSpaceOnUse" x="${f1(cx - hw)}" y="${f1(Y - 40)}" width="${f1(hw * 2)}" height="110"><rect x="${f1(cx - hw)}" y="${f1(Y - 40)}" width="${f1(hw * 2)}" height="110" fill="url(#${id}-g)"/></mask>`;
}

// A contained spill on the far shoulder: slick inside a containment boom, absorbent pads, cones and a spill trailer.
function spillScene(cx, y, k) {
  const sx = cx + 46 + 100 * k, sy = y, rx = 86 * k, ry = 70;
  let s = '<g>';
  const tx = cx + 52, ty = sy - ry - 190;
  s += `<rect x="${f1(tx + 3)}" y="${f1(ty + 4)}" width="40" height="122" rx="4" fill="#000" opacity=".3"/>`;
  s += `<rect x="${f1(tx - 4)}" y="${f1(ty + 70)}" width="5" height="17" rx="2" fill="#15171A"/><rect x="${f1(tx + 39)}" y="${f1(ty + 70)}" width="5" height="17" rx="2" fill="#15171A"/>`;
  s += `<rect x="${f1(tx)}" y="${f1(ty)}" width="40" height="122" rx="4" fill="#E4E7EA" stroke="#9AA3A8" stroke-width="1.5"/>`;
  s += `<rect x="${f1(tx)}" y="${f1(ty + 84)}" width="40" height="7" fill="#C70606"/>`;
  s += `<path d="M${f1(tx + 11)} ${f1(ty + 122)}L${f1(tx + 20)} ${f1(ty + 142)}L${f1(tx + 29)} ${f1(ty + 122)}" fill="none" stroke="#5E666C" stroke-width="3" stroke-linejoin="round"/>`;
  s += `<text x="${f1(tx + 20)}" y="${f1(ty + 44)}" text-anchor="middle" fill="#C70606" font-size="13" letter-spacing="1.5" ${FONT} transform="rotate(90 ${f1(tx + 20)} ${f1(ty + 44)})">SPILL</text>`;
  const b = (dx, dy) => `${f1(sx + dx * rx)} ${f1(sy + dy * ry)}`;
  s += `<path d="M${b(-0.95, -0.1)}C${b(-1, -0.8)} ${b(-0.25, -1)} ${b(0.2, -0.82)}C${b(0.75, -0.62)} ${b(1, -0.15)} ${b(0.88, 0.32)}C${b(0.74, 0.86)} ${b(0.05, 1)} ${b(-0.38, 0.84)}C${b(-0.8, 0.68)} ${b(-0.92, 0.36)} ${b(-0.95, -0.1)}Z" fill="url(#rt-oil)"/>`;
  s += `<path d="M${b(0.3, 0.5)}c14 6 30 4 38 -6" fill="none" stroke="#3A3360" stroke-width="2" stroke-opacity=".7" stroke-linecap="round"/>`;
  s += `<ellipse cx="${f1(sx)}" cy="${f1(sy)}" rx="${f1(rx + 16)}" ry="${f1(ry + 15)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="10" transform="translate(2 3)"/>`;
  s += `<ellipse cx="${f1(sx)}" cy="${f1(sy)}" rx="${f1(rx + 16)}" ry="${f1(ry + 15)}" fill="none" stroke="#F2B705" stroke-width="9"/>`;
  s += `<ellipse cx="${f1(sx)}" cy="${f1(sy)}" rx="${f1(rx + 16)}" ry="${f1(ry + 15)}" fill="none" stroke="#2A2E34" stroke-width="10" stroke-dasharray="1.6 17"/>`;
  [[-0.55, -0.55, 18], [0.4, -0.62, -12], [0.66, 0.28, 30], [-0.3, 0.58, -24]].forEach(([dx, dy, a]) => {
    const px = sx + dx * rx, py = sy + dy * ry;
    s += `<rect x="${f1(px - 8)}" y="${f1(py - 8)}" width="16" height="16" rx="1.5" fill="#EEF0F1" stroke="#B9C0C5" transform="rotate(${a} ${f1(px)} ${f1(py)})"/>`;
  });
  for (let i = 0; i < 5; i++) {
    const yy = sy - 130 + i * 65;
    s += `<circle cx="${f1(cx + 47)}" cy="${f1(yy)}" r="7" fill="#FF6A13"/><circle cx="${f1(cx + 47)}" cy="${f1(yy)}" r="3.6" fill="#fff"/><circle cx="${f1(cx + 47)}" cy="${f1(yy)}" r="1.8" fill="#FF6A13"/>`;
  }
  return s + '</g>';
}

// ---------- measuring the page ----------
function measure(anchorRatio) {
  const jr = journey.getBoundingClientRect();
  const jTop = jr.top + scrollY, vh = innerHeight;
  const anchor = Math.round(vh * anchorRatio);
  const maxScroll = Math.max(1, D.documentElement.scrollHeight - vh);
  const rel = (r) => ({ top: r.top - jr.top, bot: r.bottom - jr.top });
  const stages = [...journey.querySelectorAll('.stage')].map((el) => {
    const lane = el.querySelector('.lane').getBoundingClientRect();
    const copy = rel(el.querySelector('.copy').getBoundingClientRect());
    const box = rel(el.getBoundingClientRect());
    return { el, key: el.dataset.stage, cx: lane.left - jr.left + lane.width / 2, laneW: lane.width, top: box.top, bot: box.bot, cTop: copy.top, cBot: copy.bot };
  });
  const by = Object.fromEntries(stages.map((s) => [s.key, s]));
  const tr = rel(D.getElementById('towing').getBoundingClientRect());
  const rr = rel(D.getElementById('roadside').getBoundingClientRect());
  return { jTop, vh, anchor, maxScroll, W: journey.clientWidth, H: journey.offsetHeight, stages, by, towing: tr, roadside: rr,
    y0: anchor - jTop, yEnd: maxScroll + anchor - jTop };
}

// ---------- the road ----------
function buildRoad(M) {
  const S = M.stages, segs = [];
  let x = S[0].cx, y = M.y0 - 170;
  const gateA = M.y0 + 40, gateB = M.yEnd - 150;
  const p1 = M.by.freight.cTop + 70, p2 = M.by.release.cTop + 70;
  const marks = [gateA, p1, p2, gateB].sort((a, b) => a - b);
  const line = (y2) => { if (y2 > y + 0.5) { segs.push({ x1: x, y1: y, x2: x, y2, c: null }); y = y2; } };
  const lineTo = (y2) => { for (const m of marks) if (m > y && m < y2) line(m); line(y2); };
  const curve = (x2, y2) => { const m = (y + y2) / 2; segs.push({ x1: x, y1: y, x2, y2, c: [x, m, x2, m] }); x = x2; y = y2; };
  for (let i = 0; i < S.length; i++) {
    const s = S[i], n = S[i + 1];
    if (!n) { lineTo(M.yEnd + 2); break; }
    if (Math.abs(n.cx - x) < 2) continue;
    lineTo(s.cBot + 34);
    curve(n.cx, n.cTop - 34);
  }
  const kind = (sg) => { const m = (sg.y1 + sg.y2) / 2; return m < gateA || m > gateB ? 'yard' : (m > p1 && m < p2 ? 'free' : 'city'); };
  const toD = (list) => {
    let d = '', ex = null, ey = null;
    for (const sg of list) {
      if (ex === null || Math.abs(ex - sg.x1) > 0.5 || Math.abs(ey - sg.y1) > 0.5) d += `M${f1(sg.x1)} ${f1(sg.y1)}`;
      d += sg.c ? `C${sg.c.map(f1).join(' ')} ${f1(sg.x2)} ${f1(sg.y2)}` : `L${f1(sg.x2)} ${f1(sg.y2)}`;
      ex = sg.x2; ey = sg.y2;
    }
    return d;
  };
  return { all: toD(segs), city: toD(segs.filter((s) => kind(s) === 'city')), free: toD(segs.filter((s) => kind(s) === 'free')),
    trail: toD(segs.filter((s) => kind(s) !== 'yard')), p1, p2, gateA, gateB };
}

// Path samples every ~2px via MotionPathPlugin, plus a height lookup (y only ever grows along the road).
function samplePath(d) {
  const MP = W.MotionPathPlugin;
  const raw = MP.stringToRawPath(d);
  MP.cacheRawPathMeasurements(raw, 24);
  const total = raw.totalLength, N = Math.max(2, Math.ceil(total / 2)), step = total / N;
  const X = new Float32Array(N + 1), Y = new Float32Array(N + 1), A = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const p = MP.getPositionOnPath(raw, i / N, true);
    X[i] = p.x; Y[i] = p.y; A[i] = (p.angle || 0) / DEG;
  }
  for (let i = 1; i <= N; i++) if (Y[i] < Y[i - 1]) Y[i] = Y[i - 1];
  const fiAtY = (y) => {
    if (y <= Y[0]) return 0;
    if (y >= Y[N]) return N;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Y[m] <= y) lo = m; else hi = m; }
    const dy = Y[hi] - Y[lo];
    return lo + (dy > 0 ? (y - Y[lo]) / dy : 0);
  };
  const at = (fi) => {
    fi = clamp(fi, 0, N);
    const i = Math.min(N - 1, Math.floor(fi)), t = fi - i;
    const a = lerpAng(A[i], A[i + 1], t);
    const x = lerp(X[i], X[i + 1], t), y = lerp(Y[i], Y[i + 1], t);
    return { x: x - Math.sin(a) * OFF, y: y + Math.cos(a) * OFF, cx: x, cy: y, a };
  };
  return { N, step, total, fiAtY, at };
}

// Scroll position → how far the truck lags behind the anchor line. Precomputed per scroll pixel.
function buildSchedule(M, stops) {
  const n = Math.ceil(M.maxScroll) + 2, lag = new Float32Array(n);
  for (const st of stops) {
    const { a, H } = st, L = DECEL + H, A = (2 * L) / CATCH;
    for (let s = Math.max(0, Math.floor(a)); s < n; s++) {
      const u = s - a; let v;
      if (u < 0) continue;
      if (u < DECEL) { const t = u / DECEL; v = DECEL * (t / 2 - Math.sin(Math.PI * t) / (2 * Math.PI)); }
      else if (u < DECEL + H) v = DECEL / 2 + (u - DECEL);
      else if (u < 2 * DECEL + H) { const t = (u - DECEL - H) / DECEL; v = DECEL / 2 + H + DECEL * (t / 2 + Math.sin(Math.PI * t) / (2 * Math.PI)); }
      else if (u < 2 * DECEL + H + CATCH) { const t = (u - 2 * DECEL - H) / CATCH; v = L - CATCH * A * (t / 2 - Math.sin(2 * Math.PI * t) / (4 * Math.PI)); }
      else break;
      lag[s] += v;
    }
  }
  return (s) => { const i = Math.floor(clamp(s, 0, n - 2)), t = s - i; return lerp(lag[i], lag[i + 1], clamp(t)); };
}

// ---------- desktop ----------
function desktop(gsap, ST) {
  const layers = {};
  let M, R, P, lagAt, scene = {}, L0, L1, box, lenis, last = { dir: 0 };
  const roadHost = D.createElement('div'); roadHost.className = 'road-layer';
  const trailOuter = D.createElement('div'); trailOuter.className = 'trail-outer';
  const trailInner = D.createElement('div'); trailInner.className = 'trail-inner'; trailOuter.appendChild(trailInner);
  const actorHost = D.createElement('div'); actorHost.className = 'actor-layer';
  const overHost = D.createElement('div'); overHost.className = 'over-layer';
  journey.prepend(roadHost, trailOuter, actorHost, overHost);
  if (!REDUCE) {
    L0 = makeLayer(); L1 = makeLayer(); L1.el.hidden = true;
    journey.append(L0.el, L1.el);
    box = D.createElement('div'); box.className = 'part'; box.innerHTML = BOXTRUCK; actorHost.appendChild(box);
  }

  function build() {
    M = measure(ANCHOR);
    R = buildRoad(M);
    P = samplePath(R.all);
    const k = clamp(Math.min(M.by.heavy.laneW, M.by.tow.laneW) / 520, 0.72, 1);
    const half = (st) => Math.min(250, st.laneW / 2 + 20);
    const T = M.by.tow, Hv = M.by.heavy, F = M.by.freight, Sa = M.by.area, Rl = M.by.release;

    // Stops: where the truck's front comes to rest.
    const hold = clamp(M.anchor - 300 - DECEL, 60, 260);
    const stop1 = M.towing.top + (M.towing.bot - M.towing.top) * 0.6;
    const stop2 = Hv.cTop + (Hv.cBot - Hv.cTop) * 0.55;
    const stops = [stop1, stop2].map((y) => ({ y, H: hold, a: y - M.y0 - DECEL / 2 }));
    lagAt = buildSchedule(M, stops);
    const f1p = P.at(P.fiAtY(stop1)), f2p = P.at(P.fiAtY(stop2));
    scene = {
      stops, hold,
      fiP: [P.fiAtY(R.p1), P.fiAtY(R.p2)], pY: [R.p1, R.p2],
      car: { x: f1p.x - 64 * k, y: stop1 - 128, a: Math.PI / 2 - 0.12 },
      boxA: { x: f2p.x - 150 * k, y: stop2 - 64, a: Math.PI / 2 + 0.68 },
      boxB: { x: f2p.x - 50, y: stop2 - 70, a: Math.PI / 2 + 0.03 },
    };

    // Road layer
    const sz = `width="${M.W}" height="${M.H}" viewBox="0 0 ${M.W} ${M.H}"`;
    const s0 = M.stages[0], sEnd = M.stages[M.stages.length - 1];
    let svg = `<svg ${sz} aria-hidden="true" focusable="false"><defs><linearGradient id="rt-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>`;
    svg += yard(s0.cx, M.y0, 'bottom', k);
    svg += yard(sEnd.cx, M.yEnd, 'top', k);
    // ditch + skid marks for the winch out
    const bA = scene.boxA;
    svg += `<ellipse cx="${f1(bA.x)}" cy="${f1(bA.y)}" rx="58" ry="92" transform="rotate(${f1(bA.a * DEG - 90)} ${f1(bA.x)} ${f1(bA.y)})" fill="#1C1A15" stroke="#2B271F" stroke-width="3"/>`;
    svg += `<path d="M${f1(f2p.cx - 24)} ${f1(stop2 - 300)}C${f1(f2p.cx - 30)} ${f1(stop2 - 210)} ${f1(bA.x + 30)} ${f1(bA.y - 150)} ${f1(bA.x + 12)} ${f1(bA.y - 50)}M${f1(f2p.cx - 2)} ${f1(stop2 - 300)}C${f1(f2p.cx - 8)} ${f1(stop2 - 200)} ${f1(bA.x + 56)} ${f1(bA.y - 140)} ${f1(bA.x + 38)} ${f1(bA.y - 40)}" fill="none" stroke="#08090A" stroke-width="5" stroke-opacity=".55" stroke-linecap="round"/>`;
    // side streets: short, fading stubs so the city stretches read like a map, never under the copy
    svg += `<defs><linearGradient id="rt-st-r"><stop offset="0" stop-color="#2A2E34"/><stop offset="1" stop-color="#2A2E34" stop-opacity="0"/></linearGradient><linearGradient id="rt-st-l" x1="1" x2="0"><stop offset="0" stop-color="#2A2E34"/><stop offset="1" stop-color="#2A2E34" stop-opacity="0"/></linearGradient></defs>`;
    const busy = [stop1 - 128, stop2 - 40];
    for (const st of M.stages) {
      if (!['tow', 'heavy', 'release', 'facility', 'contact'].includes(st.key)) continue;
      const inner = st.el.dataset.road === 'right' ? -1 : 1;
      const yA = Math.max(st.cTop + 60, R.gateA + 120), yB = Math.min(st.cBot - 40, R.gateB - 80);
      for (let yy = yA, i = 0; yy < yB; yy += 300, i++) {
        if (st.key === 'release' && yy < R.p2 + 140) continue;
        if (busy.some((b) => Math.abs(yy - b) < 240)) continue;
        for (const side of [inner, -inner]) {
          if (st.key === 'tow' && side === -inner && yy > M.roadside.top - 60) continue;
          const len = side === inner ? Math.min(150, st.laneW / 2 - 70) : Math.min(190, st.laneW / 2 - 30);
          const x = side > 0 ? st.cx + 30 : st.cx - 30 - len;
          svg += `<rect x="${f1(x)}" y="${f1(yy - 19)}" width="${f1(len)}" height="38" fill="url(#rt-st-${side > 0 ? 'r' : 'l'})"/>`;
        }
      }
    }
    // roads
    svg += `<path d="${R.city}" fill="none" stroke="#C9C4B8" stroke-width="78"/><path d="${R.city}" fill="none" stroke="#2A2E34" stroke-width="72"/><path d="${R.city}" fill="none" stroke="#ECE7DB" stroke-opacity=".72" stroke-width="2.5" stroke-dasharray="16 20"/>`;
    svg += `<path d="${R.free}" fill="none" stroke="#C9C4B8" stroke-width="122"/><path d="${R.free}" fill="none" stroke="#2A2E34" stroke-width="116"/>`;
    svg += `<path d="${R.free}" fill="none" stroke="#ECE7DB" stroke-opacity=".75" stroke-width="76" stroke-dasharray="22 26"/><path d="${R.free}" fill="none" stroke="#2A2E34" stroke-width="72"/>`;
    svg += `<path d="${R.free}" fill="none" stroke="#E8C14A" stroke-width="9"/><path d="${R.free}" fill="none" stroke="#2A2E34" stroke-width="5"/>`;
    // hazard triangle behind the stranded car
    const c = scene.car;
    svg += `<path d="M${f1(c.x)} ${f1(c.y - 118)}l9 15h-18z" fill="none" stroke="#E0362C" stroke-width="3" stroke-linejoin="round"/>`;
    // contained spill on the far shoulder of the spill response stretch
    const Sp = M.by.spill;
    if (Sp) svg += spillScene(Sp.cx, Sp.cTop + (Sp.cBot - Sp.cTop) * 0.42, k);
    // street sign at the yard gate
    svg += greenSign(s0.cx + 92, M.y0 + 64, 116, 26, ['TELEGRAPH RD'], 15);
    // roadside signs on the outer shoulder
    const icons = ['i-key', 'i-bolt', 'i-tire', 'i-fuel', 'i-battery'];
    const rTop = M.roadside.top + 20, rBot = Math.max(rTop + 200, M.roadside.bot - 10);
    icons.forEach((ic, i) => { svg += iconSign(T.cx + 70, lerp(rTop, rBot, i / (icons.length - 1)), ic); });
    // freeway shields and the freight lanes sign
    const outF = F.cx + 98;
    svg += shieldI(outF, R.p1 + 150, '696') + shieldM(outF, R.p1 + 215, '10') + shieldI(outF, R.p1 + 280, '75');
    svg += greenSign(F.cx + 116, R.p1 + 420, 132, 64, ['MI / OH / IN', '↓'], 22, 'LANES');
    // exit signs for each city in the service area
    const cities = ['Southfield', 'Detroit', 'Farmington Hills', 'Dearborn', 'Oak Park', 'Lathrup Village', 'Royal Oak'];
    const aTop = Sa.cTop + 30, aBot = Sa.cBot - 40;
    cities.forEach((name, i) => { svg += greenSign(Sa.cx - 80 - 70 * k, lerp(aTop, aBot, i / (cities.length - 1)), 140 * k, 36, [name], name.length > 12 ? 15 : 17, 'EXIT'); });
    svg += '</svg>';
    roadHost.innerHTML = svg;

    // Trail: the lane markings behind the truck turn red. Revealed with a compositor-only clip.
    // clip-path insets are measured against the layer box, so the truck layers span the journey
    for (const L of [L0, L1]) if (L) { L.el.style.width = M.W + 'px'; L.el.style.height = M.H + 'px'; }
    trailOuter.hidden = REDUCE;
    trailOuter.style.width = trailInner.style.width = M.W + 'px';
    trailOuter.style.height = trailInner.style.height = M.H + 'px';
    trailInner.innerHTML = `<svg ${sz} aria-hidden="true" focusable="false"><path d="${R.trail}" fill="none" stroke="#E3262B" stroke-opacity=".22" stroke-width="10"/><path d="${R.trail}" fill="none" stroke="#E3262B" stroke-width="3.5"/></svg>`;

    // Over layer: the two overpasses (the truck changes underneath them)
    const hw1 = half(F), hw2 = half(Rl);
    overHost.innerHTML = `<svg ${sz} aria-hidden="true" focusable="false"><defs><linearGradient id="rt-shade2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>${fadeMask('rt-m1', F.cx, R.p1, hw1)}${fadeMask('rt-m2', Rl.cx, R.p2, hw2)}</defs>
      ${overpass(F.cx, R.p1, hw1, 'rt-m1', { text: 'I-696 · FREIGHT', w: 128 }).replaceAll('rt-shade', 'rt-shade2')}
      ${overpass(Rl.cx, R.p2, hw2, 'rt-m2', { text: 'EXIT · TELEGRAPH RD', w: 150 }).replaceAll('rt-shade', 'rt-shade2')}</svg>`;

    if (REDUCE) snapshots(); else frame(true);
    ST.refresh();
  }

  // Positions one truck layer for state st with its front at path index fi.
  function drive(L, st, fi, prog) {
    const F = P.at(fi), Rr = P.at(fi - 60 / P.step);
    const au = Math.atan2(F.y - Rr.y, F.x - Rr.x);
    setT(L.unit, F.x, F.y, au);
    if (st === 2) return;
    const hx = HITCH[st], Hx = F.x + Math.cos(au) * hx, Hy = F.y + Math.sin(au) * hx;
    const T = P.at(fi + (hx - TOW_LEN[st]) / P.step);
    const at = Math.atan2(Hy - T.y, Hx - T.x);
    if (st === 1) { setT(L.trailer, Hx, Hy, at); return; }
    // state 0: the car waits on the shoulder until the hook-up, then rides behind
    const c = scene.car, p = ease(clamp(prog.p1));
    if (p <= 0) setT(L.car, c.x, c.y, c.a);
    else setT(L.car, lerp(c.x, Hx, p), lerp(c.y, Hy, p), lerpAng(c.a, at, p));
    L.car.classList.toggle('hazards', prog.p1 < 0.98);
    winch(L, F, au, prog.p2);
  }

  // The winch out: boom swings out, line shoots out, box truck comes back onto the shoulder.
  function winch(L, F, au, q) {
    const A = scene.boxA, B = scene.boxB;
    const k = ease(clamp((q - 0.4) / 0.45));
    const bx = lerp(A.x, B.x, k), by = lerp(A.y, B.y, k), ba = lerpAng(A.a, B.a, k);
    if (box) setT(box, bx, by, ba);
    const pvx = F.x + Math.cos(au) * -62, pvy = F.y + Math.sin(au) * -62;
    const atx = bx + Math.cos(ba) * -60, aty = by + Math.sin(ba) * -60;
    let rot = Math.atan2(aty - pvy, atx - pvx) - au - Math.PI;
    while (rot > Math.PI) rot -= 2 * Math.PI; while (rot < -Math.PI) rot += 2 * Math.PI;
    const swing = q < 0.2 ? ease(clamp(q / 0.2)) : q < 0.86 ? 1 : 1 - ease(clamp((q - 0.86) / 0.12));
    const cur = rot * swing;
    setBoom(L, cur);
    const ta = au + Math.PI + cur, tx = pvx + Math.cos(ta) * 58, ty = pvy + Math.sin(ta) * 58;
    const ext = clamp((q - 0.2) / 0.18) * (1 - clamp((q - 0.85) / 0.06));
    if (ext <= 0.001) { L.winch.hidden = true; return; }
    L.winch.hidden = false;
    const len = Math.hypot(atx - tx, aty - ty) * ext;
    L.winch.style.transform = `translate3d(${f1(tx)}px,${f1(ty)}px,0) rotate(${f1(Math.atan2(aty - ty, atx - tx) * DEG)}deg) scaleX(${f1(len)})`;
  }

  function progressAt(s) {
    const [a, b] = scene.stops;
    return {
      p1: (s - (a.a + DECEL * 0.6)) / (a.H + DECEL * 0.7),
      p2: (s - (b.a + DECEL * 0.45)) / (b.H + DECEL * 1.1),
    };
  }

  function frame(force) {
    const s = lenis ? lenis.scroll : scrollY;
    if (!force && s === last.s) return;
    last.s = s;
    const y = s + M.anchor - M.jTop - lagAt(s);
    const fi = P.fiAtY(y);
    const prog = progressAt(s);
    const back = RIG_LEN / P.step;
    let span = -1;
    for (let j = 0; j < 2; j++) if (fi >= scene.fiP[j] && fi - back < scene.fiP[j]) span = j;
    const region = fi >= scene.fiP[1] ? 2 : fi >= scene.fiP[0] ? 1 : 0;
    if (span >= 0) {
      const Y = scene.pY[span];
      setState(L0, span); setState(L1, span + 1);
      setClip(L0, `inset(0 0 ${f1(M.H - Y)}px 0)`); setClip(L1, `inset(${f1(Y)}px 0 0 0)`);
      L1.el.hidden = false;
      drive(L0, span, fi, prog); drive(L1, span + 1, fi, prog);
    } else {
      setState(L0, region); setClip(L0, 'none');
      if (!L1.el.hidden) L1.el.hidden = true;
      drive(L0, region, fi, prog);
    }
    if (region !== 0 && box) setT(box, scene.boxB.x, scene.boxB.y, scene.boxB.a);
    // lights, brakes, reverse
    const on = s > 24 && y < M.yEnd - 50;
    const braking = scene.stops.some((st) => s > st.a && s < st.a + DECEL + st.H);
    const v = lenis ? lenis.velocity : 0;
    if (v < -0.4) last.dir = -1; else if (v > 0.4) last.dir = 1; else if (Math.abs(v) < 0.05) last.dir = 0;
    for (const L of [L0, L1]) {
      L.el.classList.toggle('lights', on);
      L.el.classList.toggle('parked', y > M.yEnd - 40);
      L.el.classList.toggle('braking', braking);
      L.el.classList.toggle('reversing', last.dir === -1);
    }
    trailOuter.style.transform = `translate3d(0,${f1(y - M.H)}px,0)`;
    trailInner.style.transform = `translate3d(0,${f1(M.H - y)}px,0)`;
    W.__ross = { s, y, fi, region, span, prog };
  }

  // Reduced motion: still trucks in each stage, no animation.
  function snapshots() {
    D.querySelectorAll('.truck-layer.snap').forEach((n) => n.remove());
    const place = (y, st, prog) => {
      const L = makeLayer('snap static'); journey.appendChild(L.el); setState(L, st);
      drive(L, st, P.fiAtY(y), prog); L.el.classList.toggle('lights', st !== 2 || y < M.yEnd - 50);
      if (st !== 0) L.car.hidden = true;
      return L;
    };
    place(M.y0, 0, { p1: -1, p2: -1 }).el.classList.remove('lights');
    // the car waiting on the shoulder lives in the first snapshot's layer; show it as hooked in the towing one instead
    D.querySelector('.truck-layer.snap .tow-car').hidden = true;
    place(scene.stops[0].y, 0, { p1: 1, p2: -1 });
    const L = place(scene.stops[1].y, 0, { p1: 1, p2: 0.39 });
    const bx = D.createElement('div'); bx.className = 'part'; bx.innerHTML = BOXTRUCK; actorHost.appendChild(bx);
    setT(bx, scene.boxA.x, scene.boxA.y, scene.boxA.a);
    L.car.classList.remove('hazards');
    place(scene.pY[0] + 360, 1, {});
    place(M.by.area.cTop + (M.by.area.cBot - M.by.area.cTop) * 0.5, 1, {});
    place(M.yEnd, 2, {}).el.classList.remove('lights');
  }

  build();
  if (!REDUCE) {
    lenis = new W.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ST.update);
    W.__lenis = lenis;
    gsap.ticker.add((t) => { lenis.raf(t * 1000); frame(); });
    gsap.ticker.lagSmoothing(0);
    D.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1), target = id ? D.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(id === 'top' ? 0 : target, { offset: -86, duration: 1.4, onComplete: () => focusTarget(target) });
      history.replaceState(null, '', '#' + id);
    });
  }
  let t;
  const rebuild = () => { clearTimeout(t); t = setTimeout(build, 160); };
  addEventListener('resize', rebuild);
  new ResizeObserver(rebuild).observe(journey);
  D.fonts && D.fonts.ready.then(rebuild);
}

function focusTarget(el) {
  const h = el.matches('h1,h2,h3,form,input') ? el : el.querySelector('h1,h2,h3') || el;
  if (!h.hasAttribute('tabindex') && !h.matches('input,button,a')) h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
}

// ---------- mobile / touch ----------
function mobile(gsap) {
  const lane = D.createElement('div'); lane.className = 'lane-m'; lane.setAttribute('aria-hidden', 'true');
  journey.prepend(lane);
  const hold = D.createElement('div'); hold.className = 'truck-fixed'; hold.setAttribute('aria-hidden', 'true');
  const L = makeLayer('');
  L.el.style.position = 'absolute';
  hold.appendChild(L.el);
  if (!REDUCE) D.body.appendChild(hold);
  const S = 0.5;
  setT(L.unit, 0, 0, 0); setT(L.car, -124, 0, 0); setT(L.trailer, -60, 0, 0);
  let M, marks;
  function build() {
    const jr = journey.getBoundingClientRect(), jTop = jr.top + scrollY, vh = innerHeight;
    const anchor = Math.round(vh * ANCHOR_M), maxScroll = Math.max(1, D.documentElement.scrollHeight - vh);
    const rel = (el) => { const r = el.getBoundingClientRect(); return { top: r.top - jr.top, bot: r.bottom - jr.top }; };
    M = { jTop, anchor, y0: anchor - jTop, yEnd: maxScroll + anchor - jTop };
    const tow = rel(D.getElementById('towing')), heavy = rel(D.getElementById('heavy').querySelector('.copy'));
    marks = {
      car: tow.top + (tow.bot - tow.top) * 0.5,
      boomA: heavy.top + (heavy.bot - heavy.top) * 0.35, boomB: heavy.top + (heavy.bot - heavy.top) * 0.75,
      p1: rel(D.getElementById('freight')).top + 24, p2: rel(D.getElementById('release')).top + 24,
    };
    lane.style.top = (M.y0 - 60) + 'px';
    lane.style.height = (M.yEnd - M.y0 + 80) + 'px';
    const b = (y) => `<span class="bridge" style="top:${f1(y - (M.y0 - 60) - 11)}px"></span>`;
    lane.innerHTML = `<span class="yard" style="top:4px"></span>${b(marks.p1)}${b(marks.p2)}<span class="yard" style="top:${f1(M.yEnd - M.y0 + 30)}px"></span>`;
    hold.style.transform = `translate3d(0,${anchor}px,0) rotate(90deg) scale(${S})`;
    if (REDUCE) snaps(); else update(true);
    W.ScrollTrigger && W.ScrollTrigger.refresh();
  }
  let state = -1, hooked = null, boomOut = null;
  const boom = { r: 0 };
  function update() {
    const y = scrollY + M.anchor - M.jTop;
    const st = y >= marks.p2 ? 2 : y >= marks.p1 ? 1 : 0;
    if (st !== state) {
      setState(L, st);
      if (state !== -1) gsap.fromTo(L.el, { scale: 0.82 }, { scale: 1, duration: 0.35, ease: 'back.out(2.4)' });
      state = st;
    }
    const h = y >= marks.car;
    if (h !== hooked && st === 0) {
      hooked = h;
      gsap.to(L.car, { opacity: h ? 1 : 0, duration: 0.3 });
    }
    const out = st === 0 && y > marks.boomA && y < marks.boomB;
    if (out !== boomOut) {
      boomOut = out;
      gsap.to(boom, { r: out ? -1.75 : 0, duration: 0.6, ease: 'power2.inOut', onUpdate: () => setBoom(L, boom.r) });
    }
    L.el.classList.toggle('lights', scrollY > 24 && y < M.yEnd - 30);
  }
  function snaps() {
    D.querySelectorAll('.lane-m .snap').forEach((n) => n.remove());
    const put = (y, st, car) => {
      const s = makeLayer('snap static'); setState(s, st);
      s.el.style.cssText = `position:absolute;left:15px;top:${f1(y - (M.y0 - 60))}px;transform:rotate(90deg) scale(${S});transform-origin:0 0`;
      setT(s.unit, 0, 0, 0); setT(s.car, -124, 0, 0); setT(s.trailer, -60, 0, 0);
      if (!car) s.car.hidden = true;
      lane.appendChild(s.el);
    };
    put(M.y0, 0, false); put(marks.car + 120, 0, true); put(marks.p1 + 320, 1); put(M.yEnd, 2);
  }
  L.car.style.opacity = '0';
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  let t;
  const rebuild = () => { clearTimeout(t); t = setTimeout(build, 160); };
  addEventListener('resize', rebuild);
  new ResizeObserver(rebuild).observe(journey);
  build();
  D.fonts && D.fonts.ready.then(rebuild);
}

// ---------- content motion (both modes) ----------
function content(gsap, ST) {
  // Nav: mark the section you're in
  D.querySelectorAll('.nav a[href^="#"]').forEach((a) => {
    const target = D.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    ST.create({ trigger: target, start: 'top 45%', end: 'bottom 45%', onToggle: (self) => self.isActive ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current') });
  });
  if (REDUCE) return;
  const below = (el) => el.getBoundingClientRect().top > innerHeight;
  const rev = [...D.querySelectorAll('.reveal')].filter(below);
  gsap.set(rev, { opacity: 0, y: 22 });
  ST.batch(rev, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power2.out', overwrite: true }) });
  // 4.7 and the facility numbers count up the first time you see them
  D.querySelectorAll('[data-count]').forEach((el) => {
    if (!below(el)) return;
    const to = parseFloat(el.dataset.count), dec = el.dataset.dec ? +el.dataset.dec : 1, o = { v: 0 };
    const fmt = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US'));
    ST.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.2, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); } }) });
  });
  // Placeholders get a stamp, so they read as "fill me in", not as facts
  D.querySelectorAll('.ph-stamp').forEach((el) => {
    el.style.display = 'inline-block';
    if (!below(el)) { gsap.fromTo(el, { scale: 1.3, rotate: -5 }, { scale: 1, rotate: 0, duration: 0.6, delay: 0.5, ease: 'back.out(3)' }); return; }
    ST.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.fromTo(el, { scale: 1.3, rotate: -5 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)' }) });
  });
}

// ---------- boot ----------
const loadScript = (src) => new Promise((res, rej) => { const s = D.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; D.head.appendChild(s); });
(async function boot() {
  const gsap = W.gsap, ST = W.ScrollTrigger;
  if (!gsap || !ST || !journey) return;           // no motion libs: the page still reads fine
  gsap.registerPlugin(ST);
  try {
    if (DESK) {
      await Promise.all([loadScript('vendor/MotionPathPlugin.min.js'), REDUCE ? null : loadScript('vendor/lenis.min.js')]);
      gsap.registerPlugin(W.MotionPathPlugin);
      desktop(gsap, ST);
    } else {
      mobile(gsap);
    }
  } catch (e) { console.warn('[ross] journey disabled', e); }
  content(gsap, ST);
})();
