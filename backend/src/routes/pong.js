import { createMatch } from '../services/matchService.js';

export default async function pongRoutes(app) {
  const db = app.db;

  app.get('/api/pong/matches/history/', { preValidation: [app.authenticate] }, async (request, reply) => {
    const targetUserId = request.query.userId ? Number(request.query.userId) : request.user.userId;

    const matches = db.prepare(`
      SELECT
        pm.*,
        u1.username as player1_username,
        u1.display_name as player1_display_name,
        u2.username as player2_username,
        u2.display_name as player2_display_name
      FROM pong_matches pm
      LEFT JOIN users u1 ON u1.id = pm.player1_id
      LEFT JOIN users u2 ON u2.id = pm.player2_id
      WHERE (pm.player1_id = ? OR pm.player2_id = ?)
      AND pm.status = 'completed'
      ORDER BY pm.created_at DESC
      LIMIT 50
    `).all(targetUserId, targetUserId);

    reply.send(matches);
  });
}
