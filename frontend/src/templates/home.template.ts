import type { User } from '../types';
import { sanitizeHTML } from '../utils/helpers';

export function homeTemplate(user: User | null, isAuthenticated: boolean): string {
  const safeDisplayName = user ? sanitizeHTML(user.display_name || user.username) : '';
  const greeting = user ? `Bienvenue, ${safeDisplayName} !` : 'Bienvenue sur ft_transcendence';

  return `
    <div class="home">
      <h2>${greeting}</h2>
      <p>Le meilleur site de tournoi Pong en ligne !</p>

      <div style="margin-top: 2rem;">
        <h3>Modules implémentés :</h3>
        <ul style="list-style: none; padding: 1rem;">
          <li>✅ <strong>Backend Framework</strong> : Fastify + Node.js avec API REST complète</li>
          <li>✅ <strong>AI Opponent</strong> : 3 niveaux de difficulté (même vitesse paddle)</li>
          <li>✅ <strong>OAuth 2.0</strong> : Connexion avec 42 et GitHub</li>
          <li>✅ <strong>Blockchain</strong> : Scores tournois sur Avalanche Fuji testnet</li>
          <li>✅ <strong>User Management</strong> : Profils, amis, historique matchs</li>
          <li>✅ <strong>Two-Factor Auth (2FA)</strong> : TOTP avec QR codes + JWT</li>
          <li>✅ <strong>Stats Dashboards</strong> : Statistiques utilisateur (mineur)</li>
          <li>✅ <strong>Database SQLite</strong> : 6 tables + 2 triggers (mineur)</li>
          <li>✅ <strong>Browser Compatibility</strong> : Support navigateur supplémentaire (mineur)</li>
        </ul>
      </div>

      <div class="home-actions" style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
        ${!isAuthenticated ? `
          <a href="/login" data-route="/login" class="btn btn-primary">Se connecter</a>
          <a href="/register" data-route="/register" class="btn btn-secondary">S'inscrire</a>
        ` : `
          <a href="/game/pong" data-route="/game/pong" class="btn btn-primary">Jouer au Pong</a>
          <a href="/tournament" data-route="/tournament" class="btn btn-secondary">Tournoi</a>
          <a href="/profile" data-route="/profile" class="btn btn-secondary">Mon profil</a>
        `}
      </div>
    </div>
  `;
}
