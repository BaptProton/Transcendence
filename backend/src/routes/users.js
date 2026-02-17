import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeInput, validateEmail, validateDisplayName } from '../utils/validation.js';
import { buildUserColumns, serializeUser } from '../utils/userSerializer.js';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function usersRoutes(app) {
  const db = app.db;
  const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');

  app.get('/api/users/friends/', { preValidation: [app.authenticate] }, async (request, reply) => {
    const stmt = db.prepare(`
      SELECT ${buildUserColumns('u')}
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `);
    const friends = stmt.all(request.user.userId);
    const result = friends.map(friend => ({ friend: serializeUser(friend) }));
    reply.send(result);
  });

  app.post('/api/users/friends/:id/add/', { preValidation: [app.authenticate] }, async (request, reply) => {
    const friendId = Number(request.params.id);

    if (isNaN(friendId)) {
      return reply.code(400).send({ error: 'Param not a number'});
    }

    if (friendId === request.user.userId) {
      return reply.code(400).send({ error: 'Cannot add yourself' });
    }
    const friend = findUserById.get(friendId);
    if (!friend) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const existing = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(request.user.userId, friendId);
    if (existing) {
      return reply.code(200).send({ message: 'Already friends' });
    }

    const insert = db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)');
    insert.run(request.user.userId, friendId);
    insert.run(friendId, request.user.userId);
    reply.code(201).send({ message: 'Friend added' });
  });

  app.delete('/api/users/friends/:id/remove/', { preValidation: [app.authenticate] }, async (request, reply) => {
    const friendId = Number(request.params.id);
    if (isNaN(friendId)) {
      return reply.code(400).send({ error: 'Param not a number'});
    }
    const removeStmt = db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?');
    const result1 = removeStmt.run(request.user.userId, friendId);
    const result2 = removeStmt.run(friendId, request.user.userId);
    if (result1.changes === 0 && result2.changes === 0) {
      return reply.code(404).send({ error: 'Friendship not found' });
    }
    reply.send({ message: 'Friend removed' });
  });

  app.get('/api/users/search/', {
    preValidation: [app.authenticate],
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { query } = request.query;

    if (typeof query !== 'string' || query.trim().length < 1) {
      return reply.send([]);
    }

    if (query.length > 20) {
      return reply.code(400).send({ error: 'Search query too long (max 20 characters)' });
    }

    const escapedQuery = query.replace(/[%_\\]/g, '\\$&');
    const searchPattern = `%${escapedQuery}%`;

    const users = db.prepare(`
      SELECT id, username, display_name, avatar, is_online
      FROM users
      WHERE id != ?
        AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
      ORDER BY username
      LIMIT 20
    `).all(userId, searchPattern, searchPattern);

    // On passe de is_online a online pour le frontend
    const serializedUsers = users.map(user => ({
      ...user,
      online: Boolean(user.is_online),
      is_online: undefined,
    }));

    reply.send(serializedUsers);
  });

  app.patch('/api/users/profile/', { preValidation: [app.authenticate] }, async (request, reply) => {
    try {
      let email = null;
      let display_name = null;
      let avatarPath = null;

      if (request.isMultipart()) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'avatar') {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(part.mimetype)) {
              return reply.code(400).send({ error: 'File type not allowed. Use JPEG, PNG, GIF, or WebP.' });
            }

            // Verfication du contenu du fichier via les magic bytes
            const buffer = await part.toBuffer();
            const fileType = await fileTypeFromBuffer(buffer);
            if (!fileType) {
              return reply.code(400).send({ error: 'Unable to detect file type' });
            }

            const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedMimes.includes(fileType.mime)) {
              return reply.code(400).send({
                error: 'File content does not match allowed image types'
              });
            }

            try {
              const metadata = await sharp(buffer).metadata();
              const MAX_WIDTH = 4096;
              const MAX_HEIGHT = 4096;

              if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
                return reply.code(400).send({
                  error: `Image dimensions too large (max ${MAX_WIDTH}x${MAX_HEIGHT})`
                });
              }
            } catch (err) {
              return reply.code(400).send({ error: 'Invalid image file' });
            }

            // Extension determinee par les magic bytes du fichier
            const ext = fileType.ext;
            const filename = `${request.user.userId}_${Date.now()}.${ext}`;
            const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
            const filepath = path.join(uploadDir, filename);

            // Suppression de l'ancien avatar si existant
            const currentUser = findUserById.get(request.user.userId);
            if (currentUser?.avatar && currentUser.avatar.startsWith('/uploads/avatars/')) {
              const oldPath = path.join(__dirname, '..', '..', currentUser.avatar.replace('/uploads/', 'uploads/'));
              try {
                await fs.unlink(oldPath);
              } catch (e) {
                // Ne rien faire si le fichier n'existe pas
              }
            }

            // Sauvegarde du nouveau fichier
            await fs.writeFile(filepath, buffer);
            avatarPath = `/uploads/avatars/${filename}`;
          } 
          else if (part.type === 'field') {
            if (part.fieldname === 'email') email = part.value;
            if (part.fieldname === 'display_name') display_name = part.value;
          }
        }
      }

      if (!email && !display_name && !avatarPath) {
        return reply.code(400).send({ error: 'Nothing to update' });
      }

      if (email) {
        email = email.trim().toLowerCase();
        try {
          validateEmail(email);
        } catch (err) {
          return reply.code(400).send({ error: 'Invalid email format' });
        }
      }

      if (display_name) {
        try {
          validateDisplayName(display_name.trim());
        } catch (err) {
          return reply.code(400).send({ error: err.message || 'Invalid display name (2-20 characters, letters/numbers/spaces/_/-)' });
        }
      }

      const currentUser = findUserById.get(request.user.userId);
      if (!currentUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Interdire le changement d'email pour les comptes OAuth
      // L'email OAuth est lié au provider --> pas de modif
      const isOAuthAccount = currentUser.password_hash?.startsWith('oauth_');
      if (email && email !== currentUser.email && isOAuthAccount) {
        return reply.code(403).send({
          error: 'OAuth accounts cannot change their email address. Your email is managed by your OAuth provider.'
        });
      }

      if (email && email !== currentUser.email) {
        const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .get(email, request.user.userId);
        if (emailExists) {
          return reply.code(400).send({ error: 'This email address is already in use' });
        }
      }

      if (display_name && display_name.trim().toLowerCase() !== currentUser.display_name.toLowerCase()) {
        const nameExists = db.prepare('SELECT id FROM users WHERE LOWER(display_name) = LOWER(?) AND id != ?')
          .get(display_name.trim(), request.user.userId);
        if (nameExists) {
          return reply.code(400).send({ error: 'This display name is already in use' });
        }
      }

      // COALESCE pour ne mettre à jour que les champs fournis, sinon garder les valeurs actuelles
      const stmt = db.prepare(`
        UPDATE users
        SET
          email = COALESCE(?, email),
          display_name = COALESCE(?, display_name),
          avatar = COALESCE(?, avatar)
        WHERE id = ?
      `);
      // Sanitize du display_name pour eviter les attaques XSS
      const sanitizedDisplayName = display_name ? sanitizeInput(display_name.trim()) : null;

      stmt.run(
        email || null,
        sanitizedDisplayName,
        avatarPath,
        request.user.userId
      );
      const user = findUserById.get(request.user.userId);
      reply.send(serializeUser(user));
    } catch (error) {
      request.log.error('[ERROR]', error);
      reply.code(400).send({ error: 'Email or display name already in use' });
    }
  });
}
