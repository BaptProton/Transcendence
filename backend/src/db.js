import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(join(DATA_DIR, 'transcendence.db'));
db.pragma('foreign_keys = ON');

const runMigrations = () => {
  db.exec(`
    -- Table users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 0,
      last_seen TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      two_factor_secret TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS trigger_users_updated
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    -- table friendship
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_id)
    );

    -- Table match pong
    CREATE TABLE IF NOT EXISTS pong_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      game_mode TEXT NOT NULL,
      winner_id INTEGER REFERENCES users(id),
      player1_score INTEGER DEFAULT 0,
      player2_score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      blockchain_tx_hash TEXT,
      duration INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS trigger_pong_matches_updated
    AFTER UPDATE ON pong_matches
    BEGIN
      UPDATE pong_matches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    -- Blockchain scores de tournoi
    CREATE TABLE IF NOT EXISTS blockchain_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      winner_username TEXT NOT NULL,
      formatted_result TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      block_number INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- table pour token blacklist
    CREATE TABLE IF NOT EXISTS token_blacklist (
      jti TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      blacklisted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);

    -- Table pour les fails de logins
    CREATE TABLE IF NOT EXISTS failed_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT,
      attempt_time TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_failed_logins_username ON failed_logins(username);
    CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins(ip_address);
    CREATE INDEX IF NOT EXISTS idx_failed_logins_attempt_time ON failed_logins(attempt_time);
  `);
};

runMigrations();

db.prepare('UPDATE users SET is_online = 0').run();

// pour clean les tokens de la blacklist toutes les heures
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM token_blacklist WHERE expires_at < ?').run(now);
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} expired tokens from blacklist`);
  }
}, 3600000);

// Pour clean les failed logins attemps qui depassent 24h
setInterval(() => {
  const result = db.prepare(`
    DELETE FROM failed_logins
    WHERE datetime(attempt_time) < datetime('now', '-24 hours')
  `).run();
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old failed login attempts`);
  }
}, 3600000);

const serverSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

export { serverSessionId };
export default db;
