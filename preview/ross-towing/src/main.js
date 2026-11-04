// Ross Towing preview: forms, Towbook switch and the next auction banner. journey.js only draws the
// road and truck; everything here works with or without it. Switches live in src/config.js.
import { CONFIG } from './config.js';
import { setupForm, readForm, check, phoneRule, esc, callLink, emailUs, summaryList, PHONE } from './forms.js';
import { formatFreightQuote, freightSummary, freightSubject, formatTowRequest, towSummary, towSubject } from './messages.js';
import { rowsFromCSV, rowsFromJSON, getAuctionState, formatAuctionDate, buildICS } from './auction.js';

const D = document;
const ADDRESS = '21360 Telegraph Rd, Southfield, MI 48033';
const idle = (fn) => {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200));
  if (D.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
};
const httpsUrl = (v) => { try { const u = new URL(String(v || '').trim()); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
const again = '<button class="btn btn-line btn-again" type="button" data-again>Start a new request</button>';

// ---------- freight quote ----------
(function freight() {
  const form = D.getElementById('freight-quote');
  if (!form) return;
  // Each number is read with its unit ("Length, feet") through a hidden description that follows the select.
  const WORDS = { ft: 'feet', in: 'inches', lbs: 'pounds', tons: 'tons' };
  const units = [...form.querySelectorAll('select[data-unit-for]')];
  const syncUnits = () => units.forEach((s) => { D.getElementById(s.dataset.unitFor).textContent = WORDS[s.value] || s.value; });
  units.forEach((s) => s.addEventListener('change', syncUnits));
  // "Other" reveals a short text field, which is then required
  const other = form.querySelector('input[name="equipment"][value="Other"]');
  const otherField = D.getElementById('fq-other-field'), otherInput = D.getElementById('fq-other');
  const syncOther = () => { otherField.hidden = !other.checked; otherInput.required = other.checked; if (!other.checked) check(otherInput); };
  other.addEventListener('change', syncOther);
  // Delivery date can't be before the ready date
  const ready = form.elements.ready_date, by = form.elements.deliver_by;
  const syncDates = () => { by.min = ready.value || ''; if (by.getAttribute('aria-invalid')) check(by); };
  ready.addEventListener('change', syncDates);
  phoneRule(form.elements.phone);
  form.addEventListener('reset-ui', () => { syncUnits(); syncOther(); syncDates(); });
  syncUnits(); syncOther();

  setupForm(form, {
    endpoint: String(CONFIG.FORM_ENDPOINT_FREIGHT || '').trim(),
    read: (f) => readForm(f, ['equipment']),
    payload: (d) => ({
      form: 'Freight quote', _subject: freightSubject(d), subject: freightSubject(d),
      ...d, weight_estimate: d.weight_estimate ? 'Yes' : 'No', message: formatFreightQuote(d),
    }),
    fallback: (d) => `<p>Thanks. Online quotes are almost ready. For now, please call ${callLink('freight form fallback')} or ${emailUs(freightSubject(d), formatFreightQuote(d))}.</p>`,
    done: (d) => d
      ? `<p class="done-h" tabindex="-1"><strong>Thanks, your quote request was sent.</strong> Please check these details:</p>${summaryList(freightSummary(d))}<p>Something wrong? Call ${callLink('freight form sent')}.</p>${again}`
      : '<p class="done-h" tabindex="-1"><strong>Thanks, your quote request was sent.</strong></p>',
  });
})();

// ---------- tow request and Towbook ----------
// TOWBOOK_MODE "none": the details form below the call button. "link": a button that opens
// TOWBOOK_URL in a new tab. "embed": TOWBOOK_URL in an iframe, falling back to "link".
(function tow() {
  idle(towbookQR);
  const host = D.getElementById('tow-online'), form = D.getElementById('tow-request');
  if (!host || !form) return;
  const mode = String(CONFIG.TOWBOOK_MODE || 'none').trim().toLowerCase();
  const url = httpsUrl(CONFIG.TOWBOOK_URL);
  if (mode === 'link' && url) return towLink(host, url);
  if (mode === 'embed' && url) return towEmbed(host, url);
  if (mode !== 'none') console.warn(`[ross] TOWBOOK_MODE "${mode}" needs an https TOWBOOK_URL. Showing the form instead.`);
  towForm(form);
})();

function towIntro(title) {
  return `<h3>${title}</h3><p class="hint">For emergencies, call. We answer 24/7.</p>`;
}

function towLink(host, url) {
  host.innerHTML = `<div class="tow-alt">${towIntro('Not urgent? Request a tow online')}
    <a class="btn btn-line tow-link" href="${esc(url)}" target="_blank" rel="noopener" data-track="preview_book" data-track-detail="towbook link">Request a tow online<span class="sr"> (opens in a new tab)</span></a></div>`;
}

function towEmbed(host, url) {
  host.innerHTML = `<div class="tow-alt tow-embed">${towIntro('Not urgent? Request a tow online')}
    <div class="tb-box"><iframe src="${esc(url)}" title="Online tow request form, hosted by Towbook" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <p class="tb-help">Having trouble? Call ${callLink('towbook embed')}. Or <a href="${esc(url)}" target="_blank" rel="noopener">open the form in a new tab</a>.</p></div>`;
  // Falls back to the link button when Towbook can't be reached or the frame never loads. Browsers
  // still report "load" for a frame that Towbook refuses (X-Frame-Options or CSP), and the parent page
  // can't see that, which is why the new tab link above is always there. See README.md, "Towbook".
  const frame = host.querySelector('iframe');
  let loaded = false;
  const fail = (force) => {
    if ((loaded && !force) || !frame.isConnected) return;
    console.warn('[ross] Towbook embed unavailable; showing the link instead');
    towLink(host, url);
  };
  frame.addEventListener('load', () => { loaded = true; });
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    fetch(url, { mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).catch(() => fail(true));   // unreachable: DNS, offline, refused
    setTimeout(() => fail(false), 10000);                                                               // never loaded
  }, { rootMargin: '400px' });
  io.observe(frame);
}

function towForm(form) {
  phoneRule(form.elements.phone);
  // "Use my location": only on tap, never on load
  const btn = D.getElementById('tr-geo'), loc = D.getElementById('tr-loc'), note = D.getElementById('tr-geo-note');
  if (btn && 'geolocation' in navigator && window.isSecureContext) {
    btn.hidden = false;
    btn.addEventListener('click', () => {
      btn.disabled = true;
      note.textContent = 'Finding your location...';
      navigator.geolocation.getCurrentPosition((p) => {
        const lat = p.coords.latitude.toFixed(5), lng = p.coords.longitude.toFixed(5);
        const here = `${lat}, ${lng} (https://www.google.com/maps?q=${lat},${lng})`;
        const typed = loc.value.trim();
        loc.value = typed && !typed.includes('google.com/maps') ? `${typed}; ${here}` : here;
        check(loc);
        note.textContent = 'Location added. If you can, add cross streets or the nearest exit.';
        btn.disabled = false;
      }, (err) => {
        note.textContent = err.code === 1
          ? 'Location is turned off for this site. Please type the address or nearest exit.'
          : "We couldn't get your location. Please type the address or nearest exit.";
        btn.disabled = false;
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
    form.addEventListener('reset-ui', () => { note.textContent = ''; });
  }
  setupForm(form, {
    endpoint: String(CONFIG.FORM_ENDPOINT_TOW || '').trim(),
    read: (f) => readForm(f),
    payload: (d) => ({ form: 'Tow request', _subject: towSubject(d), subject: towSubject(d), ...d, message: formatTowRequest(d) }),
    fallback: (d) => `<p>Thanks. Online requests are almost ready. For now, please call ${callLink('tow form fallback')} or ${emailUs(towSubject(d), formatTowRequest(d))}.</p>`,
    done: (d) => d
      ? `<p class="done-h" tabindex="-1"><strong>Thanks, your request was sent to the Ross Towing office.</strong> For emergencies, call ${callLink('tow form sent')}.</p>${summaryList(towSummary(d))}${again}`
      : '<p class="done-h" tabindex="-1"><strong>Thanks, your request was sent.</strong></p>',
  });
}

// Shows the Towbook QR slot only once CONFIG.TOWBOOK_QR_SRC points at a file that loads.
function towbookQR() {
  const fig = D.getElementById('towbook-qr'), src = String(CONFIG.TOWBOOK_QR_SRC || '').trim();
  if (!fig || !src) return;
  const img = fig.querySelector('img');
  img.addEventListener('load', () => { fig.hidden = false; }, { once: true });
  img.addEventListener('error', () => { fig.hidden = true; console.warn('[ross] Towbook QR not found at ' + src); }, { once: true });
  img.src = src;
}

// ---------- next public auction ----------
// Source 1: the published Google Sheet (CONFIG.AUCTION_SHEET_CSV_URL). Source 2: data/auction.json.
// Fetched after the page is idle, so it never touches first paint. ?auction=YYYY-MM-DD previews a date.
const SHEET_KEY = 'ross-auction-sheet', SHEET_TTL = 10 * 60e3;

function sheetCacheGet(url) {
  try {
    const c = JSON.parse(sessionStorage.getItem(SHEET_KEY));
    if (c && c.url === url && Date.now() - c.t < SHEET_TTL && Array.isArray(c.rows)) return c.rows;
  } catch { /* storage blocked or junk: fetch again */ }
  return null;
}
function sheetCacheSet(url, rows) {
  try { sessionStorage.setItem(SHEET_KEY, JSON.stringify({ url, t: Date.now(), rows })); } catch { /* fine without it */ }
}

async function fetchText(url, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function loadAuction() {
  const jsonP = fetch('data/auction.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const url = String(CONFIG.AUCTION_SHEET_CSV_URL || '').trim();
  let rows = null;
  if (url) {
    rows = sheetCacheGet(url);
    if (!rows) {
      try {
        rows = rowsFromCSV(await fetchText(url, 4000));
        if (rows.length) sheetCacheSet(url, rows);
        else console.warn('[ross] auction sheet has no dated rows; using data/auction.json');
      } catch (e) {
        console.warn('[ross] auction sheet unavailable; using data/auction.json', e);
        rows = null;
      }
    }
    if (rows && !rows.length) rows = null;
  }
  const json = (await jsonP) || {};
  return { rows: rows || rowsFromJSON(json), lead: json.showFromDaysBefore, location: json.location || ADDRESS };
}

(function auction() {
  const slot = D.getElementById('auction-slot');
  if (!slot) return;
  const q = new URLSearchParams(location.search).get('auction');
  if (q) return renderAuction(slot, getAuctionState([{ date: q }], new Date(), 3650), ADDRESS);
  idle(async () => {
    try {
      const { rows, lead, location: loc } = await loadAuction();
      renderAuction(slot, getAuctionState(rows, new Date(), lead), loc);
    } catch (e) { console.warn('[ross] auction banner skipped', e); }
  });
})();

function renderAuction(slot, res, defaultLocation) {
  if (res.state === 'none') return;                       // the static "call for the next date" line stays
  const a = res.auction, key = 'ross-auction-dismissed:' + a.date;
  try { if (localStorage.getItem(key)) return; } catch { /* storage blocked: show it */ }
  const stat = slot.querySelector('.auction-static'), ban = slot.querySelector('.auction-banner');
  const where = a.location || defaultLocation;
  const today = res.state === 'today';
  const head = today ? 'Public auction today' : `Next public auction: ${formatAuctionDate(a.date)}`;
  const meta = [today ? formatAuctionDate(a.date) : '', a.time, where].filter(Boolean).join(' · ');
  const ics = buildICS({ ...a, location: where }, { fallbackLocation: ADDRESS, phone: PHONE });
  const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  ban.innerHTML = `<svg class="ico ab-ico" aria-hidden="true"><use href="#i-calendar"/></svg>
    <div class="ab-text"><p class="ab-h">${esc(head)}</p>${meta ? `<p class="ab-meta">${esc(meta)}</p>` : ''}${a.note ? `<p class="ab-note">${esc(a.note)}</p>` : ''}</div>
    <a class="btn ab-cal" href="${href}" download="ross-towing-auction-${a.date}.ics">Add to calendar</a>
    <button class="ab-x" type="button" aria-label="Hide the auction date"><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg></button>`;
  stat.hidden = true;
  ban.hidden = false;
  slot.classList.add('is-set');
  ban.querySelector('.ab-x').addEventListener('click', () => {
    try { localStorage.setItem(key, '1'); } catch { /* hides for this visit only */ }
    ban.hidden = true; stat.hidden = false; slot.classList.remove('is-set');
    stat.focus();
  });
}
