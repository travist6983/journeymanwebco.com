// Next public auction: pure date logic, shared by the page and the unit tests. No DOM in this file.
// Every "today" is the calendar date in Detroit, whatever time zone the visitor's device is in.

export const TZ = 'America/Detroit';
const DAY = 864e5;
const str = (v) => (v == null ? '' : String(v).trim());

// "2026-12-12" (or 12/12/2026, which Google Sheets may show for a typed date) -> day number, or NaN.
export function parseDay(v) {
  const t = str(v);
  let y, m, d, x;
  if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [m, d, y] = [+x[1], +x[2], +x[3]];
  else return NaN;
  const ms = Date.UTC(y, m - 1, d), c = new Date(ms);
  if (c.getUTCFullYear() !== y || c.getUTCMonth() !== m - 1 || c.getUTCDate() !== d) return NaN; // 2026-02-30
  return ms / DAY;
}
export const dayToISO = (n) => new Date(n * DAY).toISOString().slice(0, 10);

function detroitParts(ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return Object.fromEntries(f.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, +p.value]));
}

// Today's calendar date in Detroit, as a day number.
export function detroitDay(now = new Date()) {
  const p = detroitParts(+now);
  return Date.UTC(p.year, p.month - 1, p.day) / DAY;
}

// The soonest auction that has not passed, and whether to show it.
// Shown from (date - showFromDaysBefore) through the auction day; hidden from the day after.
// rows: [{ date: "YYYY-MM-DD", time?, location?, note? }]
// returns { state: "upcoming" | "today" | "none", auction: { date, time, location, note, daysAway } | null }
export function getAuctionState(rows, now = new Date(), showFromDaysBefore = 30) {
  const n = Number(showFromDaysBefore);
  const lead = showFromDaysBefore == null || showFromDaysBefore === '' || !Number.isFinite(n) || n < 0 ? 30 : Math.floor(n);
  const today = detroitDay(now);
  let best = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = parseDay(r && r.date);
    if (!Number.isFinite(day) || day < today) continue;
    if (!best || day < best.day) best = { r, day };
  }
  if (!best || today < best.day - lead) return { state: 'none', auction: null };
  const { r, day } = best;
  return {
    state: day === today ? 'today' : 'upcoming',
    auction: { date: dayToISO(day), time: str(r.time), location: str(r.location), note: str(r.note), daysAway: day - today },
  };
}

// Small CSV parser: quoted values, commas and line breaks inside quotes, "" escapes, CRLF.
export function parseCSV(text) {
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c !== '"') f += c;
      else if (s[i + 1] === '"') { f += '"'; i++; }
      else q = false;
    } else if (c === '"' && f === '') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Turns one row into { date, time, location, note }, or null for a blank or unusable row.
function normalize(src, warn, where) {
  const vals = ['date', 'time', 'location', 'note'].map((k) => str(src[k]));
  if (vals.every((v) => !v)) return null;
  const day = parseDay(vals[0]);
  if (!Number.isFinite(day)) {
    warn(`[ross] auction: skipped ${where}, the date "${vals[0]}" isn't YYYY-MM-DD`);
    return null;
  }
  return { date: dayToISO(day), time: vals[1], location: vals[2], note: vals[3] };
}

// Published Google Sheet CSV -> rows. Header names: date, time, location, note (any order, any case).
export function rowsFromCSV(text, warn = console.warn) {
  const [head, ...body] = parseCSV(text);
  if (!head) return [];
  const cols = head.map((h) => str(h).toLowerCase());
  if (!cols.includes('date')) { warn('[ross] auction: the sheet has no "date" column'); return []; }
  return body.map((cells, i) => {
    const o = {};
    cols.forEach((c, j) => { o[c] = cells[j]; });
    return normalize(o, warn, `sheet row ${i + 2}`);
  }).filter(Boolean);
}

// data/auction.json -> rows. { "date": null } means nothing is scheduled.
export function rowsFromJSON(obj, warn = console.warn) {
  if (!obj || obj.date == null || obj.date === '') return [];
  const r = normalize(obj, warn, 'data/auction.json');
  return r ? [r] : [];
}

// "Saturday, December 12"
export function formatAuctionDate(iso) {
  return new Date(parseDay(iso) * DAY).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
}

// "10:00 AM", "10 am", "10am", "14:30" -> { h, m }, or null
export function parseTime(v) {
  const t = str(v).toLowerCase().replace(/\./g, '');
  let x = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)$/.exec(t);
  if (x) {
    let h = +x[1] % 12; const m = +(x[2] || 0);
    if (x[3][0] === 'p') h += 12;
    return +x[1] >= 1 && +x[1] <= 12 && m < 60 ? { h, m } : null;
  }
  x = /^(\d{1,2}):(\d{2})$/.exec(t);
  return x && +x[1] < 24 && +x[2] < 60 ? { h: +x[1], m: +x[2] } : null;
}

// Detroit wall clock time on a calendar day -> UTC milliseconds (handles EST and EDT).
export function detroitToUTC(day, h, m) {
  const wall = day * DAY + (h * 60 + m) * 6e4;
  const offset = (ms) => { const p = detroitParts(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms; };
  let ms = wall - offset(wall);
  ms = wall - offset(ms);
  return ms;
}

const icsText = (s) => str(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line) {
  let out = '', s = line;
  while (s.length > 74) { out += s.slice(0, 74) + '\r\n '; s = s.slice(74); }
  return out + s;
}

// An .ics file for "Add to calendar". With a time it's a one hour event (the sheet has no end time);
// without one it's an all day event.
export function buildICS(a, { now = new Date(), fallbackLocation = '', phone = '248-356-6011' } = {}) {
  const day = parseDay(a.date), t = parseTime(a.time), ymd = a.date.replace(/-/g, '');
  const when = t
    ? [`DTSTART:${icsStamp(detroitToUTC(day, t.h, t.m))}`, `DTEND:${icsStamp(detroitToUTC(day, t.h, t.m) + 36e5)}`]
    : [`DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${dayToISO(day + 1).replace(/-/g, '')}`];
  const desc = [a.note, a.time && !t ? `Time: ${a.time}` : '', `Questions? Call Ross Towing at ${phone}.`].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ross Towing//Public auction//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:ross-towing-auction-${ymd}`, `DTSTAMP:${icsStamp(+now)}`, ...when,
    `SUMMARY:${icsText('Ross Towing public auction')}`,
    `LOCATION:${icsText(a.location || fallbackLocation)}`,
    `DESCRIPTION:${icsText(desc)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
