-- Lead click tracking for outreach emails (see worker/README.md).
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,       -- 6 to 8 lowercase letters/digits, used as ?r= in email links
  business TEXT,
  contact TEXT,
  email TEXT,
  city TEXT,
  trade TEXT,
  sent_at TEXT,              -- when the outreach email went out
  notes TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT,
  type TEXT,                 -- visit, engaged, click_call, click_email, ...
  detail TEXT,
  path TEXT,
  ts TEXT,                   -- ISO 8601, UTC
  ua TEXT,                   -- user agent, truncated; never the IP
  country TEXT               -- CF-IPCountry
);

CREATE INDEX IF NOT EXISTS events_lead_ts ON events (lead_id, ts);
