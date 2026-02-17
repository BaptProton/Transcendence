import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { serverSessionId } from './db.js';
import { clearAuthCookies } from './utils/cookieHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import pongRoutes from './routes/pong.js';
import blockchainRoutes from './routes/blockchain.js';
import oauthRoutes from './routes/oauth.js';
import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import twoFactorRoutes from './routes/twoFactor.js';
import usersRoutes from './routes/users.js';

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 8000;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be defined in environment and at least 32 characters long');
  process.exit(1);
}

const app = Fastify({
  logger: true,
});

app.decorate('db', db);

// Pour la configuration du CORS
const allowedOrigins = ['https://localhost:8443', 'https://127.0.0.1:8443'];

app.register(fastifyCors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});

app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

app.register(fastifyJwt, {
  secret: JWT_SECRET,
  sign: {
    algorithm: 'HS256',
    expiresIn: '1h'
  },
  verify: {
    algorithms: ['HS256']
  },
  decode: { complete: true },
  cookie: {
    cookieName: 'token'
  }
});

app.decorate('authenticate', async function (request, reply) {
  try {
    const cookieToken = request.cookies?.access_token;

    if (!cookieToken) {
      request.log.warn('No access_token cookie found');
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const decoded = app.jwt.verify(cookieToken);
    request.user = decoded;

    if (decoded.jti) {
      const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE jti = ?').get(decoded.jti);
      if (blacklisted) {
        request.log.warn(`Blacklisted token used: ${decoded.jti}`);
        return reply.code(401).send({ error: 'Token has been revoked' });
      }
    }

    const userId = request.user?.userId;
    if (userId) {
      const ONLINE_UPDATE_THRESHOLD = 30;

      const lastUpdate = db.prepare(`
        SELECT (julianday('now') - julianday(last_seen)) * 86400 as seconds_since_update
        FROM users
        WHERE id = ?
      `).get(userId);

      if (!lastUpdate || lastUpdate.seconds_since_update === null || lastUpdate.seconds_since_update > ONLINE_UPDATE_THRESHOLD) {
        db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?')
          .run(userId);
      }
    }
  } catch (err) {
    request.log.error('JWT verification failed:', err.message);
    reply.code(401).send({ error: 'Authentication required' });
  }
});

app.register(fastifyCookie);

app.register(fastifyHelmet, {
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginEmbedderPolicy: false,
});

app.register(fastifyMultipart, {
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
  decorateReply: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  },
});

app.get('/api/server-session', async (request, reply) => {
  const currentSessionCookie = request.cookies?.server_session;

  if (currentSessionCookie && currentSessionCookie !== serverSessionId) {
    clearAuthCookies(reply);
  }

  reply.setCookie('server_session', serverSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 jour
  });

  reply.send({ sessionId: serverSessionId });
});

app.register(usersRoutes);
app.register(pongRoutes);
app.register(blockchainRoutes);
app.register(oauthRoutes);
app.register(authRoutes);
app.register(statsRoutes);
app.register(twoFactorRoutes);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Fastify server running on port ${PORT}`);
    app.log.info(`Database: SQLite`);
    app.log.info(`JWT secret configured`);
  } catch (err) {
    app.log.error('Server startup failed:', err);
    process.exit(1);
  }
};

start();
