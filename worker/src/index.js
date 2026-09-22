const ALLOWED_ORIGINS = [
  "https://journeymanwebco.com",
  "https://www.journeymanwebco.com",
];

const TO = "travis@journeymanwebco.com";
const FROM = "Journeyman Web Co. <form@send.journeymanwebco.com>";

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

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid request" }, 400, origin);
    }

    // Honeypot: a field real people never see or fill.
    if (data.company) {
      return json({ ok: true }, 200, origin);
    }

    const name = String(data.name || "").trim().slice(0, 120);
    const email = String(data.email || "").trim().slice(0, 200);
    const phone = String(data.phone || "").trim().slice(0, 40);
    const message = String(data.message || "").trim().slice(0, 5000);
    const token = String(data.turnstileToken || "");

    if (!name || !email || !message) {
      return json({ error: "Please fill in your name, email, and message." }, 400, origin);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ error: "That email address doesn't look right." }, 400, origin);
    }

    // Bot check
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
    const verdict = await verify.json();
    if (!verdict.success) {
      return json({ error: "Bot check failed. Please reload and try again." }, 403, origin);
    }

    const text =
      `New contact form submission\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      (phone ? `Phone: ${phone}\n` : "") +
      `\n${message}\n`;

    const html =
      `<h2 style="font-family:system-ui,sans-serif">New contact form submission</h2>` +
      `<p style="font-family:system-ui,sans-serif"><strong>Name:</strong> ${esc(name)}<br>` +
      `<strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a><br>` +
      (phone ? `<strong>Phone:</strong> ${esc(phone)}<br>` : "") +
      `</p><pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:15px">${esc(message)}</pre>`;

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
        subject: `New inquiry from ${name}`,
        text,
        html,
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error("Resend error", send.status, detail);
      return json({ error: "Could not send right now. Please email travis@journeymanwebco.com." }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};
