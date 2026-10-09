#!/usr/bin/env node
// Build concept-preview sites from JSON.
//
//   node scripts/build-preview.mjs sites/demo-auto.json       one site
//   node scripts/build-preview.mjs --all                      every sites/*.json
//   node scripts/build-preview.mjs --all --serve [port]       build, then serve the repo root (default :8080)
//   node scripts/build-preview.mjs --new <slug> --preset auto-repair   scaffold sites/<slug>.json
//
// Output: preview/<slug>/index.html (+ one folder per extra page) and preview/theme/{site.css,site.js}.
// See templates/README.md for the JSON format.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolveSite, renderSite } from '../templates/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TPL = path.join(ROOT, 'templates');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${f}: ${e.message}`); } };
const presets = Object.fromEntries(fs.readdirSync(path.join(TPL, 'presets')).filter((f) => f.endsWith('.json'))
  .map((f) => [f.replace(/\.json$/, ''), readJson(path.join(TPL, 'presets', f))]));

if (flag('--new')) {
  const slug = opt('--new'), preset = opt('--preset', 'auto-repair');
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) { console.error('Usage: --new <slug> [--preset <name>]  (slug: lowercase letters, digits, dashes)'); process.exit(1); }
  if (!presets[preset]) { console.error(`No preset "${preset}". Have: ${Object.keys(presets).filter((p) => p !== 'base').join(', ')}`); process.exit(1); }
  const out = path.join(ROOT, 'sites', `${slug}.json`);
  if (fs.existsSync(out)) { console.error(`${out} already exists.`); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify({
    slug, preset,
    concept: { currentSite: null },
    business: {
      name: 'Business Name', tagline: 'What they do, in {{city}}', phone: '(248) 555-0100', email: '', established: 2010,
      address: { street: '123 Main St', city: 'City', state: 'MI', zip: '48000' }, placeId: '', road: '',
      rating: null, reviewCount: null,
      hours: [{ days: 'Mon–Fri', open: '8:00 AM', close: '6:00 PM' }, { days: 'Sat', open: '9:00 AM', close: '2:00 PM' }, { days: 'Sun', closed: true }],
      serviceArea: [],
    },
    brand: { accent: presets[preset].brand?.accent || '#1E40AF' },
    photos: {},
    content: { reviews: [] },
  }, null, 2) + '\n');
  console.log(`Wrote ${path.relative(ROOT, out)}. Fill it in, then: node scripts/build-preview.mjs ${path.relative(ROOT, out)}`);
  process.exit(0);
}

let files = args.filter((a) => a.endsWith('.json'));
if (flag('--all')) files = fs.readdirSync(path.join(ROOT, 'sites')).filter((f) => f.endsWith('.json')).map((f) => path.join('sites', f));
if (!files.length && !flag('--serve')) { console.error('Usage: node scripts/build-preview.mjs <sites/x.json ...> | --all [--serve [port]] | --new <slug> --preset <name>'); process.exit(1); }

// theme
const themeDir = path.join(ROOT, 'preview', 'theme');
fs.mkdirSync(themeDir, { recursive: true });
for (const f of ['site.css', 'site.js']) fs.copyFileSync(path.join(TPL, f), path.join(themeDir, f));

let built = 0;
for (const f of files) {
  const raw = readJson(path.resolve(ROOT, f));
  if (!raw.slug || !/^[a-z0-9-]+$/.test(raw.slug)) throw new Error(`${f}: "slug" must be lowercase letters, digits and dashes`);
  if (raw.preset && !presets[raw.preset]) throw new Error(`${f}: unknown preset "${raw.preset}". Have: ${Object.keys(presets).filter((p) => p !== 'base').join(', ')}`);
  const site = resolveSite(raw, presets);
  const outDir = path.join(ROOT, 'preview', site.slug);
  // remove pages from a previous build that no longer exist
  if (fs.existsSync(outDir)) for (const d of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (d.isDirectory() && d.name !== 'img' && fs.existsSync(path.join(outDir, d.name, 'index.html')) && !site.pages.some((p) => p.slug === d.name)) fs.rmSync(path.join(outDir, d.name), { recursive: true });
  }
  const pages = renderSite(site);
  for (const p of pages) {
    const out = path.join(outDir, p.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, p.html);
  }
  built++;
  console.log(`${site.slug}: ${pages.length} page${pages.length === 1 ? '' : 's'} → preview/${site.slug}/  (${pages.map((p) => p.url.replace(site.base, '/') ).join(' ')})`);
}
if (built) console.log(`Built ${built} site${built === 1 ? '' : 's'}. Theme → preview/theme/`);

if (flag('--serve')) {
  const port = +opt('--serve', 8080) || 8080;
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };
  http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`Serving ${ROOT} at http://localhost:${port}/  (previews at /preview/<slug>/)`));
}
