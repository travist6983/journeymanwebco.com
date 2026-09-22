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

export default {
  async fetch(request, env) {
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
    if (!verdict.success || !ALLOWED_HOSTNAMES.includes(verdict.hostname)) {
      if (verdict.success) console.warn("Turnstile token from unexpected hostname", verdict.hostname);
      return json({ error: "Bot check failed. Please reload and try again." }, 403, origin);
    }

    const rows = [
      ["Website", website || "(none yet)"],
      ["Business", business],
      ["Name", name],
      ["Phone", phone],
      ["Email", email],
    ];

    const text =
      `Free website review request\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nNotes:\n${notes || "(none)"}\n`;

    const html =
      `<h2 style="font-family:system-ui,sans-serif">Free website review request</h2>` +
      `<p style="font-family:system-ui,sans-serif">` +
      rows.map(([k, v]) =>
        k === "Email"
          ? `<strong>${k}:</strong> <a href="mailto:${esc(v)}">${esc(v)}</a>`
          : `<strong>${k}:</strong> ${esc(v)}`
      ).join("<br>") +
      `</p><pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:15px">${esc(notes || "(no notes)")}</pre>`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Free review request: ${business}`,
        text,
        html,
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error("Resend error", send.status, detail);
      return json({ error: `Could not send right now. ${FALLBACK}` }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};
