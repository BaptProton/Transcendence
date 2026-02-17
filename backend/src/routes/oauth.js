import { verifyToken } from '../utils/twoFactor.js';
import { serializeAuthUser } from '../utils/userSerializer.js';
import { setAuthCookies } from '../utils/cookieHelper.js';
import { randomUUID } from 'crypto';
import {
  pendingOAuthRequests,
  initializeOAuthFlow,
  getOAuthRedirectUri,
  createOrUpdateOAuthUser,
  handleOAuth2FARedirect,
  handleOAuthSuccessRedirect,
  handleOAuthErrorRedirect
} from '../services/oauthService.js';

const OAUTH42_CLIENT_ID = process.env.OAUTH42_CLIENT_ID || '';
const OAUTH42_SECRET = process.env.OAUTH42_SECRET || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

export default async function oauthRoutes(app) {
  const db = app.db;

  // OAUTH 42
  app.get('/api/auth/oauth/42/', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    if (!OAUTH42_CLIENT_ID || !OAUTH42_SECRET) {
      return reply.code(503).send({ error: 'OAuth 42 not configured' });
    }

    const { csrfToken, redirectUri } = initializeOAuthFlow(request, '42');

    // Lier le state au navigateur via un cookie sécurisé (protection login CSRF)
    reply.setCookie('oauth_state', csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600 // 10 minutes, même durée que pendingOAuthRequests
    });

    const authUrl = new URL('https://api.intra.42.fr/oauth/authorize');
    authUrl.searchParams.set('client_id', OAUTH42_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', csrfToken);
    authUrl.searchParams.set('scope', 'public');

    reply.redirect(authUrl.toString());
  });

  app.get('/api/auth/oauth/42/callback/', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour'
      }
    },
    schema: {
      querystring: {
        type: 'object',
        required: ['code', 'state'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 512 },
          state: { type: 'string', minLength: 8, maxLength: 128 }
        }
      }
    }
  }, async (request, reply) => {
    if (!OAUTH42_CLIENT_ID || !OAUTH42_SECRET) {
      return reply.code(503).send({ error: 'OAuth 42 not configured' });
    }

    const { code, state } = request.query;

    if (typeof code !== 'string' || code.length === 0) {
      return reply.code(400).send({ error: 'Missing authorization code' });
    }

    if (typeof state !== 'string' || !pendingOAuthRequests.has(state)) {
      return reply.code(400).send({ error: 'Invalid state parameter' });
    }

    // Vérifier que le cookie oauth_state correspond au state (protection login CSRF)
    const cookieState = request.cookies?.oauth_state;
    if (!cookieState || cookieState !== state) {
      pendingOAuthRequests.delete(state);
      return reply.code(400).send({ error: 'OAuth state mismatch — possible CSRF attack' });
    }
    reply.clearCookie('oauth_state', { path: '/' });

    const csrfToken = state;
    const storedData = pendingOAuthRequests.get(csrfToken);
    const redirectUri = storedData?.redirectUri || getOAuthRedirectUri(request, '42');

    try {
      // Echange du code contre un token d'accès
      const tokenResponse = await fetch('https://api.intra.42.fr/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: OAUTH42_CLIENT_ID,
          client_secret: OAUTH42_SECRET,
          code,
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get access token');
      }

      const tokenData = await tokenResponse.json();

      // Recuperer les informations utilisateur depuis l'API 42
      const userResponse = await fetch('https://api.intra.42.fr/v2/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();
      const user = createOrUpdateOAuthUser(db, '42', userData);

      if (user.two_factor_enabled === 1) {
        handleOAuth2FARedirect(app, reply, request, user, csrfToken, '42');
        return;
      }

      handleOAuthSuccessRedirect(app, reply, request, user, csrfToken);
    } catch (error) {
      request.log.error('[ERROR]', error);
      handleOAuthErrorRedirect(reply, error, csrfToken);
    }
  });


  // OAUTH GITHUB
  app.get('/api/auth/oauth/github/', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return reply.code(503).send({ error: 'GitHub OAuth not configured' });
    }

    const { csrfToken, redirectUri } = initializeOAuthFlow(request, 'github');

    // Lier le state au navigateur via un cookie sécurisé (protection login CSRF)
    reply.setCookie('oauth_state', csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    });

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', csrfToken);
    authUrl.searchParams.set('scope', 'read:user user:email');

    reply.redirect(authUrl.toString());
  });

  app.get('/api/auth/oauth/github/callback/', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour'
      }
    },
    schema: {
      querystring: {
        type: 'object',
        required: ['code', 'state'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 512 },
          state: { type: 'string', minLength: 8, maxLength: 128 }
        }
      }
    }
  }, async (request, reply) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return reply.code(503).send({ error: 'GitHub OAuth not configured' });
    }

    const { code, state } = request.query;

    if (typeof code !== 'string' || code.length === 0) {
      return reply.code(400).send({ error: 'Missing authorization code' });
    }

    if (typeof state !== 'string' || !pendingOAuthRequests.has(state)) {
      return reply.code(400).send({ error: 'Invalid state parameter' });
    }

    // Vérifier que le cookie oauth_state correspond au state (protection login CSRF)
    const cookieState = request.cookies?.oauth_state;
    if (!cookieState || cookieState !== state) {
      pendingOAuthRequests.delete(state);
      return reply.code(400).send({ error: 'OAuth state mismatch — possible CSRF attack' });
    }
    reply.clearCookie('oauth_state', { path: '/' });

    const csrfToken = state;

    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get access token');
      }

      const tokenData = await tokenResponse.json();

      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();

      // Si l'email est privé, appeler /user/emails pour obtenir l'email primaire vérifié
      if (!userData.email) {
        try {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (emailsResponse.ok) {
            const emails = await emailsResponse.json();
            // Prendre l'email primaire et vérifié
            const primaryEmail = emails.find(e => e.primary && e.verified);
            if (primaryEmail) {
              userData.email = primaryEmail.email;
            } else {
              // Fallback: premier email vérifié
              const verifiedEmail = emails.find(e => e.verified);
              if (verifiedEmail) {
                userData.email = verifiedEmail.email;
              }
            }
          }
        } catch (emailError) {
          request.log.warn({ err: emailError }, '[WARN] Failed to fetch GitHub user emails');
        }

        if (!userData.email) {
          return handleOAuthErrorRedirect(reply, new Error('No verified email found on your GitHub account. Please add a verified email to your GitHub profile and try again.'), csrfToken);
        }
      }

      const user = createOrUpdateOAuthUser(db, 'github', userData);

      if (user.two_factor_enabled === 1) {
        handleOAuth2FARedirect(app, reply, request, user, csrfToken, 'github');
        return;
      }

      handleOAuthSuccessRedirect(app, reply, request, user, csrfToken);
    } catch (error) {
      request.log.error('[ERROR]', error);
      handleOAuthErrorRedirect(reply, error, csrfToken);
    }
  });


  app.post('/api/auth/oauth/2fa/complete/', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour'
      }
    }
  }, async (request, reply) => {
    const { two_factor_code, temp_token } = request.body || {};
    const tempToken = temp_token || request.cookies?.oauth_2fa_temp_token;

    if (!tempToken || !two_factor_code) {
      return reply.code(400).send({ error: 'temp_token and two_factor_code are required' });
    }

    try {
      const decoded = app.jwt.verify(tempToken);

      if (!decoded.temp || decoded.purpose !== 'oauth_2fa_verification') {
        return reply.code(401).send({ error: 'Invalid temporary token' });
      }

      const userId = decoded.userId;
      const provider = decoded.provider || 'unknown';

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

      reply.clearCookie('oauth_2fa_temp_token');

      setAuthCookies(reply, accessToken, refreshToken);

      reply.send({
        user: serializeAuthUser(user),
        provider
      });
    } catch (error) {
      request.log.error('[ERROR]', error);
      return reply.code(401).send({ error: 'Invalid temporary token or 2FA verification failed' });
    }
  });
}
