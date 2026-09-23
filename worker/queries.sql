-- Ready-to-paste queries for the journeyman-tracking D1 database.
-- Cloudflare dashboard > Storage & Databases > D1 > journeyman-tracking > Console,
-- or: npx wrangler d1 execute journeyman-tracking --remote --command "<query>"
-- Times are stored in UTC (ISO 8601). Detroit is UTC-4 in summer, UTC-5 in winter.

-- Latest 50 events, newest first
SELECT e.ts, l.business, l.city, e.type, e.detail, e.path, e.country
FROM events e LEFT JOIN leads l ON l.id = e.lead_id
ORDER BY e.ts DESC LIMIT 50;

-- Leads who engaged, most recent first
SELECT l.id, l.business, l.contact, l.city, l.email, MAX(e.ts) AS last_engaged
FROM events e JOIN leads l ON l.id = e.lead_id
WHERE e.type = 'engaged'
GROUP BY l.id ORDER BY last_engaged DESC;

-- Per-lead summary: visits, engaged, last seen, what they clicked
SELECT l.id, l.business, l.city,
       SUM(e.type = 'visit') AS visits,
       MAX(e.type = 'engaged') AS engaged,
       MAX(e.ts) AS last_seen,
       GROUP_CONCAT(CASE WHEN e.type NOT IN ('visit', 'engaged') THEN e.type END) AS actions
FROM leads l LEFT JOIN events e ON e.lead_id = l.id
GROUP BY l.id ORDER BY last_seen IS NULL, last_seen DESC;

-- One lead's timeline (replace abc1234)
SELECT ts, type, detail, path, country FROM events WHERE lead_id = 'abc1234' ORDER BY ts;

-- Last 24 hours of activity
SELECT e.ts, l.business, e.type, e.detail
FROM events e LEFT JOIN leads l ON l.id = e.lead_id
WHERE e.ts > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')
ORDER BY e.ts;

-- Leads who never opened the link
SELECT l.id, l.business, l.city, l.sent_at
FROM leads l LEFT JOIN events e ON e.lead_id = l.id
WHERE e.id IS NULL ORDER BY l.sent_at;

-- Who clicked call or email, or filled in the review form
SELECT e.ts, l.business, e.type, e.detail
FROM events e JOIN leads l ON l.id = e.lead_id
WHERE e.type IN ('click_call', 'click_email', 'form_start', 'form_submit')
ORDER BY e.ts DESC;

-- Find a lead's id and link
SELECT id, business, 'https://journeymanwebco.com/?r=' || id AS link FROM leads WHERE business LIKE '%Roofing%';

-- Delete everything about one lead (a deletion request; replace abc1234)
DELETE FROM events WHERE lead_id = 'abc1234';
DELETE FROM leads WHERE id = 'abc1234';
