CREATE TABLE IF NOT EXISTS coach_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  session_id TEXT NOT NULL,
  question TEXT NOT NULL,
  reply TEXT NOT NULL,
  mode TEXT NOT NULL,
  model TEXT,
  phase TEXT NOT NULL,
  verdict TEXT NOT NULL,
  speed REAL,
  height_at_net REAL,
  net_clearance REAL,
  x_land REAL,
  out_by REAL,
  attempt_count INTEGER,
  prompt_version TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coach_conversations_created_at
  ON coach_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_conversations_session
  ON coach_conversations(session_id, created_at DESC);
