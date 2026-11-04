# Ross Towing preview

Live at https://journeymanwebco.com/preview/ross-towing/. Plain static files on GitHub Pages: no build step, no backend. Commit and push, and the page updates in about a minute.

| File | What it is |
|---|---|
| `index.html` | All copy, markup and CSS |
| `journey.js` | The scroll journey (road and truck drawings only) |
| `src/config.js` | Every switch: form endpoints, Towbook mode, auction Sheet URL |
| `src/main.js` | Wires the freight form, the tow request / Towbook block and the auction banner |
| `src/forms.js` | Shared form behavior: inline errors, spam checks, posting |
| `src/messages.js` | `formatFreightQuote()` and `formatTowRequest()`: the text the office receives |
| `src/auction.js` | `getAuctionState()`, the CSV parser and the .ics builder |
| `data/auction.json` | Auction date fallback (Option A) |
| `docs/auction-sheet-template.csv` | Starter file for the auction Sheet (Option B) |
| `tests/` | Unit tests (`npm test`) |

This README isn't published: `_config.yml` excludes README files.

## Forms

Both forms are static. They POST to a form service, which emails the office.

1. Create a form at a service such as Formspree, Basin or Web3Forms, and set the recipient email in that service's dashboard.
2. Paste the endpoint into `src/config.js`:
   - `FORM_ENDPOINT_FREIGHT` for the freight quote
   - `FORM_ENDPOINT_TOW` for the tow request (used only when `TOWBOOK_MODE` is `"none"`)
3. Set `CONTACT_EMAIL` to the office address. It's the "email us" link in the fallback message.

| Service | Endpoint looks like | Extra config |
|---|---|---|
| Formspree | `https://formspree.io/f/abcdwxyz` | none |
| Basin | `https://usebasin.com/f/abc123` | none |
| Web3Forms | `https://api.web3forms.com/submit` | `FORM_EXTRA_FIELDS: { access_key: "..." }` |

`FORM_ENCODING` is `"json"` by default. Set it to `"form"` for a service that only takes urlencoded posts. No code changes either way.

Every post includes the raw fields, a `subject` / `_subject`, and a `message` field with the readable summary, for example:

```
Load: 2 pieces, excavator
Dimensions: 24 ft L x 8.5 ft W x 10 ft H
Weight: 42,000 lbs (estimate)
Equipment: Chains, Binders, Edge protectors
```

While an endpoint is empty, submitting shows "Thanks. Online quotes are almost ready. For now, please call 248-356-6011 or email us." and sends nothing. The form is never cleared on an error or a fallback.

Spam: a hidden honeypot field (`website`) and a 3 second minimum time on the page. No CAPTCHA. Bots that trip the honeypot see a normal "thanks" and nothing is sent.

## Towbook

Ross dispatches in Towbook. The tow block switches with one value in `src/config.js`. In every mode the big "Call dispatch 24/7: 248-356-6011" button comes first.

| `TOWBOOK_MODE` | What visitors see | Needs |
|---|---|---|
| `"none"` (now) | "Not urgent? Send us the details": name, phone, pickup location (with an optional "Use my location" button), vehicle, what happened. Posts to `FORM_ENDPOINT_TOW`, or shows the call-us fallback while it's empty | nothing |
| `"link"` (expected final) | A "Request a tow online" button that opens `TOWBOOK_URL` in a new tab. Towbook's Web Request Form drops the request into Towbook as a call | `TOWBOOK_URL` |
| `"embed"` | `TOWBOOK_URL` in a lazy loaded iframe (fixed height, no layout shift) with "Having trouble? Call 248-356-6011" and an "open the form in a new tab" link under it | `TOWBOOK_URL` that allows framing |

To switch: set `TOWBOOK_URL` to the https link from Towbook, set `TOWBOOK_MODE`, commit, push. "link" or "embed" without a valid https `TOWBOOK_URL` falls back to "none" and logs a console warning.

About "embed": Towbook doesn't document embedding. Before turning it on, check whether Towbook allows framing:

```bash
curl -sI "https://the-towbook-link" | grep -i -E 'x-frame-options|frame-ancestors'
```

If either header shows up, use "link". The page falls back to the link button on its own when Towbook can't be reached or the frame never loads, but a browser can't tell the page when Towbook refuses to be framed. That's why the new tab link always sits under the frame.

"Use my location" asks for location only when tapped, never on load. It fills the field with coordinates and a Google Maps link, for example `42.47612, -83.28741 (https://www.google.com/maps?q=42.47612,-83.28741)`.

### Towbook QR code

There's a hidden slot under the tow block for the QR code Jennifer is sending. To show it:

1. Save the image as `img/towbook-qr.png`.
2. Set `TOWBOOK_QR_SRC: "img/towbook-qr.png"` in `src/config.js`.
3. Replace the caption placeholder `[QR CAPTION: confirm what this QR does]` in `index.html` with what Jennifer says it does. Don't guess.

The slot stays hidden while `TOWBOOK_QR_SRC` is empty or the file is missing.

## Auction date

Public auctions run about every two months. The auctions block shows the next date from 30 days before through the auction day ("Next public auction: Saturday, December 12", plus time and location), with an "Add to calendar" button and a close button. On the day it says "Public auction today". From the day after, and whenever nothing is scheduled, it shows "Public auctions about every two months. Call 248-356-6011 for the next date."

All dates follow Detroit time, whatever time zone a visitor is in. Visitors who close the banner don't see it again for that auction date.

To preview any date on the live page without changing anything, add `?auction=2026-12-12` to the URL.

### Option A: care plan (Travis updates it)

1. Leave `AUCTION_SHEET_CSV_URL` empty in `src/config.js`.
2. Edit `data/auction.json`:
   ```json
   { "date": "2026-12-12", "time": "10:00 AM", "location": "21360 Telegraph Rd, Southfield, MI 48033", "showFromDaysBefore": 30, "note": null }
   ```
3. Commit and push. It's live in about a minute. Set `date` back to `null` after the auction if no next date is known (it hides itself either way).

### Option B: self serve (Jennifer edits a Google Sheet)

Set up once:

1. Create a Google Sheet. Row 1 is the header, exactly: `date`, `time`, `location`, `note`. Or import `docs/auction-sheet-template.csv` (File > Import). Its example row has a past date, so it never shows.
2. Type each auction on its own row. `date` as `2026-12-12` (`12/12/2026` also works). `time`, `location` and `note` are optional. A blank location uses the address from `data/auction.json`.
3. File > Share > Publish to web. Under Link, pick the sheet tab (not "Entire document") and "Comma-separated values (.csv)". Click Publish and copy the link. It looks like `https://docs.google.com/spreadsheets/d/e/<id>/pub?gid=0&single=true&output=csv`.
4. Paste it into `AUCTION_SHEET_CSV_URL` in `src/config.js`, commit and push once.

After that, edits in the Sheet show on the site on their own. Google refreshes published CSVs on its own schedule, usually within about 5 minutes, and the page keeps what it read for 10 minutes per visitor session. So allow up to about 15 minutes.

Rules the page follows:

- Several rows are fine. It uses the soonest date that hasn't passed. Old rows can stay.
- Blank rows are ignored. A row with a date it can't read is skipped with a console warning. The page never breaks.
- The Sheet is read after the page has loaded, with a 4 second timeout. If it's slow, unreachable, unpublished or empty, the page uses `data/auction.json` instead.
- `showFromDaysBefore` in `data/auction.json` applies to the Sheet too.

Screenshots for Jennifer's how-to (to capture):

1. `[SCREENSHOT: new Sheet with date, time, location, note in row 1 and one auction in row 2]`
2. `[SCREENSHOT: File menu > Share > Publish to web]`
3. `[SCREENSHOT: Publish to web dialog, sheet tab and "Comma-separated values (.csv)" selected]`
4. `[SCREENSHOT: the published link to copy]`
5. `[SCREENSHOT: the Sheet after adding the next auction date]`

## Tests

Node 18 or newer, no install needed:

```bash
cd preview/ross-towing
npm test
```

Covers `formatFreightQuote` (every field, only the required ones, mixed units, "Other" equipment), `getAuctionState` (no rows, past only, 31 and 30 days out, today, yesterday, two upcoming rows, DST changes), the CSV parser and the .ics file.
