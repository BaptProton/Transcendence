import { incrementUserWins, incrementUserLosses } from '../services/matchService.js';

export default async function statsRoutes(app) {
    const db = app.db;

    // stats du user connecté
    app.get('/api/users/stats', { preValidation: [app.authenticate] }, async (request, reply) => {
        const userId = request.user.userId;
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        reply.send({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
          wins: user.wins,
          losses: user.losses,
          win_rate: calcWinRate(user.wins, user.losses),
          is_online: Boolean(user.is_online),
        });
    });

    // stats d'un ami
    app.get('/api/users/:id/stats', { preValidation: [app.authenticate] }, async (request, reply) => {
        const userId = Number(request.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return reply.status(400).send({ error: 'Invalid user ID' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }

        reply.send({
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
          wins: user.wins,
          losses: user.losses,
          win_rate: calcWinRate(user.wins, user.losses),
          is_online: Boolean(user.is_online),
        });
    });

    // save des stats (pour modes locaux: vs_ai, 2p_local, tournament)
    app.post('/api/stats/save-match', {
        preValidation: [app.authenticate],
        config: {
            rateLimit: {
                max: 30,
                timeWindow: '1 minute'
            }
        },
        schema: {
            body: {
                type: 'object',
                additionalProperties: false,
                required: ['winner', 'player1Score', 'player2Score', 'gameMode'],
                properties: {
                    winner: { type: 'string', enum: ['player1', 'player2'] },
                    player1Score: { type: 'integer', minimum: 0, maximum: 5 },
                    player2Score: { type: 'integer', minimum: 0, maximum: 5 },
                    gameMode: { type: 'string', enum: ['vs_ai', '2p_local', 'tournament'] },
                    opponentID: { type: ['integer', 'null'] },
                    duration: { type: 'number', minimum: 0 }
                }
            }
        }
    }, async (request, reply) => {
        const userId = request.user.userId;
        const { winner, player1Score, player2Score, gameMode, opponentID, duration } = request.body || {};


        // Validation de base 
        if (!winner || player1Score === undefined || player2Score === undefined || !gameMode) {
            return reply.status(400).send({ error: 'Missing match data' });
        }

        // Validation winner vs scores
        const expectedWinner = player1Score > player2Score ? 'player1' : 'player2';
        if (winner !== expectedWinner) {
            return reply.status(400).send({ error: 'Winner does not match scores' });
        }

        // Validation scores égaux
        if (player1Score === player2Score) {
            return reply.status(400).send({ error: 'Scores cannot be equal' });
        }

        try {
            const userWon = (winner === 'player1');
            const winnerId = userWon ? userId : null;

            // Transaction pour modes locaux
            const transaction = db.transaction(() => {
                // Insérer le match
                const info = db.prepare(`
                    INSERT INTO pong_matches (
                        player1_id, player2_id, game_mode, winner_id,
                        player1_score, player2_score, duration, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
                `).run(
                    userId,
                    opponentID || null,
                    gameMode,
                    winnerId,
                    player1Score,
                    player2Score,
                    duration || 0
                );

                // Mettre à jour les stats du joueur
                if (userWon) {
                    incrementUserWins(db, userId);
                } else {
                    incrementUserLosses(db, userId);
                }

                return info.lastInsertRowid;
            });

            const newMatchId = transaction();

            return reply.status(201).send({
                success: true,
                matchId: newMatchId,
                message: 'Match saved successfully'
            });

        } catch (error) {
            request.log.error({ err: error }, '[ERROR] Error saving match stats');
            return reply.status(500).send({
                error: 'Failed to save match stats'
            });
        }
    });

    app.get('/api/stats/dashboard', {
        preValidation: [app.authenticate],
        config: {
            rateLimit: {
                max: 60,
                timeWindow: '1 minute'
            }
        }
    }, async (request, reply) => {
        const userId = request.user.userId;

        try {
            const stmt = db.prepare('SELECT id, username, display_name, wins, losses FROM users WHERE id = ?');
            const user = stmt.get(request.user.userId);
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            const matchHistory = db.prepare(`
                SELECT 
                    pm.id AS match_id,
                    pm.created_at,
                    pm.duration,
                    pm.game_mode,
                    pm.player1_score,
                    pm.player2_score,
                    pm.winner_id,
                    u1.username AS player1,
                    u2.username AS player2,
                    winner.username AS winner
                FROM pong_matches pm
                LEFT JOIN users u1 ON pm.player1_id = u1.id
                LEFT JOIN users u2 ON pm.player2_id = u2.id
                LEFT JOIN users winner ON pm.winner_id = winner.id
                WHERE (pm.player1_id = ? OR pm.player2_id = ?)
                  AND pm.status = 'completed'
                ORDER BY pm.created_at DESC
                LIMIT 10
            `).all(userId, userId);
            
            const userScores = [];
            const opponentScores = [];
            for (const match of matchHistory.slice().reverse()) {
                const isPlayer1 = (match.player1 === user.username);
                if(isPlayer1) {
                    userScores.push(match.player1_score);
                    opponentScores.push(match.player2_score);
                }
                else
                {
                    userScores.push(match.player2_score);
                    opponentScores.push(match.player1_score);
                }
            }

            reply.send({
                user: {
                    username: user.username,
                    displayName: user.display_name,
                    wins: user.wins,
                    losses: user.losses,
                    winRate: calcWinRate(user.wins, user.losses),
                    totalGames: user.wins + user.losses
                },
                matches: matchHistory.map(m => {
                    // Déterminer le nom du gagnant
                    let winnerName = m.winner;
                    if (!winnerName) {
                        if (m.game_mode === 'tournament') {
                            winnerName = 'Adversaire (tournoi)';
                        } else if (m.game_mode === '2p_local') {
                            winnerName = 'Joueur 2';
                        } else if (m.game_mode === 'vs_ai') {
                            winnerName = 'IA';
                        } else {
                            winnerName = 'Adversaire';
                        }
                    }

                    let player2Name = m.player2;
                    if (!player2Name) {
                        if (m.game_mode === 'tournament') {
                            player2Name = 'Adversaire (tournoi)';
                        } else if (m.game_mode === '2p_local') {
                            player2Name = 'Joueur 2';
                        } else if (m.game_mode === 'vs_ai') {
                            player2Name = 'IA';
                        } else {
                            player2Name = 'Adversaire';
                        }
                    }

                    return {
                        matchId: m.match_id,
                        date: m.created_at,
                        mode: m.game_mode,
                        player1: m.player1 || 'Joueur 1',
                        player2: player2Name,
                        score: `${m.player1_score} - ${m.player2_score}`,
                        player1Score: m.player1_score,
                        player2Score: m.player2_score,
                        winner: winnerName,
                        duration: m.duration
                    };
                }),
                matchResults: matchHistory
                    .slice()                // copie pour pas toucher l'ordre
                    .reverse()              // les plus anciens d'abord
                    .map(m => m.winner === user.username ? 1 : 0),
                    userScores,
                    opponentScores
            });

        } catch (error) {
            request.log.error({ err: error }, '[ERROR] Error fetching dashboard');
            return reply.status(500).send({ error: 'Failed to fetch dashboard' });
        }
    });

    function calcWinRate(w, l) {
        const total = w + l;
        return total === 0 ? 0 : Math.round((w / total) * 100);
    }
}
