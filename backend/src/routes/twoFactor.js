import { generateSecret, generateQRCode, verifyToken } from '../utils/twoFactor.js';

export default async function twoFactorRoutes(app) {
  const db = app.db;

  app.post('/api/auth/2fa/setup/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Vérif 2FA
    if (user.two_factor_enabled === 1) {
      return reply.code(400).send({ error: '2FA is already enabled. Disable it first to set up a new one.' });
    }

    try {

      const secretData = generateSecret(user.username, 'ft_transcendence');
      const qrCodeDataUrl = await generateQRCode(secretData.otpauth_url);

      // Stockage temporaire pas encore activé - l'utilisateur doit vérifier d'abord
      db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secretData.secret, userId);

      reply.send({
        secret: secretData.secret, // Entrée manuelle si le QR code ne fonctionne pas
        qr_code: qrCodeDataUrl, // Data URL pour l'image du QR code
      });
    } catch (error) {
      request.log.error('[ERROR] Error setting up 2FA:', error);
      reply.code(500).send({ error: 'Failed to setup 2FA' });
    }
  });

  app.post('/api/auth/2fa/enable/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes'
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { code } = request.body || {};

    if (!code) {
      return reply.code(400).send({ error: 'Code is required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (!user.two_factor_secret) {
      return reply.code(400).send({ error: '2FA setup not initiated. Call /api/auth/2fa/setup/ first.' });
    }

    if (user.two_factor_enabled === 1) {
      return reply.code(400).send({ error: '2FA is already enabled' });
    }

    const isValid = verifyToken(user.two_factor_secret, code);

    if (!isValid) {
      return reply.code(400).send({ error: 'Invalid 2FA code. Please try again.' });
    }

    // Activation 2FA
    db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(userId);

    reply.send({
      success: true,
      message: '2FA has been enabled successfully',
    });
  });

  app.post('/api/auth/2fa/disable/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { code } = request.body || {};

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.two_factor_enabled !== 1) {
      return reply.code(400).send({ error: '2FA is not enabled' });
    }

    if (!code) {
      return reply.code(400).send({ error: '2FA code is required to disable 2FA' });
    }

    if (!user.two_factor_secret) {
      return reply.code(500).send({ error: '2FA secret not found' });
    }

    const isValid = verifyToken(user.two_factor_secret, code);
    if (!isValid) {
      return reply.code(400).send({ error: 'Invalid 2FA code' });
    }

    // Désactivation 2FA et suppression du secret
    db.prepare('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?').run(userId);

    reply.send({
      success: true,
      message: '2FA has been disabled successfully',
    });
  });

  app.get('/api/auth/2fa/status/', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;

    const user = db.prepare('SELECT two_factor_enabled FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    reply.send({
      enabled: user.two_factor_enabled === 1,
    });
  });
}
