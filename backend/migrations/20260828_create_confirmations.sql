CREATE TABLE IF NOT EXISTS confirmations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_issue_id ON confirmations(issue_id);
