CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  pass_hash TEXT
);

INSERT OR IGNORE INTO users (name, pass_hash) VALUES ('Ben', NULL);
INSERT OR IGNORE INTO users (name, pass_hash) VALUES ('Sheh', NULL);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  prize TEXT NOT NULL,
  creator TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  agreed_at TEXT,
  completed_at TEXT,
  winner TEXT,
  winner_vote_ben TEXT,
  winner_vote_sheh TEXT
);
