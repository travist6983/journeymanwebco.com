#!/usr/bin/env node
// Import outreach leads into the journeyman-tracking D1 database.
//
//   node scripts/import-leads.mjs path/to/leads.csv            (remote D1)
//   node scripts/import-leads.mjs path/to/leads.csv --local    (wrangler dev's local D1)
//
// CSV columns: business, contact, email, city, trade, sent_at, notes (an id column is optional).
// Rows without an id get a random one (7 lowercase letters/digits). Every row is upserted,
// then the CSV is written back with an id column and a ready-to-paste link column.
// Keep lead CSVs out of this repo: it's public. prospects/ is gitignored.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const COLUMNS = ['business', 'contact', 'email', 'city', 'trade', 'sent_at', 'notes'];
const LEAD_ID = /^[a-z0-9]{6,8}$/;
const SITE = 'https://journeymanwebco.com/?r=';
const WORKER_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'worker');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const local = args.includes('--local');
if (!file) {
  console.error('Usage: node scripts/import-leads.mjs leads.csv [--local]');
  process.exit(1);
}

// RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}
const csvField = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const [header, ...body] = parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const cols = header.map((h) => h.trim().toLowerCase());
if (!cols.includes('business')) {
  console.error(`No "business" column found. Expected: ${COLUMNS.join(', ')}`);
  process.exit(1);
}
const leads = body.map((cells) => Object.fromEntries(cols.map((c, i) => [c, (cells[i] || '').trim()])));

// ids: keep valid ones, make new ones for the rest
const used = new Set(leads.map((l) => l.id).filter((id) => LEAD_ID.test(id || '')));
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
const newId = () => {
  let id;
  do id = Array.from({ length: 7 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  while (used.has(id));
  used.add(id);
  return id;
};
let created = 0;
for (const l of leads) {
  if (l.id && !LEAD_ID.test(l.id)) {
    console.error(`Row for "${l.business}" has an invalid id "${l.id}" (6 to 8 lowercase letters/digits).`);
    process.exit(1);
  }
  if (!l.id) { l.id = newId(); created++; }
}

// upsert
const sql = (v) => (v ? `'${String(v).replace(/'/g, "''")}'` : 'NULL');
const statements = leads.map((l) =>
  `INSERT INTO leads (id, ${COLUMNS.join(', ')}) VALUES (${[l.id, ...COLUMNS.map((c) => l[c])].map(sql).join(', ')}) ` +
  `ON CONFLICT(id) DO UPDATE SET ${COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')};`
);
const tmp = path.join(os.tmpdir(), `leads-${process.pid}.sql`);
fs.writeFileSync(tmp, statements.join('\n') + '\n');
try {
  execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'journeyman-tracking', local ? '--local' : '--remote', '--file', tmp, '--yes'],
    { cwd: WORKER_DIR, stdio: ['ignore', 'ignore', 'inherit'] });
} finally {
  fs.rmSync(tmp, { force: true });
}

// write the CSV back: id first, the original columns, then the link to paste into emails
const outCols = ['id', ...cols.filter((c) => c !== 'id' && c !== 'link'), 'link'];
const out = [outCols.join(',')].concat(
  leads.map((l) => outCols.map((c) => csvField(c === 'link' ? SITE + l.id : l[c] || '')).join(','))
);
fs.writeFileSync(file, out.join('\n') + '\n');

console.log(`Upserted ${leads.length} lead${leads.length === 1 ? '' : 's'} into ${local ? 'local' : 'remote'} D1 (${created} new id${created === 1 ? '' : 's'}).`);
console.log(`Wrote ids and links back to ${file}.`);
