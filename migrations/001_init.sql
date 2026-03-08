CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  prize TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  opponent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  agreed_at TEXT,
  completed_at TEXT,
  winner_id TEXT,
  FOREIGN KEY (creator_id) REFERENCES users(id),
  FOREIGN KEY (opponent_id) REFERENCES users(id),
  FOREIGN KEY (winner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bet_votes (
  bet_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  selected_winner_id TEXT NOT NULL,
  voted_at TEXT NOT NULL,
  PRIMARY KEY (bet_id, voter_id),
  FOREIGN KEY (bet_id) REFERENCES bets(id),
  FOREIGN KEY (voter_id) REFERENCES users(id),
  FOREIGN KEY (selected_winner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bets_creator ON bets(creator_id);
CREATE INDEX IF NOT EXISTS idx_bets_opponent ON bets(opponent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);