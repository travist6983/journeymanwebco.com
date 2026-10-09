# Concept preview template

One template, driven by JSON, that renders a multi-page concept site for any prospect into `preview/<slug>/`.

```
templates/
  render.mjs          page + section renderer (pure functions)
  site.css, site.js   the theme; copied to preview/theme/ on every build
  presets/            per-vertical defaults: base.json + auto-repair, collision, machine-shop, hvac, plumbing, landscaping, towing
sites/<slug>.json     one file per prospect: facts, brand, photos, copy overrides
scripts/build-preview.mjs
```

## Build

```bash
node scripts/build-preview.mjs sites/demo-auto.json     # one site
node scripts/build-preview.mjs --all                    # every sites/*.json
node scripts/build-preview.mjs --all --serve            # build, then serve the repo at http://localhost:8080/
node scripts/build-preview.mjs --new kokis-auto --preset auto-repair   # scaffold sites/kokis-auto.json
```

Output is committed like any other preview. Pages live at `/preview/<slug>/`, `/preview/<slug>/services/`, etc. The theme is shared at `/preview/theme/`, so a CSS tweak rebuilds every site at once (`--all`).

`sites/` and `templates/` are excluded from GitHub Pages in `_config.yml`.

## How a site is resolved

`presets/base.json` → `presets/<preset>.json` → `sites/<slug>.json`, deep-merged in that order. Anything a site JSON leaves out comes from the preset, so a minimal site needs only `slug`, `preset`, `business` and `brand.accent`.

Copy strings accept `{{name}} {{city}} {{state}} {{street}} {{road}} {{phone}} {{established}} {{years}} {{rating}} {{reviews}}`.

## Site JSON

```jsonc
{
  "slug": "demo-auto",                 // folder under preview/; lowercase, digits, dashes
  "preset": "auto-repair",             // a file in presets/
  "concept": { "currentSite": null },  // "theirsite.com" switches the top strip to redesign wording
  "business": {
    "name": "...", "legalName": "...", "tagline": "...", "description": "...",
    "phone": "(586) 555-0148", "phoneDisplay": "...", "email": "...",
    "established": 2009,
    "address": { "street": "...", "city": "...", "state": "MI", "zip": "..." },
    "road": "Van Dyke at 18 Mile",     // short location for the hero; falls back to the address
    "placeId": "ChIJ...",              // from scored.json; makes Directions open the exact listing
    "rating": 4.8, "reviewCount": 312, // omit both and the rating card becomes a "since" card
    "hours": [ { "days": "Mon–Fri", "open": "7:30 AM", "close": "6:00 PM" }, { "days": "Sun", "closed": true } ],
    "serviceArea": ["Sterling Heights", "Utica"],
    "footerBlurb": "..."
  },
  "brand": {
    "accent": "#1D4ED8", "dark": "#0B1220",   // accentInk (text on accent) is computed; override if needed
    "fontHeading": "Bricolage Grotesque", "fontBody": "Inter",   // see FONT_WEIGHTS in render.mjs for the known list
    "logoIcon": "wrench", "logoImage": null, "logoText": null, "logoSub": "Sterling Heights · Since 2009",
    "css": ""                                  // extra CSS appended to the page's <style>
  },
  "photos": {
    "hero": "https://...", "about": "...", "about2": "...",
    "services": { "<service key>": "..." },
    "gallery": [ { "src": "...", "caption": "..." } ],
    "pages": { "services": "..." }             // inner-page hero photo; defaults to hero
  },
  "content": {
    "hero": { "eyebrow": "...", "heading": "...", "sub": "...", "bullets": ["..."] },
    "services": [ { "key": "brakes", "icon": "brake", "title": "...", "blurb": "...", "detail": "...", "includes": ["..."], "photo": "..." } ],
    "about": { "heading": "...", "body": "...", "body2": "...", "checks": ["..."], "stats": [ { "value": "16+", "count": 16, "suffix": "+", "label": "..." } ] },
    "process": [ { "title": "...", "body": "..." } ],
    "reviews": [ { "name": "Marcus T.", "rating": 5, "when": "2 weeks ago", "text": "..." } ],   // empty → tasteful placeholder card
    "faqs": [ { "q": "...", "a": "..." } ],
    "badges": [ { "icon": "shield", "title": "...", "sub": "..." } ],
    "beforeAfter": { "before": "...", "after": "...", "caption": "..." },   // collision preset shows a drag slider
    "team": [ { "name": "...", "role": "...", "photo": "..." } ],
    "cta": { "eyebrow": "...", "heading": "...", "body": "..." },
    "form": { "title": "...", "hint": "...", "submit": "...", "fields": [ { "name": "vehicle", "label": "...", "type": "text|tel|email|textarea|select|file", "options": [], "placeholder": "", "required": true, "full": true } ] }
  },
  "labels": { "book": "Request an appointment", "bookShort": "Book" },   // any key from base.json labels
  "disablePages": ["reviews"],            // drop a whole page
  "disableSections": ["gallery", "faq"],  // drop a section type everywhere
  "pages": [ ... ]                        // replace the preset's page list entirely (see base.json for the shape)
}
```

Unsplash URLs (`https://images.unsplash.com/photo-...`) get an automatic `srcset`; any other URL is used as-is. A relative path like `img/front.jpg` resolves inside `preview/<slug>/`, so drop the shop's own photos in `preview/<slug>/img/` (the build leaves that folder alone).

Section types: `hero trust services serviceDetails about process reviews gallery beforeAfter faq cta serviceArea badges contact map text team`. A section with nothing to show renders nothing, so a thin site stays clean. Icons are the keys of `ICONS` in render.mjs.

Only facts you can verify belong on a real prospect's preview: rating, review count, years, address, hours. Leave reviews empty unless you have the actual text; the placeholder card says they'll appear automatically on the live site. `sites/demo-auto.json` is a fictional shop with every section filled in for show.

## Tracking

Every page keeps the `jwc-endpoint` meta and loads `/config.js` and `/track.js`, so `?r=<lead id>` works exactly as before and survives navigation between pages (sessionStorage). Prospect-facing buttons use `preview_call`, `preview_book`, `preview_directions`. The yellow strip and the bottom-right pill text Travis and are tracked as `click_text`; the footer credit uses `click_email` / `click_call`.
