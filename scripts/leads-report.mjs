#!/usr/bin/env node
// Who clicked my outreach emails.
//
//   node scripts/leads-report.mjs            (remote D1)
//   node scripts/leads-report.mjs --local    (wrangler dev's local D1)
//
// One line per lead: visits, engaged yes/no, last seen (Detroit time), and top actions,
// most recently seen first. Leads that never visited are listed at the end.

import path from 'node:path';
import { execFileSync } from 'node:child_process';

const local = process.argv.includes('--local');
const WORKER_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'worker');

const query = `
SELECT l.id, l.business, l.city, l.sent_at,
       SUM(CASE WHEN e.type = 'visit' THEN 1 ELSE 0 END) AS visits,
       MAX(CASE WHEN e.type = 'engaged' THEN 1 ELSE 0 END) AS engaged,
       MAX(e.ts) AS last_seen,
       GROUP_CONCAT(e.type) AS types
FROM leads l LEFT JOIN events e ON e.lead_id = l.id
GROUP BY l.id
ORDER BY last_seen IS NULL, last_seen DESC`;

const raw = execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'journeyman-tracking', local ? '--local' : '--remote', '--json', '--command', query],
  { cwd: WORKER_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const rows = JSON.parse(raw)[0].results;

const when = (ts) => ts
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ts))
  : 'never';
const topActions = (types) => {
  const counts = {};
  for (const t of (types || '').split(',')) if (t && t !== 'visit' && t !== 'engaged') counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${t} x${n}`).join(', ') || '-';
};

const table = rows.map((r) => ({
  lead: `${r.business || '(no name)'}${r.city ? ` (${r.city})` : ''} [${r.id}]`,
  visits: String(r.visits || 0),
  engaged: r.engaged ? 'yes' : 'no',
  last: when(r.last_seen),
  actions: topActions(r.types),
}));
const heads = { lead: 'Lead', visits: 'Visits', engaged: 'Engaged', last: 'Last seen', actions: 'Top actions' };
const width = Object.fromEntries(Object.keys(heads).map((k) => [k, Math.max(heads[k].length, ...table.map((t) => t[k].length))]));
const line = (t) => Object.keys(heads).map((k) => t[k].padEnd(width[k])).join('  ');
console.log(line(heads));
console.log(Object.keys(heads).map((k) => '-'.repeat(width[k])).join('  '));
table.forEach((t) => console.log(line(t)));
console.log(`\n${rows.length} lead${rows.length === 1 ? '' : 's'}, ${rows.filter((r) => r.last_seen).length} visited, ${rows.filter((r) => r.engaged).length} engaged.`);
