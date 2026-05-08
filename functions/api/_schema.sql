-- Hyper Shards leaderboard schema.
-- Run once against the D1 database bound as `DB`:
--   wrangler d1 execute hyper-shards-leaderboard --file functions/api/_schema.sql
-- Or paste these statements into the D1 console.

CREATE TABLE IF NOT EXISTS scores (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL,
  score INTEGER NOT NULL,
  round INTEGER NOT NULL,
  ts    INTEGER NOT NULL
);

-- Top-N queries hit this index, descending. SQLite/D1 will use it for
-- ORDER BY score DESC LIMIT 100 without a sort step.
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
