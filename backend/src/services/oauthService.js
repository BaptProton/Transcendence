import { nanoid } from 'nanoid';
import { randomUUID } from 'crypto';
import { setAuthCookies } from '../utils/cookieHelper.js';

// On stocke les CSRF tokens en mémoire avec les données associées
export const pendingOAuthRequests = new Map(); // csrfToken -> { origin, redirectUri, createdAt }

const DEFAULT_FRONTEND = 'https://localhost:8443';

function getAllowedOrigins() {
  return [DEFAULT_FRONTEND, 'https://127.0.0.1:8443'];
}

function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

function buildOriginFromRequest(request) {
  const candidate = `https://${request.headers.host}`;
  if (isAllowedOrigin(candidate)) {
    return candidate;
  }
  return DEFAULT_FRONTEND;
}

// Nettoyage des tokens expires (duree de vie: 10 min, verif: toutes les 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingOAuthRequests.entries()) {
    if (now - data.createdAt > 600000) {
      pendingOAuthRequests.delete(token);
    }
  }
}, 300000);


 // Generation des tokens CSRF et stockage des donnees associees
export function initializeOAuthFlow(request, provider) {
  const csrfToken = nanoid(32);
  const origin = getFrontendBaseUrl(request);
  const redirectUri = getOAuthRedirectUri(request, provider);

  pendingOAuthRequests.set(csrfToken, {
    origin,
    redirectUri,
    createdAt: Date.now()
  });

  return { csrfToken, redirectUri, origin };
}


 // Construction de l'URL de redirection OAuth
export function getOAuthRedirectUri(request, provider) {
  const baseUrl = buildOriginFromRequest(request);
  return `${baseUrl}/api/auth/oauth/${provider}/callback/`;
}


// Recupere l'origin stockee a l'initiation OAuth, avec validation et fallback securise
export function getFrontendBaseUrl(request, csrfToken = null) {
  if (csrfToken && pendingOAuthRequests.has(csrfToken)) {
    const storedOrigin = pendingOAuthRequests.get(csrfToken).origin;
    if (isAllowedOrigin(storedOrigin)) {
      return storedOrigin;
    }
    return buildOriginFromRequest(request);
  }
  return buildOriginFromRequest(request);
}


export function createOrUpdateOAuthUser(db, provider, userData) {
  const prefix = provider === '42' ? '42_' : 'gh_';
  const username = `${prefix}${userData.login}`.toLowerCase();
  const expectedPasswordHash = provider === '42' ? 'oauth_42' : 'oauth_github';

  if (!userData.email && provider === 'github') {
    throw new Error('No verified email found on your GitHub account. Please add a verified email to your GitHub profile and try again.');
  }
  const rawEmail = userData.email || `${userData.login}@student.42.fr`;
  const email = rawEmail.toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format from OAuth provider');
  }
  const displayName = provider === '42'
    ? (userData.displayname || userData.login)
    : (userData.name || userData.login);
  const avatar = provider === '42'
    ? (userData.image?.link || null)
    : (userData.avatar_url || null);

  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    const existingByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingByEmail) {
      throw new Error(`Email ${email} is already associated with another account`);
    }

    const existingByDisplayName = db.prepare('SELECT * FROM users WHERE LOWER(display_name) = LOWER(?)').get(displayName);
    if (existingByDisplayName) {
      throw new Error(`Display name "${displayName}" is already taken`);
    }

    const stmt = db.prepare(`
      INSERT INTO users (username, email, display_name, password_hash, avatar, is_online)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(username, email, displayName, expectedPasswordHash, avatar);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  } else {
    if (user.password_hash !== expectedPasswordHash) {
      throw new Error(`Username ${username} is already taken by a non-OAuth account. Please use a different login method.`);
    }

    if (user.email !== email) {
      const emailConflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
      if (emailConflict) {
        throw new Error(`Email ${email} is already associated with another account`);
      }
      db.prepare('UPDATE users SET email = ?, is_online = 1, last_seen = CURRENT_TIMESTAMP, avatar = ? WHERE id = ?')
        .run(email, avatar, user.id);
    } else {
      db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP, avatar = ? WHERE id = ?')
        .run(avatar, user.id);
    }
  }

  return user;
}

 // 2FA + redirection OAuth
export function handleOAuth2FARedirect(app, reply, request, user, csrfToken, provider) {
  const tempToken = app.jwt.sign(
    { userId: user.id, temp: true, purpose: 'oauth_2fa_verification', provider },
    { expiresIn: '5m' }
  );

  reply.setCookie('oauth_2fa_temp_token', tempToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300 // 5 minutes
  });

  const frontendBase = getFrontendBaseUrl(request, csrfToken);
  pendingOAuthRequests.delete(csrfToken);

  const frontendUrl = new URL(`${frontendBase}/oauth-2fa`);
  frontendUrl.searchParams.set('provider', provider);
  reply.redirect(frontendUrl.toString());
}

export function handleOAuthSuccessRedirect(app, reply, request, user, csrfToken) {
  const accessJti = randomUUID();
  const refreshJti = randomUUID();
  const accessToken = app.jwt.sign({ userId: user.id, jti: accessJti }, { expiresIn: '1h' });
  const refreshToken = app.jwt.sign({ userId: user.id, jti: refreshJti }, { expiresIn: '7d' });

  setAuthCookies(reply, accessToken, refreshToken);

  const frontendBase = getFrontendBaseUrl(request, csrfToken);
  pendingOAuthRequests.delete(csrfToken);

  const frontendUrl = new URL(`${frontendBase}/`);
  frontendUrl.searchParams.set('oauth_success', 'true');

  reply.redirect(frontendUrl.toString());
}

// Codes d'erreur OAuth pour le frontend
export function getOAuthErrorCode(error) {
  if (error.message?.includes('No verified email')) {
    return 'no_verified_email';
  }
  if (error.message?.includes('Email') && error.message?.includes('already')) {
    return 'email_already_taken';
  }
  if (error.message?.includes('Display name') && error.message?.includes('already')) {
    return 'display_name_already_taken';
  }
  if (error.message?.includes('non-OAuth account')) {
    return 'username_conflict_manual_account';
  }
  if (error.message?.includes('Username') && error.message?.includes('already')) {
    return 'username_already_taken';
  }
  return 'oauth_failed';
}

 // Gere les erreurs OAuth et redirige vers le frontend avec le code d'erreur
export function handleOAuthErrorRedirect(reply, error, csrfToken) {
  const storedData = pendingOAuthRequests.get(csrfToken);
  pendingOAuthRequests.delete(csrfToken);

  const errorMessage = getOAuthErrorCode(error);
  const frontendBase = storedData?.origin || 'https://localhost:8443';
  const errorUrl = new URL(`${frontendBase}/login`);
  errorUrl.searchParams.set('oauth_error', errorMessage);

  reply.redirect(errorUrl.toString());
}
