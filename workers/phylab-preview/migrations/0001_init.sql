-- Review queue for literature candidates found by the weekly job.
-- stage: new -> screened -> drafted (waiting for review) -> approved | rejected
--        new -> skipped (low relevance score)            error (AI or metadata failure)
CREATE TABLE IF NOT EXISTS candidates (
  doi TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  meta TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'new',
  score INTEGER,
  reason_zh TEXT,
  draft TEXT,
  reject_reason TEXT,
  error TEXT,
  collected_at TEXT NOT NULL,
  decided_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS candidates_stage ON candidates (stage, score);

-- Interest profile, access key, job bookkeeping.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Catalogue entries older than two years that the owner chose to keep.
CREATE TABLE IF NOT EXISTS kept_old (
  paper_id TEXT PRIMARY KEY,
  kept_at TEXT NOT NULL
);

-- Short activity log shown on the review page.
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL
);
