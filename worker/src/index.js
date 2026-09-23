// journeyman-contact: the free review form (POST /) and lead click tracking (POST /t),
// plus a daily digest on a cron. See README.md in this folder.

const ALLOWED_ORIGINS = [
  "https://journeymanwebco.com",
  "https://www.journeymanwebco.com",
];
// Turnstile tokens must have been minted on the live site, not anywhere else
// the site key happens to be allowed.
const ALLOWED_HOSTNAMES = ["journeymanwebco.com", "www.journeymanwebco.com"];
const MAX_BODY_BYTES = 16 * 1024;

const TO = "travis@journeymanwebco.com";
const FROM = "Journeyman Web Co. <form@send.journeymanwebco.com>";
const FALLBACK = "Call 248-505-9421 or email travis@journeymanwebco.com.";

// Lead tracking
const TRACK_ORIGIN = "https://journeymanwebco.com";
const LEAD_ID = /^[a-z0-9]{6,8}$/;
const EVENT_TYPES = new Set([
  "visit", "engaged", "click_call", "click_email", "click_review_cta",
  "click_package", "toggle_pricing", "see_work", "form_start", "form_submit",
]);
const MAX_EVENTS_PER_HOUR = 50;
// Crawlers, link scanners, and automation. Their requests are dropped, not stored.
const BOT_UA = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|preview|scanner|safelinks|mimecast|proofpoint|barracuda|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\//i;
const TZ = "America/Detroit";

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

// Detroit calendar helpers (Intl handles EST/EDT).
const detroitDate = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const detroitHour = (d) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d));
const detroitTime = (d) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);

// Resend, or (local testing only) EMAIL_DRY_RUN: log the email, or POST it to that URL.
async function sendEmail(env, { subject, text, html, reply_to }) {
  if (env.EMAIL_DRY_RUN) {
    console.log("EMAIL_DRY_RUN " + JSON.stringify({ subject, text }));
    if (/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(env.EMAIL_DRY_RUN)) {
      await fetch(env.EMAIL_DRY_RUN, { method: "POST", body: JSON.stringify({ subject, text }) }).catch(() => {});
    }
    return { ok: true };
  }
  const message = { from: FROM, to: [TO], subject, text, html };
  if (reply_to) message.reply_to = reply_to;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res;
}

async function findLead(env, id) {
  if (!env.DB || !LEAD_ID.test(id)) return null;
  return env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/t") return track(request, env, ctx);
    return contact(request, env);
  },

  // Daily digest at 7:30 AM Detroit time. Cron times are UTC, and Detroit moves between
  // UTC-4 (EDT) and UTC-5 (EST), so two runs are scheduled: 11:30 UTC is 7:30 AM in EDT
  // and 12:30 UTC is 7:30 AM in EST. Whichever run lands in the 7 AM hour sends; the
  // other sees 6 or 8 AM and does nothing.
  async scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    if (detroitHour(now) !== 7 && !env.DIGEST_ANY_HOUR) return;
    ctx.waitUntil(sendDigest(env, now));
  },
};

// ---------------------------------------------------------------------------
// POST / : free website review form
// ---------------------------------------------------------------------------
async function contact(request, env) {
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Forbidden" }, 403, origin);
  }

  // Refuse oversized bodies before reading them, and again after in case
  // Content-Length was missing.
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
    return json({ error: "That's too much text." }, 413, origin);
  }
  let data;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "That's too much text." }, 413, origin);
    }
    data = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request" }, 400, origin);
  }
  if (!data || typeof data !== "object") {
    return json({ error: "Invalid request" }, 400, origin);
  }

  // Honeypot: a field real people never see or fill.
  if (data.hp) {
    return json({ ok: true }, 200, origin);
  }

  const name = String(data.name || "").trim().slice(0, 120);
  const business = String(data.business || "").trim().slice(0, 160);
  const website = String(data.website || "").trim().slice(0, 300);
  const phone = String(data.phone || "").trim().slice(0, 40);
  const email = String(data.email || "").trim().slice(0, 200);
  const notes = String(data.notes || "").trim().slice(0, 3000);
  const pkg = String(data.package || "").trim().slice(0, 60);
  const leadId = String(data.leadId || "").trim();
  const token = String(data.turnstileToken || "");

  if (!name || !business || !phone || !email) {
    return json({ error: "Please fill in your name, business, phone, and email." }, 400, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "That email address doesn't look right." }, 400, origin);
  }
  if (phone.replace(/\D/g, "").length < 7) {
    return json({ error: "That phone number doesn't look right." }, 400, origin);
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY) {
    console.error("Missing secret:", !env.TURNSTILE_SECRET_KEY ? "TURNSTILE_SECRET_KEY" : "RESEND_API_KEY");
    return json({ error: `The form isn't working right now. ${FALLBACK}` }, 500, origin);
  }

  // Bot check
  let verdict;
  try {
    const verify = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || undefined,
        }),
      }
    );
    verdict = await verify.json();
  } catch (err) {
    console.error("Turnstile siteverify failed", err);
    return json({ error: `The bot check isn't responding. ${FALLBACK}` }, 502, origin);
  }
  // TURNSTILE_HOSTNAMES is only set for local testing with Cloudflare's test keys.
  const hostnames = env.TURNSTILE_HOSTNAMES ? env.TURNSTILE_HOSTNAMES.split(",") : ALLOWED_HOSTNAMES;
  if (!verdict.success || !hostnames.includes(verdict.hostname)) {
    if (verdict.success) console.warn("Turnstile token from unexpected hostname", verdict.hostname);
    else console.warn("Turnstile rejected the token", JSON.stringify(verdict["error-codes"] || []));
    return json({ error: "Bot check failed. Please reload and try again." }, 403, origin);
  }

  // If they came in through one of my outreach emails, say which lead this is.
  let lead = null;
  try {
    lead = await findLead(env, leadId);
  } catch (err) {
    console.error("Lead lookup failed", err);
  }

  // Every field the form sends, labeled, in the order the form asks for them.
  const rows = [
    ["Website", website || "(none yet)"],
    ["Name", name],
    ["Business", business],
    ["Phone", phone],
    ["Email", email],
    ["Package", pkg || "Not sure yet"],
    ["Notes", notes || "(none)"],
  ];

  const leadLine = lead ? `Lead: ${lead.business || "(no business name)"} (${lead.id})` : "";
  const text =
    (leadLine ? `${leadLine}\n\n` : "") +
    `Free website review request\n\n` +
    rows.map(([k, v]) => (k === "Notes" ? `\nNotes:\n${v}` : `${k}: ${v}`)).join("\n") +
    `\n`;

  const cell = "padding:6px 16px 6px 0;vertical-align:top;font-family:system-ui,sans-serif;font-size:15px;line-height:1.45";
  const html =
    (leadLine ? `<p style="font-family:system-ui,sans-serif;font-size:15px;margin:0 0 12px"><strong>${esc(leadLine)}</strong></p>` : "") +
    `<h2 style="font-family:system-ui,sans-serif;margin:0 0 12px">Free website review request</h2>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
    rows.map(([k, v]) => {
      const value = k === "Email" ? `<a href="mailto:${esc(v)}">${esc(v)}</a>`
        : k === "Phone" ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ""))}">${esc(v)}</a>`
        : esc(v);
      return `<tr><th align="left" style="${cell};font-weight:600;white-space:nowrap">${k}</th>` +
        `<td style="${cell};white-space:pre-wrap">${value}</td></tr>`;
    }).join("") +
    `</table>`;

  const send = await sendEmail(env, {
    subject: `Free review request: ${business}`,
    text,
    html,
    reply_to: email,
  });

  if (!send.ok) {
    return json({ error: `Could not send right now. ${FALLBACK}` }, 502, origin);
  }

  return json({ ok: true }, 200, origin);
}

// ---------------------------------------------------------------------------
// POST /t : lead click tracking. Fire and forget from the site; answers 204.
// ---------------------------------------------------------------------------
async function track(request, env, ctx) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const origin = request.headers.get("Origin") || "";
  // TRACK_ORIGIN is only set for local testing.
  if (origin !== (env.TRACK_ORIGIN || TRACK_ORIGIN)) return new Response(null, { status: 403 });

  const done = new Response(null, { status: 204 });
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT_UA.test(ua) || !env.DB) return done;

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return done;
    body = JSON.parse(raw);
  } catch {
    return done;
  }
  const r = String((body && body.r) || "");
  const type = String((body && body.type) || "");
  if (!LEAD_ID.test(r) || !EVENT_TYPES.has(type)) return done;

  const lead = await findLead(env, r);
  if (!lead) return done; // unknown ids are ignored

  const now = new Date();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE lead_id = ? AND ts > ?")
    .bind(r, new Date(now.getTime() - 3600e3).toISOString()).first();
  if (recent.n >= MAX_EVENTS_PER_HOUR) return done;

  // The first "engaged" of the Detroit calendar day gets an email alert.
  let alert = false;
  if (type === "engaged") {
    const last = await env.DB.prepare("SELECT ts FROM events WHERE lead_id = ? AND type = 'engaged' ORDER BY ts DESC LIMIT 1")
      .bind(r).first();
    alert = !last || detroitDate(new Date(last.ts)) !== detroitDate(now);
  }

  const country = request.headers.get("CF-IPCountry") || (request.cf && request.cf.country) || null;
  await env.DB.prepare("INSERT INTO events (lead_id, type, detail, path, ts, ua, country) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(r, type, clip(body.detail, 120), clip(body.path, 200), now.toISOString(), ua.slice(0, 160), country).run();

  if (alert) ctx.waitUntil(sendAlert(env, lead, now).catch((err) => console.error("Alert failed", err)));
  return done;
}

// The leads table has no phone column; use a number from the notes if there is one.
function phoneFrom(notes) {
  const m = String(notes || "").match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return m ? m[0] : "";
}

function eventLine(e) {
  return `${detroitTime(new Date(e.ts))}  ${e.type}${e.detail ? `  (${e.detail})` : ""}${e.path && e.path !== "/" ? `  ${e.path}` : ""}`;
}

async function sendAlert(env, lead, now) {
  // "This visit": what this lead did in the last two hours.
  const { results } = await env.DB.prepare("SELECT type, detail, path, ts FROM events WHERE lead_id = ? AND ts > ? ORDER BY ts")
    .bind(lead.id, new Date(now.getTime() - 2 * 3600e3).toISOString()).all();
  const phone = phoneFrom(lead.notes);
  const facts = [
    ["Business", lead.business],
    ["Contact", lead.contact],
    ["Trade", lead.trade],
    ["City", lead.city],
    ["Your email went out", lead.sent_at],
    ["Email", lead.email],
    ["Phone", phone],
    ["Lead id", lead.id],
  ].filter(([, v]) => v);

  const subject = `Lead engaged: ${lead.business || lead.id}${lead.city ? ` (${lead.city})` : ""}`;
  const text =
    `${lead.business || lead.id} is looking at journeymanwebco.com.\n\n` +
    facts.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nThis visit:\n` + results.map((e) => `  ${eventLine(e)}`).join("\n") +
    (lead.notes ? `\n\nNotes:\n${lead.notes}` : "") + `\n`;

  const f = "font-family:system-ui,sans-serif;font-size:15px;line-height:1.5";
  const html =
    `<p style="${f}"><strong>${esc(lead.business || lead.id)}</strong> is looking at journeymanwebco.com.</p>` +
    `<p style="${f}">` + facts.map(([k, v]) => {
      const value = k === "Email" ? `<a href="mailto:${esc(v)}">${esc(v)}</a>`
        : k === "Phone" ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ""))}">${esc(v)}</a>` : esc(v);
      return `<strong>${k}:</strong> ${value}`;
    }).join("<br>") + `</p>` +
    `<p style="${f}"><strong>This visit</strong><br>` + results.map((e) => esc(eventLine(e))).join("<br>") + `</p>` +
    (lead.notes ? `<p style="${f};white-space:pre-wrap"><strong>Notes</strong><br>${esc(lead.notes)}</p>` : "");

  await sendEmail(env, { subject, text, html });
}

async function sendDigest(env, now) {
  if (!env.DB) return;
  const yesterday = detroitDate(new Date(now.getTime() - 24 * 3600e3));
  // Pull a generous window, then keep only events on yesterday's Detroit date.
  const { results } = await env.DB.prepare(
    "SELECT e.lead_id, e.type, e.detail, e.path, e.ts, l.business, l.city FROM events e " +
    "LEFT JOIN leads l ON l.id = e.lead_id WHERE e.ts > ? ORDER BY e.ts"
  ).bind(new Date(now.getTime() - 50 * 3600e3).toISOString()).all();
  const byLead = new Map();
  for (const e of results) {
    if (detroitDate(new Date(e.ts)) !== yesterday) continue;
    if (!byLead.has(e.lead_id)) byLead.set(e.lead_id, []);
    byLead.get(e.lead_id).push(e);
  }
  if (!byLead.size) return; // no activity, no email

  const sections = [...byLead.values()].map((events) => {
    const first = events[0], last = events[events.length - 1];
    return {
      title: `${first.business || first.lead_id}${first.city ? ` (${first.city})` : ""} [${first.lead_id}]`,
      seen: `First seen ${detroitTime(new Date(first.ts))}, last seen ${detroitTime(new Date(last.ts))}`,
      lines: events.map(eventLine),
    };
  });
  const text =
    `Lead activity for ${yesterday}\n\n` +
    sections.map((s) => `${s.title}\n${s.seen}\n${s.lines.map((l) => `  ${l}`).join("\n")}`).join("\n\n") + `\n`;
  const f = "font-family:system-ui,sans-serif;font-size:15px;line-height:1.5";
  const html =
    `<h2 style="font-family:system-ui,sans-serif">Lead activity for ${esc(yesterday)}</h2>` +
    sections.map((s) => `<p style="${f}"><strong>${esc(s.title)}</strong><br>${esc(s.seen)}<br>${s.lines.map(esc).join("<br>")}</p>`).join("");
  const n = byLead.size;
  await sendEmail(env, { subject: `Lead activity: ${n} lead${n === 1 ? "" : "s"} on ${yesterday}`, text, html });
}
