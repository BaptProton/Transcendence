const MAX_RETRIES = 3;
const RETRY_DELAY = 100; // ms

export function incrementUserWins(db, userId) {
  if (!userId) return;
  db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
}

export function incrementUserLosses(db, userId) {
  if (!userId) return;
  db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
}

export function createMatch(db, player1Id, player2Id, gameMode, status = 'pending') {
  const result = db.prepare(`
    INSERT INTO pong_matches (player1_id, player2_id, game_mode, status)
    VALUES (?, ?, ?, ?)
  `).run(player1Id, player2Id, gameMode, status);
  return result.lastInsertRowid;
}
