import { hashPassword, verifyPassword } from '../utils/password.js';
import { verifyToken } from '../utils/twoFactor.js';
import { validateUsername, validateEmail, validateDisplayName, validatePasswordStrength } from '../utils/validation.js';
import { serializeAuthUser } from '../utils/userSerializer.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookieHelper.js';
import { randomUUID } from 'crypto';

export default async function authRoutes(app) {
    const db = app.db;

    app.post('/api/users/register/', {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour'
        }
      }
    }, async (request, reply) => {
      const { username, email, display_name, password, password_confirm } = request.body || {};

      if (!username || !email || !display_name || !password || !password_confirm) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      let validatedUsername, validatedEmail, validatedDisplayName;

      try {
        validatedUsername = validateUsername(username.trim(), 3, 20);
        validatedEmail = validateEmail(email.trim());
        validatedDisplayName = validateDisplayName(display_name.trim(), 20);
      } catch (err) {
        return reply.code(400).send({ error: err.message });
      }

      if (password !== password_confirm) {
        return reply.code(400).send({ error: 'Passwords do not match' });
      }

      try {
        validatePasswordStrength(password);
      } catch (err) {
        return reply.code(400).send({ error: err.message });
      }

      const existingByUsername = db.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).get(validatedUsername.toLowerCase());

      const existingByEmail = db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).get(validatedEmail.toLowerCase());

      const existingByDisplayName = db.prepare(
        'SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)'
      ).get(validatedDisplayName);

      if (existingByUsername || existingByEmail || existingByDisplayName) {
        return reply.code(400).send({ error: 'Username, email, or display name already in use' });
      }

      const passwordHash = await hashPassword(password);

      const result = db.prepare(`
        INSERT INTO users (username, email, display_name, password_hash, last_seen, is_online)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
      `).run(
        validatedUsername.toLowerCase(),
        validatedEmail.toLowerCase(),
        validatedDisplayName,
        passwordHash
      );

      const user = db.prepare('SELECT * FROM users WHERE id = ?')
                     .get(result.lastInsertRowid);

      const accessJti = randomUUID();
      const refreshJti = randomUUID();
      const accessToken = app.jwt.sign({ userId: user.id, jti: accessJti }, { expiresIn: '1h' });
      const refreshToken = app.jwt.sign({ userId: user.id, jti: refreshJti }, { expiresIn: '7d' });

      setAuthCookies(reply, accessToken, refreshToken);

      reply.send({
        user: serializeAuthUser(user),
      });
    });

    app.post('/api/users/login/', {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    }, async (request, reply) => {
      const { username, password } = request.body || {};

      if (!username || !password) {
        return reply.code(400).send({ error: 'Missing credentials' });
      }

      if (typeof username !== 'string' || typeof password !== 'string') {
        return reply.code(400).send({ error: 'Invalid credentials format' });
      }

      const user = db.prepare('SELECT * FROM users WHERE username = ?')
                     .get(username.trim().toLowerCase());

      const passwordValid = user && await verifyPassword(user.password_hash, password);

      if (!user || !passwordValid) {
        db.prepare(`
          INSERT INTO failed_logins (username, ip_address)
          VALUES (?, ?)
        `).run(username.trim().toLowerCase(), request.ip);

        const recentFailures = db.prepare(`
          SELECT COUNT(*) as count
          FROM failed_logins
          WHERE username = ?
          AND datetime(attempt_time) > datetime('now', '-15 minutes')
        `).get(username.trim().toLowerCase());

        if (recentFailures.count >= 5) {
          return reply.code(429).send({
            error: 'Too many failed login attempts. Please try again later.'
          });
        }

        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const is2FAEnabled = user.two_factor_enabled === 1;

      if (is2FAEnabled) {
        const tempToken = app.jwt.sign(
          { userId: user.id, temp: true, purpose: '2fa_verification' },
          { expiresIn: '5m' }
        );

        return reply.code(200).send({
          requires_2fa: true,
          temp_token: tempToken,
          message: '2FA code required',
        });
      }

      db.prepare('DELETE FROM failed_logins WHERE username = ?')
        .run(username.trim().toLowerCase());

      db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
        .run(user.id);

      const accessJti = randomUUID();
      const refreshJti = randomUUID();
      const accessToken = app.jwt.sign({ userId: user.id, jti: accessJti }, { expiresIn: '1h' });
      const refreshToken = app.jwt.sign({ userId: user.id, jti: refreshJti }, { expiresIn: '7d' });

      setAuthCookies(reply, accessToken, refreshToken);

      reply.send({
        user: serializeAuthUser(user),
      });
    });

    app.get('/api/users/me/', { preValidation: [app.authenticate] }, async (request, reply) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.userId);

      if (!user) {
        return reply.code(401).send({ error: 'User no longer exists' });
      }

      reply.send(serializeAuthUser(user));
    });

    app.post('/api/users/logout/', { preValidation: [app.authenticate] }, async (request, reply) => {
      const userId = request.user.userId;
      const jti = request.user.jti;
      const exp = request.user.exp;

      db.prepare('UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);

      if (jti && exp) {
        db.prepare(`
          INSERT OR IGNORE INTO token_blacklist (jti, user_id, expires_at, reason)
          VALUES (?, ?, ?, 'user_logout')
        `).run(jti, userId, exp);
      }

      clearAuthCookies(reply);

      reply.send({ message: 'Successfully logged out' });
    });

    app.post('/api/users/login/2fa/', {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes'
        }
      }
    }, async (request, reply) => {
      const { temp_token, two_factor_code } = request.body || {};

      if (!temp_token || !two_factor_code) {
        return reply.code(400).send({ error: 'temp_token and two_factor_code are required' });
      }

      try {
        const decoded = app.jwt.verify(temp_token);
        
        if (!decoded.temp || decoded.purpose !== '2fa_verification') {
          return reply.code(401).send({ error: 'Invalid temporary token' });
        }

        const userId = decoded.userId;

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }

        if (user.two_factor_enabled !== 1) {
          return reply.code(400).send({ error: '2FA is not enabled for this user' });
        }

        if (!user.two_factor_secret) {
          return reply.code(500).send({ error: '2FA secret not found' });
        }

        const is2FAValid = verifyToken(user.two_factor_secret, two_factor_code);
        if (!is2FAValid) {
          return reply.code(401).send({ error: 'Invalid 2FA code' });
        }

        db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
          .run(userId);

        const accessJti = randomUUID();
        const refreshJti = randomUUID();
        const accessToken = app.jwt.sign({ userId: user.id, jti: accessJti }, { expiresIn: '1h' });
        const refreshToken = app.jwt.sign({ userId: user.id, jti: refreshJti }, { expiresIn: '7d' });

        setAuthCookies(reply, accessToken, refreshToken);

        reply.send({
          user: serializeAuthUser(user),
        });
      } catch (err) {
        return reply.code(401).send({ error: 'Invalid temporary token' });
      }
    });

    app.post('/api/auth/refresh/', async (request, reply) => {
      const refresh_token = request.cookies?.refresh_token;

      if (!refresh_token) {
        clearAuthCookies(reply);
        return reply.code(401).send({ error: 'Authentication required' });
      }

      try {
        const decoded = app.jwt.verify(refresh_token);

        if (decoded.jti) {
          const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE jti = ?').get(decoded.jti);
          if (blacklisted) {
            return reply.code(401).send({ error: 'Token has been revoked' });
          }
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (!user) {
          return reply.code(401).send({ error: 'User no longer exists' });
        }

        const newAccessJti = randomUUID();
        const newRefreshJti = randomUUID();
        const newAccessToken = app.jwt.sign({ userId: user.id, jti: newAccessJti }, { expiresIn: '1h' });
        const newRefreshToken = app.jwt.sign({ userId: user.id, jti: newRefreshJti }, { expiresIn: '7d' });

        // Blacklist de l'ancien refresh token
        if (decoded.jti && decoded.exp) {
          db.prepare(`
            INSERT OR IGNORE INTO token_blacklist (jti, user_id, expires_at, reason)
            VALUES (?, ?, ?, 'token_refresh')
          `).run(decoded.jti, user.id, decoded.exp);
        }

        setAuthCookies(reply, newAccessToken, newRefreshToken);

        reply.send({
          success: true,
          message: 'Tokens refreshed'
        });
      } catch (err) {
        clearAuthCookies(reply);
        return reply.code(401).send({ error: 'Invalid or expired refresh token' });
      }
    });

    app.get('/api/auth/status', async (request, reply) => {
      const cookieToken = request.cookies?.access_token;

      if (!cookieToken) {
        return reply.send({ authenticated: false });
      }

      try {
        const decoded = app.jwt.verify(cookieToken);

        // Check de si le token est blacklisté
        if (decoded.jti) {
          const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE jti = ?').get(decoded.jti);
          if (blacklisted) {
            return reply.send({ authenticated: false });
          }
        }

        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.userId);

        if (user) {
          return reply.send({ authenticated: true });
        }
      } catch (error) {
        request.log.warn({ err: error }, '[WARN] Token verification failed for /api/auth/status');
      }

      return reply.send({ authenticated: false });
    });
}
