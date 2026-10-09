// Renders a resolved site object (see build-preview.mjs) into static HTML pages.
// Pure functions, no I/O. Every string from JSON is HTML-escaped unless the field name ends in "Html".

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = isObj(a[k]) && isObj(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

// {{name}}, {{city}}, {{years}}... inside any copy string
const fill = (s, vars) => String(s ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (vars[k] ?? ''));

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0;
  const n = parseInt(m[1], 16), f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255);
}

const FONT_WEIGHTS = {
  'Bricolage Grotesque': 'wght@500;700;800', 'Inter': 'wght@400;500;600;700', 'Barlow Condensed': 'wght@600;700;800',
  'Barlow': 'wght@400;500;600;700', 'Plus Jakarta Sans': 'wght@500;700;800', 'Oswald': 'wght@500;600;700',
  'DM Sans': 'wght@400;500;600;700', 'Fraunces': 'wght@600;700;800', 'Archivo': 'wght@600;700;800;900',
  'Outfit': 'wght@500;700;800', 'Sora': 'wght@500;700;800', 'Manrope': 'wght@400;500;600;700;800',
};
export function fontsUrl(...names) {
  const fams = [...new Set(names.filter(Boolean))].map((n) => `family=${n.replace(/ /g, '+')}:${FONT_WEIGHTS[n] || 'wght@400;700'}`);
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`;
}

// Responsive image: Unsplash URLs get a real srcset; anything else is used as-is.
function img(src, alt, opts = {}) {
  if (!src) return '';
  const { w = 1600, sizes = '100vw', cls = '', loading = 'lazy', fetchpriority } = opts;
  let srcset = '';
  const m = /^https:\/\/images\.unsplash\.com\/(photo-[^?]+)/.exec(src);
  if (m) {
    const u = (width) => `https://images.unsplash.com/${m[1]}?auto=format&fit=crop&q=72&w=${width}`;
    srcset = ` srcset="${[480, 800, 1200, 1600, 2000].filter((x) => x <= Math.max(w, 480)).map((x) => `${u(x)} ${x}w`).join(', ')}" sizes="${sizes}"`;
    src = u(w);
  }
  return `<img src="${esc(src)}" alt="${esc(alt)}"${srcset}${cls ? ` class="${cls}"` : ''} loading="${loading}"${fetchpriority ? ` fetchpriority="${fetchpriority}"` : ''} decoding="async">`;
}

// Inline icon set. Add here, reference by name in JSON ("icon": "brake").
const P = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  phone: P('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  pin: P('<path d="M12 22s7-7.1 7-12a7 7 0 1 0-14 0c0 4.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: P('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
  check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  mail: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  chat: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
  shield: P('<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  award: P('<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 22l5-2.5 5 2.5-1.5-8.5"/>'),
  calendar: P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  wrench: P('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 10l-3.5-3.5L21 3l-1.3 1.3a4 4 0 0 0-5 2z"/><path d="M13 11L4 20l-1-1 9-9"/>'),
  engine: P('<path d="M4 10h3l2-2h5l2 2h2v6h-2l-2 2H9l-2-2H4z"/><path d="M2 12v2M20 11h2v4h-2M11 8V5h2"/>'),
  brake: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>'),
  oil: P('<path d="M12 3c3 4.5 5 7.5 5 10a5 5 0 0 1-10 0c0-2.5 2-5.5 5-10z"/>'),
  tire: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>'),
  battery: P('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M19 10h2v4h-2M7 12h4M9 10v4"/>'),
  snow: P('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>'),
  flame: P('<path d="M12 22c4 0 7-2.8 7-6.5 0-3-2-5-3.5-7.5-.5 2-1.5 3-2.5 3.5C13 9 12 6 9.5 3 9 7 5 9 5 15.5 5 19.2 8 22 12 22z"/>'),
  gauge: P('<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1"/>'),
  car: P('<path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5h-2v-2H5v2H3z"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/>'),
  truck: P('<path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  spray: P('<path d="M7 9h8l1 12H6zM9 9V5h4v4M15 4h3M16 7h3M16 10h3"/>'),
  hammer: P('<path d="M14 5l5 5-2 2-5-5zM12 7l-9 9 2 2 9-9"/><path d="M15 4l3-1 2 2-1 3"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  ruler: P('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  box: P('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
  bolt: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  drop: P('<path d="M12 3c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12z"/>'),
  leaf: P('<path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z"/><path d="M4 20l9-9"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  home: P('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  file: P('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15a5 5 0 0 1 5.5 5"/>'),
  key: P('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 5l2 2M14 8l2 2"/>'),
  dollar: P('<path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"/>'),
  thumbs: P('<path d="M7 11v9H3v-9zM7 11l4-8a2 2 0 0 1 3 2v4h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 2H7"/>'),
  sparkle: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
  fan: P('<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 2-7 5-7 1.5 2 .5 5-3 7M14 12c4 0 7 2 7 5-2 1.5-5 .5-7-3M12 14c0 4-2 7-5 7-1.5-2-.5-5 3-7M10 12c-4 0-7-2-7-5 2-1.5 5-.5 7 3"/>'),
  thermo: P('<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/>'),
  hose: P('<path d="M4 6h8a4 4 0 0 1 4 4v1a3 3 0 0 0 3 3h1"/><path d="M4 4v4M19 12v4"/>'),
  tow: P('<path d="M2 16h3l2-5h6l3 5h6v3H2z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M13 11V7l5 1"/>'),
};
const icon = (name) => ICONS[name] || ICONS.wrench;
const G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 7.2-9.9 7.2-17.4z"/><path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.8-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>';

const stars = (rating, cls = '') => `<span class="stars ${cls}" style="--pct:${Math.round((Math.min(5, Math.max(0, +rating || 0)) / 5) * 1000) / 10}%" aria-label="${esc(rating)} out of 5 stars">★★★★★</span>`;
const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

// ---------- site resolution ----------
export function resolveSite(raw, presets) {
  const base = presets.base || {};
  const preset = presets[raw.preset] || {};
  const site = deepMerge(deepMerge(base, preset), raw);
  const b = site.business;
  const now = new Date();
  const years = b.established ? now.getFullYear() - b.established : null;
  site.vars = {
    name: b.name, city: b.address?.city || '', state: b.address?.state || '', street: b.address?.street || '',
    phone: b.phoneDisplay || b.phone || '', established: b.established || '', years: years || '',
    rating: b.rating ?? '', reviews: b.reviewCount ?? '', reviewCount: b.reviewCount ?? '', area: (b.serviceArea || [])[0] || b.address?.city || '',
    road: b.road || '',
  };
  site.years = years;
  site.base = site.base || `/preview/${site.slug}/`;
  site.phoneHref = b.phone ? 'tel:' + String(b.phone).replace(/[^\d+]/g, '').replace(/^(\d{10})$/, '+1$1') : '';
  const q = `${b.name}, ${[b.address?.street, b.address?.city, b.address?.state, b.address?.zip].filter(Boolean).join(', ')}`;
  site.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${enc(q)}${b.placeId ? `&query_place_id=${enc(b.placeId)}` : ''}`;
  site.mapEmbed = `https://maps.google.com/maps?q=${enc(q)}&output=embed`;
  site.addressLine = [b.address?.street, [b.address?.city, b.address?.state].filter(Boolean).join(', ') + (b.address?.zip ? ' ' + b.address.zip : '')].filter(Boolean).join(', ');
  site.brand.accentInk = site.brand.accentInk || (luminance(site.brand.accent) > 0.4 ? '#111318' : '#ffffff');
  if (!site.pages || !site.pages.length) site.pages = preset.pages || base.pages || [];
  const off = new Set(site.disablePages || []);
  site.pages = site.pages.filter((p) => !off.has(p.slug));
  const offS = new Set(site.disableSections || []);
  site.pages = site.pages.map((p) => ({ ...p, sections: (p.sections || []).filter((s) => !offS.has(s.type) && !offS.has(s.id)) }));
  const contact = site.pages.find((p) => p.slug === 'contact');
  site.bookHref = contact ? `${site.base}contact/#form` : '#contact';
  site.t = (s) => fill(s, site.vars);
  return site;
}

const pageUrl = (site, p) => site.base + (p.slug ? p.slug + '/' : '');

// ---------- shared chrome ----------
function head(site, page) {
  const b = site.business, br = site.brand;
  const title = page.slug ? `${site.t(page.title)} | ${b.name}` : `${b.name} | ${site.t(b.tagline || page.title)}`;
  const desc = site.t(page.description || b.description || b.tagline || '');
  const ld = {
    '@context': 'https://schema.org', '@type': site.schemaType || 'LocalBusiness', name: b.name, telephone: b.phone,
    url: `https://journeymanwebco.com${site.base}`, image: site.photos?.hero,
    address: { '@type': 'PostalAddress', streetAddress: b.address?.street, addressLocality: b.address?.city, addressRegion: b.address?.state, postalCode: b.address?.zip, addressCountry: 'US' },
    ...(b.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.reviewCount } } : {}),
    ...(b.established ? { foundingDate: String(b.established) } : {}),
  };
  const preloadHero = page.hero?.photo || (page.slug === '' ? site.photos?.hero : null);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="jwc-endpoint" content="${esc(site.agency.endpoint)}">
<meta name="theme-color" content="${esc(br.dark)}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="data:image/svg+xml,${enc(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${br.accent}'/><text x='32' y='42' font-family='Arial,sans-serif' font-weight='800' font-size='32' text-anchor='middle' fill='${br.accentInk}'>${esc(initials(b.name)[0])}</text></svg>`)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsUrl(br.fontHeading, br.fontBody))}">
<link rel="stylesheet" href="/preview/theme/site.css">
<style>:root{--accent:${br.accent};--accent-ink:${br.accentInk};--dark:${br.dark};--font-heading:"${br.fontHeading}",system-ui,sans-serif;--font-body:"${br.fontBody}",system-ui,sans-serif;}${br.css || ''}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function topbar(site) {
  const a = site.agency, c = site.concept || {};
  const note = c.currentSite
    ? `A redesign concept for ${esc(c.currentSite)}, secure and built for phones. Your current site stays up until you approve the new one.`
    : `Would go live on a web address of your own, set up and renewed for you.`;
  return `<div class="topbar"><div class="wrap">
 <div><b>Concept preview</b> built by ${esc(a.name)} for ${esc(site.business.name)}. Not the official site yet. <span class="tb-note">${c.noteHtml || note}</span></div>
 <a class="tb-cta" data-track="click_text" data-track-detail="preview topbar" href="${esc(a.smsHref)}">${ICONS.chat}Like it? Text ${esc(a.firstName)} ${esc(a.phoneDisplay)}</a>
</div></div>`;
}

function logo(site, forFooter) {
  const b = site.business, br = site.brand;
  const mark = br.logoImage ? img(br.logoImage, b.name, { cls: 'logo-img', loading: 'eager' })
    : `<span class="logo-mark">${br.logoIcon ? icon(br.logoIcon) : esc(initials(b.name))}</span>`;
  const text = br.logoText || b.name;
  return `<a class="logo" href="${esc(site.base)}" aria-label="${esc(b.name)} home">${mark}<span class="logo-text">${esc(text)}${br.logoSub ? `<small>${esc(site.t(br.logoSub))}</small>` : ''}</span></a>`;
}

function navLinks(site, page, cls = '') {
  return site.pages.filter((p) => p.nav !== false).map((p) =>
    `<a href="${esc(pageUrl(site, p))}"${p.slug === page.slug ? ' aria-current="page"' : ''}${cls}>${esc(site.t(p.nav || p.title))}</a>`).join('');
}

function header(site, page) {
  const L = site.labels;
  return `<header class="hdr"><div class="wrap hdr-inner">
 ${logo(site)}
 <nav class="nav" aria-label="Main">${navLinks(site, page)}</nav>
 <div class="hdr-cta">
  ${site.phoneHref ? `<a class="hdr-phone" data-track="preview_call" data-track-detail="header" href="${site.phoneHref}">${ICONS.phone}<span>${esc(site.vars.phone)}</span></a>` : ''}
  <a class="btn btn-accent btn-sm" data-track="preview_book" data-track-detail="header" href="${esc(site.bookHref)}">${esc(site.t(L.bookShort))}</a>
  <button class="burger" aria-label="Open menu" aria-expanded="false">${ICONS.menu}</button>
 </div>
</div></header>
<div class="drawer" role="dialog" aria-label="Menu"><div class="drawer-bg"></div><div class="drawer-panel">
 <div class="drawer-top">${logo(site)}<button class="drawer-close" aria-label="Close menu">${ICONS.x}</button></div>
 <nav class="drawer-nav">${navLinks(site, page)}</nav>
 <div class="drawer-foot">
  ${site.business.hours?.length ? `<div class="drawer-hours" data-open-status></div>` : ''}
  ${site.phoneHref ? `<a class="btn btn-accent" data-track="preview_call" data-track-detail="menu" href="${site.phoneHref}">${ICONS.phone}Call ${esc(site.vars.phone)}</a>` : ''}
  <a class="btn btn-line" data-track="preview_book" data-track-detail="menu" href="${esc(site.bookHref)}">${esc(site.t(L.book))}</a>
 </div>
</div></div>`;
}

function hoursTable(site) {
  const rows = site.business.hours || [];
  if (!rows.length) return '';
  return `<table class="hours">${rows.map((r) => `<tr data-days="${esc(r.days)}"><td>${esc(r.days)}</td><td>${r.closed ? 'Closed' : `${esc(r.open)} – ${esc(r.close)}`}</td></tr>`).join('')}</table>`;
}

function demoNote(site) {
  const list = site.concept?.demoNote;
  if (!list?.length) return '';
  return `<aside class="demo-note"><div class="wrap"><b>Demo version, for preview only.</b> ${esc(site.concept.demoIntro || 'This is a first look, not the finished site.')} On the final approved version we fill these in with ${esc(site.business.name)}'s real details: ${list.map(esc).join('; ')}.</div></aside>`;
}

function footer(site, page) {
  const b = site.business, a = site.agency, L = site.labels;
  return `<footer class="ft"><div class="wrap">
 <div class="ft-grid">
  <div>${logo(site, true)}<p>${esc(site.t(b.footerBlurb || b.tagline || ''))}</p>
   ${b.rating ? `<p style="margin-top:12px;display:flex;align-items:center;gap:8px">${stars(b.rating)}<span>${esc(b.rating)} · ${esc(b.reviewCount)} Google reviews</span></p>` : ''}</div>
  <div><h4>Pages</h4><ul>${site.pages.filter((p) => p.nav !== false).map((p) => `<li><a href="${esc(pageUrl(site, p))}">${esc(site.t(p.nav || p.title))}</a></li>`).join('')}</ul></div>
  <div><h4>Contact</h4><ul>
   ${site.phoneHref ? `<li><a data-track="preview_call" data-track-detail="footer" href="${site.phoneHref}">${esc(site.vars.phone)}</a></li>` : ''}
   ${b.email ? `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>` : ''}
   <li><a data-track="preview_directions" data-track-detail="footer" href="${esc(site.mapsUrl)}" target="_blank" rel="noopener">${esc(site.addressLine)}</a></li>
  </ul></div>
  <div><h4>${esc(L.hours)}</h4>${hoursTable(site) || `<p>${esc(site.t(L.hoursFallback))}</p>`}</div>
 </div>
 <div class="ft-bottom">
  <div>© ${new Date().getFullYear()} ${esc(b.legalName || b.name)}. All rights reserved.</div>
  <div>Concept preview by <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>, ${esc(a.location)} · <a data-track="click_email" data-track-detail="footer" href="mailto:${esc(a.email)}">${esc(a.email)}</a> · <a data-track="click_call" data-track-detail="footer" href="${esc(a.telHref)}">${esc(a.phoneDisplay)}</a></div>
 </div>
</div></footer>
<div class="callbar">
 ${site.phoneHref ? `<a class="btn btn-accent" data-track="preview_call" data-track-detail="call bar" href="${site.phoneHref}">${ICONS.phone}Call now</a>` : ''}
 <a class="btn btn-line" data-track="preview_book" data-track-detail="call bar" href="${esc(site.bookHref)}">${esc(site.t(L.bookShort))}</a>
 <a class="btn btn-line" data-track="preview_directions" data-track-detail="call bar" href="${esc(site.mapsUrl)}" target="_blank" rel="noopener">Directions</a>
</div>
<a class="jwc-pill" data-track="click_text" data-track-detail="preview pill" href="${esc(a.smsHref)}"><span class="jm">J</span><span>Want this live?<small>Text ${esc(a.firstName)} · ${esc(a.phoneDisplay)}</small></span></a>`;
}

// ---------- sections ----------
const secHead = (site, s, defaults = {}, center = false) => {
  const eyebrow = s.eyebrow ?? defaults.eyebrow, heading = s.heading ?? defaults.heading, intro = s.intro ?? defaults.intro;
  if (!heading) return '';
  return `<div class="sec-head${center ? ' center' : ''} reveal">${eyebrow ? `<div class="eyebrow">${esc(site.t(eyebrow))}</div>` : ''}<h2>${esc(site.t(heading))}</h2>${intro ? `<p class="intro">${esc(site.t(intro))}</p>` : ''}</div>`;
};

const SECTIONS = {
  hero(site, s, page) {
    const b = site.business, L = site.labels, h = { ...site.content.hero, ...s };
    const photo = h.photo || site.photos?.hero;
    const bullets = (h.bullets || site.content.trustBullets || []).map((x) => site.t(x)).filter(Boolean).slice(0, 3);
    const hasRating = b.rating && b.reviewCount;
    return `<section class="hero">
 <div class="hero-media">${img(photo, h.photoAlt || `${b.name} in ${site.vars.city}`, { w: 2000, loading: 'eager', fetchpriority: 'high' })}</div><div class="hero-shade"></div>
 <div class="wrap">
  <div>
   ${h.eyebrow ? `<div class="eyebrow">${esc(site.t(h.eyebrow))}</div>` : ''}
   <h1>${esc(site.t(h.heading))}</h1>
   <p class="sub">${esc(site.t(h.sub))}</p>
   <div class="cta-row">
    ${site.phoneHref ? `<a class="btn btn-accent btn-lg" data-track="preview_call" data-track-detail="hero" href="${site.phoneHref}">${ICONS.phone}Call ${esc(site.vars.phone)}</a>` : ''}
    <a class="btn btn-ghost btn-lg" data-track="preview_book" data-track-detail="hero" href="${esc(site.bookHref)}">${esc(site.t(L.book))}</a>
   </div>
   <div class="hero-meta">
    ${b.hours?.length ? `<span data-open-status>${ICONS.clock}${esc(site.t(L.hoursFallback))}</span>` : ''}
    <span>${ICONS.pin}${esc(b.road ? `${b.road}, ${site.vars.city}` : site.addressLine)}</span>
    ${hasRating ? `<span>${ICONS.star}${esc(b.rating)} · ${esc(b.reviewCount)} Google reviews</span>` : ''}
   </div>
  </div>
  <aside class="hero-card">
   ${hasRating ? `<div class="hc-top"><div class="hc-g">${G}</div><div><div class="hc-num">${esc(b.rating)}</div>${stars(b.rating)}<div class="hc-sub">${esc(b.reviewCount)} Google reviews</div></div></div>`
      : `<div class="hc-top"><div class="hc-g" style="color:var(--accent)">${icon(site.brand.logoIcon || 'award')}</div><div><div class="hc-num">${esc(b.established || site.t(L.heroCardFallbackNum))}</div><div class="hc-sub">${esc(site.t(b.established ? 'Serving {{city}} since' : L.heroCardFallbackSub))}</div></div></div>`}
   <ul class="hc-list">${bullets.map((x) => `<li>${ICONS.check}<span>${esc(x)}</span></li>`).join('')}</ul>
   ${b.hours?.length ? `<div class="hc-status" data-open-status></div>` : ''}
   <a class="btn btn-accent" data-track="preview_book" data-track-detail="hero card" href="${esc(site.bookHref)}">${esc(site.t(L.book))}</a>
  </aside>
 </div>
</section>`;
  },

  trust(site, s) {
    const b = site.business;
    let items = s.items || site.content.trust;
    if (!items) {
      items = [];
      if (b.rating) items.push({ icon: 'star', big: `${b.rating} stars`, small: `${b.reviewCount} Google reviews` });
      if (site.years) items.push({ icon: 'calendar', big: `${site.years} years`, small: `In {{city}} since {{established}}` });
      for (const x of (site.content.badges || []).slice(0, 4 - items.length)) items.push({ icon: x.icon, big: x.title, small: x.sub });
    }
    items = items.slice(0, 4);
    if (!items.length) return '';
    return `<div class="trust"><div class="wrap"><div class="trust-grid" style="--n:${items.length}">${items.map((x, i) =>
      `<div class="trust-item reveal" data-delay="${i}"><div class="trust-ico">${icon(x.icon)}</div><div><b>${esc(site.t(x.big))}</b><span>${esc(site.t(x.small))}</span></div></div>`).join('')}</div></div></div>`;
  },

  services(site, s) {
    const L = site.labels, all = site.content.services || [];
    const list = s.limit ? all.slice(0, s.limit) : all;
    if (!list.length) return '';
    const svcPage = site.pages.find((p) => p.slug === 'services');
    const more = svcPage && s.limit && all.length > list.length;
    return `<section class="sec" id="services"><div class="wrap">
 <div class="sec-head row reveal"><div>${`<div class="eyebrow">${esc(site.t(s.eyebrow ?? L.servicesEyebrow))}</div>`}<h2>${esc(site.t(s.heading ?? L.servicesHeading))}</h2><p class="intro">${esc(site.t(s.intro ?? L.servicesIntro))}</p></div>${svcPage ? `<a class="btn btn-line" href="${esc(pageUrl(site, svcPage))}">${esc(site.t(L.allServices))}${ICONS.arrow}</a>` : ''}</div>
 <div class="svc-grid">${list.map((x, i) => {
      const photo = x.photo || site.photos?.services?.[x.key || x.icon];
      const href = svcPage ? `${pageUrl(site, svcPage)}#${esc(x.key || slug(x.title))}` : '#contact';
      return `<a class="svc-card reveal" data-delay="${i % 3}" href="${href}">
  <div class="svc-media${photo ? '' : ' noimg'}">${photo ? img(photo, x.title, { w: 800, sizes: '(max-width: 600px) 100vw, (max-width: 980px) 50vw, 33vw' }) : icon(x.icon)}<span class="svc-ico">${icon(x.icon)}</span></div>
  <div class="svc-body"><h3>${esc(site.t(x.title))}</h3><p>${esc(site.t(x.blurb))}</p><span class="svc-more">${esc(site.t(L.learnMore))}${ICONS.arrow}</span></div></a>`;
    }).join('')}</div>
 ${more ? `<p class="center" style="margin-top:28px"><a class="btn btn-accent" href="${esc(pageUrl(site, svcPage))}">${esc(site.t(L.allServices))} (${all.length})</a></p>` : ''}
</div></section>`;
  },

  serviceDetails(site, s) {
    const all = site.content.services || [];
    if (!all.length) return '';
    return `<section class="sec" id="details"><div class="wrap"><div class="svc-rows">${all.map((x) => {
      const photo = x.photo || site.photos?.services?.[x.key || x.icon];
      return `<article class="svc-row reveal" id="${esc(x.key || slug(x.title))}">
  <div class="svc-row-media${photo ? '' : ' noimg'}">${photo ? img(photo, x.title, { w: 1200, sizes: '(max-width: 800px) 100vw, 50vw' }) : icon(x.icon)}</div>
  <div><div class="eyebrow">${icon(x.icon)}${esc(site.t(x.eyebrow || site.labels.servicesEyebrow))}</div><h3>${esc(site.t(x.title))}</h3><p class="lead">${esc(site.t(x.detail || x.blurb))}</p>
   ${x.includes?.length ? `<ul class="checks">${x.includes.map((c) => `<li>${ICONS.check}<span>${esc(site.t(c))}</span></li>`).join('')}</ul>` : ''}
   <div class="cta-row"><a class="btn btn-accent" data-track="preview_book" data-track-detail="service ${esc(x.title)}" href="${esc(site.bookHref)}">${esc(site.t(x.cta || site.labels.book))}</a>${site.phoneHref ? `<a class="btn btn-line" data-track="preview_call" data-track-detail="service ${esc(x.title)}" href="${site.phoneHref}">${ICONS.phone}${esc(site.vars.phone)}</a>` : ''}</div></div>
</article>`;
    }).join('')}</div></div></section>`;
  },

  about(site, s) {
    const a = { ...site.content.about, ...s }, b = site.business;
    const p1 = a.photo || site.photos?.about, p2 = a.photo2 || site.photos?.about2 || site.photos?.gallery?.[0];
    const stats = (a.stats || site.content.stats || []).slice(0, 3);
    return `<section class="sec sec-soft" id="about"><div class="wrap about-grid">
 <div class="collage reveal">${p1 ? img(p1, a.photoAlt || `Inside ${b.name}`, { cls: 'c1', w: 1000, sizes: '(max-width: 860px) 90vw, 40vw' }) : ''}${p2 ? img(p2, a.photo2Alt || `${b.name} at work`, { cls: 'c2', w: 800, sizes: '(max-width: 860px) 50vw, 25vw' }) : ''}
  ${a.badgeBig || site.years ? `<div class="badge"><b>${esc(site.t(a.badgeBig || `${site.years}+`))}</b><span>${esc(site.t(a.badgeSmall || 'years in {{city}}'))}</span></div>` : ''}</div>
 <div class="about-body reveal" data-delay="1">
  ${a.eyebrow ? `<div class="eyebrow">${esc(site.t(a.eyebrow))}</div>` : ''}
  <h2>${esc(site.t(a.heading))}</h2>
  <p class="lead">${esc(site.t(a.body))}</p>
  ${a.body2 ? `<p class="lead">${esc(site.t(a.body2))}</p>` : ''}
  ${a.checks?.length ? `<ul class="checks">${a.checks.map((c) => `<li>${ICONS.check}<span>${esc(site.t(c))}</span></li>`).join('')}</ul>` : ''}
  ${stats.length ? `<div class="stats">${stats.map((x) => `<div class="stat"><b${x.count != null ? ` data-count="${esc(x.count)}" data-prefix="${esc(x.prefix || '')}" data-suffix="${esc(x.suffix || '')}"` : ''}>${esc(site.t(x.value))}</b><span>${esc(site.t(x.label))}</span></div>`).join('')}</div>` : ''}
 </div>
</div></section>`;
  },

  process(site, s) {
    const steps = s.steps || site.content.process || [];
    if (!steps.length) return '';
    return `<section class="sec" id="how"><div class="wrap">
 ${secHead(site, s, { eyebrow: site.labels.processEyebrow, heading: site.labels.processHeading, intro: site.labels.processIntro })}
 <div class="steps" style="--n:${steps.length}">${steps.map((x, i) => `<div class="step reveal" data-delay="${i}"><div class="step-num">${i + 1}</div><h3>${esc(site.t(x.title))}</h3><p>${esc(site.t(x.body))}</p></div>`).join('')}</div>
</div></section>`;
  },

  reviews(site, s) {
    const b = site.business, L = site.labels;
    const list = (s.limit ? (site.content.reviews || []).slice(0, s.limit) : (site.content.reviews || []));
    if (!b.rating && !list.length) return '';
    return `<section class="sec sec-soft" id="reviews"><div class="wrap">
 <div class="rv-top reveal">
  ${b.rating ? `<div><div class="rv-big">${esc(b.rating)}</div></div><div>${stars(b.rating, 'stars-dark')}<div class="rv-count">${G}Based on ${esc(b.reviewCount)} Google reviews</div><h2 style="font-size:clamp(24px,3vw,34px);margin-top:10px">${esc(site.t(s.heading ?? L.reviewsHeading))}</h2></div>` : `<div></div><div><h2>${esc(site.t(s.heading ?? L.reviewsHeading))}</h2></div>`}
  <a class="btn btn-line" href="${esc(site.mapsUrl)}" target="_blank" rel="noopener">${esc(site.t(L.readReviews))}${ICONS.arrow}</a>
 </div>
 ${list.length ? `<div class="rv-grid">${list.map((r, i) => `<article class="rv-card reveal" data-delay="${i % 3}">${stars(r.rating ?? 5)}<blockquote>“${esc(r.text)}”</blockquote><div class="rv-who"><div class="avatar">${esc(initials(r.name))}</div><div><b>${esc(r.name)}</b><span>${G}${esc(r.when || 'Google review')}</span></div></div></article>`).join('')}</div>`
      : `<div class="rv-empty reveal">${ICONS.sparkle}<b>${esc(site.t(L.reviewsEmptyTitle))}</b><span>${esc(site.t(L.reviewsEmptyBody))}</span></div>`}
</div></section>`;
  },

  gallery(site, s) {
    const photos = s.photos || site.photos?.gallery || [];
    if (!photos.length) return '';
    return `<section class="sec" id="gallery"><div class="wrap">
 ${secHead(site, s, { eyebrow: site.labels.galleryEyebrow, heading: site.labels.galleryHeading, intro: site.labels.galleryIntro })}
 <div class="gallery">${photos.map((p) => { const o = typeof p === 'string' ? { src: p } : p; return `<figure class="reveal">${img(o.src, o.caption || `${site.business.name} photo`, { w: 1000, sizes: '(max-width: 700px) 85vw, 34vw' })}${o.caption ? `<figcaption>${esc(site.t(o.caption))}</figcaption>` : ''}</figure>`; }).join('')}</div>
</div></section>`;
  },

  beforeAfter(site, s) {
    const ba = { ...site.content.beforeAfter, ...s };
    if (!ba.before || !ba.after) return '';
    return `<section class="sec sec-soft" id="before-after"><div class="wrap">
 ${secHead(site, ba, { eyebrow: 'Before and after', heading: 'See the difference', intro: 'Drag the handle.' }, true)}
 <div class="ba reveal">${img(ba.before, 'Before', { w: 1600 })}${img(ba.after, 'After', { cls: 'ba-after', w: 1600 })}<div class="ba-handle"></div><span class="ba-tag l">Before</span><span class="ba-tag r">After</span><input type="range" min="0" max="100" value="50" aria-label="Compare before and after"></div>
 ${ba.caption ? `<p class="center muted" style="margin-top:16px">${esc(site.t(ba.caption))}</p>` : ''}
</div></section>`;
  },

  faq(site, s) {
    const faqs = s.items || site.content.faqs || [];
    if (!faqs.length) return '';
    const L = site.labels;
    return `<section class="sec" id="faq"><div class="wrap faq-grid">
 <div class="reveal"><div class="eyebrow">${esc(site.t(s.eyebrow ?? L.faqEyebrow))}</div><h2 style="margin:12px 0 14px">${esc(site.t(s.heading ?? L.faqHeading))}</h2><p class="intro muted" style="font-size:17px">${esc(site.t(s.intro ?? L.faqIntro))}</p>
  <div class="cta-row" style="margin-top:22px">${site.phoneHref ? `<a class="btn btn-accent" data-track="preview_call" data-track-detail="faq" href="${site.phoneHref}">${ICONS.phone}${esc(site.vars.phone)}</a>` : ''}</div></div>
 <div class="faq reveal" data-delay="1">${faqs.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(site.t(f.q))}</summary><div class="faq-a">${esc(site.t(f.a))}</div></details>`).join('')}</div>
</div></section>`;
  },

  cta(site, s) {
    const c = { ...site.content.cta, ...s }, L = site.labels;
    return `<section class="cta-band" id="cta"><div class="wrap">
 <div class="reveal">${c.eyebrow ? `<div class="eyebrow">${esc(site.t(c.eyebrow))}</div>` : ''}<h2>${esc(site.t(c.heading))}</h2><p>${esc(site.t(c.body))}</p></div>
 <div class="cta-row reveal" data-delay="1">${site.phoneHref ? `<a class="btn btn-white btn-lg" data-track="preview_call" data-track-detail="cta band" href="${site.phoneHref}">${ICONS.phone}Call ${esc(site.vars.phone)}</a>` : ''}<a class="btn btn-accent btn-lg" data-track="preview_book" data-track-detail="cta band" href="${esc(site.bookHref)}">${esc(site.t(L.book))}</a></div>
</div></section>`;
  },

  serviceArea(site, s) {
    const areas = s.areas || site.business.serviceArea || [];
    if (!areas.length) return '';
    return `<section class="sec sec-soft" id="area"><div class="wrap">
 ${secHead(site, s, { eyebrow: site.labels.areaEyebrow, heading: site.labels.areaHeading, intro: site.labels.areaIntro })}
 <div class="area reveal">${areas.map((a) => `<span>${ICONS.pin}${esc(a)}</span>`).join('')}</div>
</div></section>`;
  },

  badges(site, s) {
    const items = s.items || site.content.badges || [];
    if (!items.length) return '';
    return `<section class="sec" id="credentials"><div class="wrap">
 ${secHead(site, s, { eyebrow: site.labels.badgesEyebrow, heading: site.labels.badgesHeading })}
 <div class="badges">${items.map((x, i) => `<div class="badge-card reveal" data-delay="${i % 3}"><div class="trust-ico">${icon(x.icon)}</div><div><b>${esc(site.t(x.title))}</b><span>${esc(site.t(x.sub))}</span></div></div>`).join('')}</div>
</div></section>`;
  },

  contact(site, s) {
    const b = site.business, L = site.labels, f = { ...site.content.form, ...s.form };
    const fields = (f.fields || []).map((x) => {
      const req = x.required ? ' required' : '', ph = x.placeholder ? ` placeholder="${esc(x.placeholder)}"` : '', ac = x.autocomplete ? ` autocomplete="${esc(x.autocomplete)}"` : '';
      let ctl;
      if (x.type === 'textarea') ctl = `<textarea name="${esc(x.name)}" rows="${x.rows || 3}"${ph}${req}></textarea>`;
      else if (x.type === 'select') ctl = `<select name="${esc(x.name)}"${req}>${(x.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
      else ctl = `<input name="${esc(x.name)}" type="${esc(x.type || 'text')}"${x.multiple ? ' multiple' : ''}${ph}${ac}${req}>`;
      return `<label class="${x.full ? 'full' : 'half'}">${esc(x.label)}${ctl}</label>`;
    }).join('');
    return `<section class="sec${s.soft === false ? '' : ' sec-soft'}" id="contact"><div class="wrap">
 ${secHead(site, s, { eyebrow: L.contactEyebrow, heading: L.contactHeading, intro: L.contactIntro })}
 <div class="contact-grid">
  <div class="form-card reveal" id="form"><h3>${esc(site.t(f.title || L.book))}</h3><p class="hint">${esc(site.t(f.hint || ''))}</p>
   <form class="f" novalidate>${fields}
    <div class="f-actions"><button class="btn btn-accent" data-track="preview_book" data-track-detail="send request" type="submit">${esc(site.t(f.submit || 'Send request'))}</button><small>${esc(site.t(f.fine || L.formFine))}</small></div>
    <div class="formnote">${esc(site.t(L.formPreviewNote))}</div>
   </form></div>
  <div class="info reveal" data-delay="1">
   ${site.phoneHref ? `<div class="info-card"><div class="trust-ico">${ICONS.phone}</div><div><h4>Call or text</h4><p><a data-track="preview_call" data-track-detail="contact" href="${site.phoneHref}">${esc(site.vars.phone)}</a></p>${b.email ? `<p style="font-size:15px"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>` : ''}</div></div>` : ''}
   <div class="info-card"><div class="trust-ico">${ICONS.pin}</div><div><h4>${esc(site.t(L.visit))}</h4><p>${esc(site.addressLine)}</p><p style="font-size:15px"><a data-track="preview_directions" data-track-detail="contact" href="${esc(site.mapsUrl)}" target="_blank" rel="noopener">Get directions${ICONS.arrow}</a></p></div></div>
   ${b.hours?.length ? `<div class="info-card"><div class="trust-ico">${ICONS.clock}</div><div style="flex:1"><h4>${esc(L.hours)}</h4><p data-open-status style="font-size:14.5px;margin-bottom:10px"></p>${hoursTable(site)}</div></div>` : ''}
   <iframe class="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(site.mapEmbed)}" title="Map to ${esc(b.name)}"></iframe>
  </div>
 </div>
</div></section>`;
  },

  map(site) {
    return `<section class="sec" id="map"><div class="wrap"><iframe class="map reveal" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(site.mapEmbed)}" title="Map to ${esc(site.business.name)}"></iframe></div></section>`;
  },

  text(site, s) {
    return `<section class="sec${s.soft ? ' sec-soft' : ''}"${s.id ? ` id="${esc(s.id)}"` : ''}><div class="wrap" style="max-width:${s.narrow === false ? 'var(--max)' : '820px'}">
 ${secHead(site, s)}
 <div class="reveal" style="font-size:17px;line-height:1.7">${s.bodyHtml ? site.t(s.bodyHtml) : (s.paragraphs || []).map((p) => `<p>${esc(site.t(p))}</p>`).join('')}</div>
</div></section>`;
  },

  team(site, s) {
    const people = s.people || site.content.team || [];
    if (!people.length) return '';
    return `<section class="sec" id="team"><div class="wrap">
 ${secHead(site, s, { eyebrow: 'The crew', heading: 'Who you’ll meet' })}
 <div class="badges">${people.map((p, i) => `<div class="badge-card reveal" data-delay="${i % 3}">${p.photo ? img(p.photo, p.name, { w: 300, cls: 'avatar' }) : `<div class="avatar">${esc(initials(p.name))}</div>`}<div><b>${esc(p.name)}</b><span>${esc(site.t(p.role))}</span></div></div>`).join('')}</div>
</div></section>`;
  },
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function pageHero(site, page) {
  const h = page.hero || {};
  const photo = h.photo || site.photos?.pages?.[page.slug] || site.photos?.hero;
  return `<section class="page-hero">${photo ? `<div class="hero-media">${img(photo, '', { w: 2000, loading: 'eager', fetchpriority: 'high' })}</div>` : ''}<div class="wrap">
 <div class="crumbs"><a href="${esc(site.base)}">Home</a><span>›</span><span>${esc(site.t(page.title))}</span></div>
 <h1>${esc(site.t(h.heading) || site.t(page.title))}</h1>${h.sub ? `<p>${esc(site.t(h.sub))}</p>` : ''}
</div></section>`;
}

export function renderPage(site, page) {
  const isHome = page.slug === '';
  const body = page.sections.map((s) => {
    const fn = SECTIONS[s.type];
    if (!fn) throw new Error(`Unknown section type "${s.type}" on page "${page.slug || 'home'}"`);
    return fn(site, s, page);
  }).join('\n');
  const hero = isHome ? (page.sections.some((s) => s.type === 'hero') ? '' : SECTIONS.hero(site, page.hero || {}, page)) : pageHero(site, page);
  return `${head(site, page)}
<body>
${topbar(site)}
${header(site, page)}
<main id="top"${site.business.hours?.length ? ` data-hours='${JSON.stringify(site.business.hours).replace(/'/g, "&#39;")}'` : ''}>
${hero}
${body}
</main>
${demoNote(site)}
${footer(site, page)}
<script src="/config.js" defer></script>
<script src="/track.js" defer></script>
<script src="/preview/theme/site.js" defer></script>
</body>
</html>
`;
}

export function renderSite(site) {
  return site.pages.map((p) => ({ path: (p.slug ? p.slug + '/' : '') + 'index.html', html: renderPage(site, p), url: pageUrl(site, p) }));
}
