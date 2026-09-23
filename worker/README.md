# journeyman-contact

Cloudflare Worker behind journeymanwebco.com. It does three things:

| Route | What it does |
|---|---|
| `POST /` | Free website review form. Checks Turnstile, then emails the request to travis@journeymanwebco.com through Resend. |
| `POST /t` | Lead click tracking for outreach emails. Stores events in D1 and emails an alert when a lead engages. |
| cron | Daily digest of yesterday's lead activity at 7:30 AM Detroit time. |

Deployed at `https://journeyman-contact.travisjterry.workers.dev`. The site's review form points at it through `data-endpoint` on `#review-form`, and `track.js` posts to the same host at `/t`.

## Secrets and bindings

| Name | Kind | Notes |
|---|---|---|
| `RESEND_API_KEY` | secret | Sending domain `send.journeymanwebco.com` is verified in Resend. |
| `TURNSTILE_SECRET_KEY` | secret | Must belong to the Turnstile widget whose site key is on the page (`0x4AAAAAAFAOsoaBgRf6Lcxi`). |
| `DB` | D1 binding | Database `journeyman-tracking`, configured in `wrangler.jsonc`. |

Set secrets in the Cloudflare dashboard (Workers & Pages > journeyman-contact > Settings > Variables and Secrets) or with `npx wrangler secret put NAME`. Never put them in a file.

## One-time D1 setup

```bash
cd worker
npx wrangler d1 create journeyman-tracking          # prints a database_id
# paste that database_id into wrangler.jsonc (replacing the zeros)
npx wrangler d1 migrations apply journeyman-tracking --remote
npx wrangler deploy
```

Schema lives in `migrations/`. Add new files there (`0002_...sql`) and apply them with the same `migrations apply` command.

## How lead tracking works

1. Each lead gets a random id: 6 to 8 lowercase letters and digits, never a name or email. Every outreach email links to `https://journeymanwebco.com/?r=<id>`.
2. `track.js` (on the home page, about 2 KB) reads `?r=`, checks the format, keeps it in `sessionStorage` for that tab, and removes it from the address bar with `history.replaceState`. No cookies, no third-party scripts. Without an `r` code it does nothing.
3. Events go to `POST /t` with `navigator.sendBeacon` (falling back to `fetch` with `keepalive`). Nothing waits on them and nothing on the page depends on them.

Email security scanners (Outlook Safe Links, Mimecast, Proofpoint) open links on their own, so:

- **visit** is sent only after the page has been on screen for 5 straight seconds.
- **engaged** is sent only after scrolling past 30% of the page or clicking any tracked element (once per tab session).
- Automated browsers (`navigator.webdriver`) never send, and the Worker drops bot, crawler, scanner, and headless user agents.
- Alerts fire only on **engaged**.

### Event types

| Type | Sent when |
|---|---|
| `visit` | 5 seconds on screen |
| `engaged` | scrolled past 30%, or first tracked click |
| `click_call` | any phone link (detail says where: call bar, signature, call block, footer, after form, form error) |
| `click_email` | any email link |
| `click_review_cta` | header, hero, or call bar "free review" buttons |
| `click_package` | a "Start with ..." button (detail is the package) |
| `toggle_pricing` | Monthly / Pay upfront toggle (detail is the view) |
| `see_work` | the A-1 links |
| `form_start` | first focus in the review form |
| `form_submit` | the review form is submitted (detail is the package) |

Tracked elements are marked in `index.html` with `data-track="<type>"` and optional `data-track-detail="..."`. To track something new, add the attribute and, if it's a new type, add it to `EVENT_TYPES` in `src/index.js`.

### What the Worker checks on `/t`

- `Origin` must be `https://journeymanwebco.com` (403 otherwise).
- `r` must match `^[a-z0-9]{6,8}$` and exist in `leads`; unknown ids are ignored but still get 204.
- `type` must be on the allowlist above.
- At most 50 events per lead per hour.
- Stores `CF-IPCountry` and the user agent cut to 160 characters. The IP address is never stored.

### Alerts

The first `engaged` event for a lead on a Detroit calendar day emails travis@journeymanwebco.com from form@send.journeymanwebco.com, subject `Lead engaged: {business} ({city})`. The body has the lead's business, contact, trade, city, when the outreach email went out, a mailto link, a tel link if a phone number appears in the lead's notes (there's no phone column), and everything that lead did in the last two hours. It's sent with `ctx.waitUntil`, so the page's request isn't held up.

### Daily digest

Cron triggers are always UTC, and Detroit is UTC-4 in summer (EDT) and UTC-5 in winter (EST). `wrangler.jsonc` schedules two runs, `30 11 * * *` and `30 12 * * *`. 11:30 UTC is 7:30 AM EDT and 12:30 UTC is 7:30 AM EST; the Worker only sends from the run that lands in Detroit's 7 AM hour, so the digest arrives at 7:30 AM all year. It lists yesterday's activity per lead (first seen, last seen, every event) and sends nothing if there was none.

### Review form and leads

If a visitor came in through a lead link, the review form sends that code as `leadId`. When it matches a lead, the review request email starts with `Lead: {business} ({leadId})`. Without a match, the email is the same as always.

## Working with leads

Keep lead CSVs out of this repo: it is public (GitHub Pages serves it). `prospects/` is gitignored.

CSV columns: `business, contact, email, city, trade, sent_at, notes` (plus `id` once imported).

```bash
node scripts/import-leads.mjs path/to/leads.csv     # upsert into remote D1
node scripts/leads-report.mjs                        # who visited, engaged, and what they did
```

`import-leads.mjs` gives rows without an id a random 7-character one, upserts every row, and writes the CSV back with an `id` column and a `link` column (`https://journeymanwebco.com/?r=<id>`) ready to paste into emails. Running it again keeps existing ids. Both scripts take `--local` to work against `wrangler dev`'s local database.

`queries.sql` has ready-to-paste queries for the D1 console (Cloudflare dashboard > Storage & Databases > D1 > journeyman-tracking > Console), including how to delete everything about one lead when someone asks.

## Privacy

The privacy page (`/privacy/`) explains the email links in plain English: a short code identifies the business, the site records the pages and buttons used, no cookies, nothing follows them elsewhere, and they can email to have it deleted. To delete a lead, run the two `DELETE` statements at the bottom of `queries.sql`.

## Local testing

`wrangler dev` reads `worker/.dev.vars` (gitignored). These variables exist only for local testing and must never be set in production:

| Variable | Local value | Effect |
|---|---|---|
| `TRACK_ORIGIN` | `http://127.0.0.1:8766` | Lets a locally served copy of the site post to `/t`. |
| `EMAIL_DRY_RUN` | `1` or `http://127.0.0.1:8799/mail` | Logs emails (or posts them to a local catcher) instead of sending. |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` | Cloudflare's always-pass test secret. |
| `TURNSTILE_HOSTNAMES` | `example.com` | The hostname Cloudflare's test keys report. |
| `DIGEST_ANY_HOUR` | `1` | Lets the digest run outside 7 AM Detroit time. |
| `RESEND_API_KEY` | anything | Required to be present; unused in dry run. |

```bash
cd worker
npx wrangler d1 migrations apply journeyman-tracking --local
node ../scripts/import-leads.mjs some-test-leads.csv --local
npx wrangler dev --port 8787 --test-scheduled
curl "http://127.0.0.1:8787/__scheduled?cron=30+11+*+*+*"   # run the digest now
```
