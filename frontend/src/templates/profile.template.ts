import type { User, UserStats } from '../types';
import { sanitizeHTML, sanitizeAvatarUrl } from '../utils/helpers';

function generateAvatarHTML(avatar: string | undefined, displayName: string, size: number = 100): string {
  const safeDisplayName = sanitizeHTML(displayName || 'U');
  const initials = safeDisplayName.slice(0, 2).toUpperCase();

  if (avatar) {
    const baseUrl = avatar.startsWith('http') ? avatar : `${window.location.origin}${avatar}`;
    const avatarUrl = sanitizeAvatarUrl(baseUrl);

    if (!avatarUrl) {
      return `
        <div class="avatar-container avatar-initials" style="width: ${size}px; height: ${size}px; border-radius: 50%;
             background: linear-gradient(135deg, #00babc, #4ecdc4); color: #1a1a2e;
             font-size: ${size / 2.5}px; font-weight: bold; display: flex; align-items: center; justify-content: center;">
          ${initials}
        </div>
      `;
    }

    return `
      <div class="avatar-container" style="width: ${size}px; height: ${size}px;">
        <img src="${sanitizeHTML(avatarUrl)}" alt="Avatar" class="avatar-image avatar-with-fallback"
             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
        <div class="avatar-initials avatar-fallback" style="display: none; width: 100%; height: 100%; border-radius: 50%;
             background: linear-gradient(135deg, #00babc, #4ecdc4); color: #1a1a2e;
             font-size: ${size / 2.5}px; font-weight: bold; align-items: center; justify-content: center;">
          ${initials}
        </div>
      </div>
    `;
  }

  return `
    <div class="avatar-container avatar-initials" style="width: ${size}px; height: ${size}px; border-radius: 50%;
         background: linear-gradient(135deg, #00babc, #4ecdc4); color: #1a1a2e;
         font-size: ${size / 2.5}px; font-weight: bold; display: flex; align-items: center; justify-content: center;">
      ${initials}
    </div>
  `;
}

export function profileTemplate(user: User | null): string {
  const safeUsername = sanitizeHTML(user?.username || '');
  const safeEmail = sanitizeHTML(user?.email || '');
  const safeProfileDisplayName = sanitizeHTML(user?.display_name || user?.username || '');
  const avatarHTML = generateAvatarHTML(user?.avatar, safeProfileDisplayName, 120);

  return `
    <div class="profile-page">
      <h2>Profil</h2>
      <div class="profile-header" style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div class="avatar-section">
          ${avatarHTML}
          <label for="avatar-input" class="avatar-upload-btn" style="display: block; margin-top: 0.5rem; text-align: center;">
            <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none;">
            <span class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 0.3rem 0.6rem; cursor: pointer;">
              Changer l'avatar
            </span>
          </label>
          <div id="avatar-upload-status" style="font-size: 0.8rem; margin-top: 0.3rem; text-align: center;"></div>
        </div>
        <div class="profile-info">
          <p><strong>Nom d'utilisateur:</strong> ${safeUsername}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Nom d'affichage:</strong> ${safeProfileDisplayName}</p>
        </div>
      </div>

      <div class="profile-section card" style="margin-top: 2rem; padding: 1.5rem;">
        <h3>✏️ Modifier mes informations</h3>
        <form id="profile-update-form" class="auth-form" style="max-width: 500px;">
          <div class="form-group">
            <label for="update-display-name">Nom d'affichage (2-20 caractères)</label>
            <input type="text" id="update-display-name" name="display_name" value="${safeProfileDisplayName}" required minlength="2" maxlength="20" autocomplete="nickname">
          </div>
          <div class="form-group">
            <label for="update-email">Email</label>
            <input type="email" id="update-email" name="email" value="${safeEmail}" required maxlength="100" autocomplete="email">
          </div>
          <div class="form-group">
            <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          </div>
          <div id="profile-update-message" style="margin-top: 0.5rem;"></div>
        </form>
      </div>

      <div class="profile-section card" style="margin-top: 2rem; padding: 1.5rem;">
        <h3>🔐 Authentification à deux facteurs (2FA)</h3>
        <div id="2fa-status-section">
          <p style="color: #888;">Chargement du statut 2FA...</p>
        </div>
        <div id="2fa-setup-section" style="display: none;">
          <div id="2fa-qr-container" style="text-align: center; margin: 1rem 0;"></div>
          <div id="2fa-verify-section" style="margin-top: 1rem;">
            <p style="color: #888; font-size: 0.9rem;">Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.) puis entrez le code à 6 chiffres pour activer le 2FA.</p>
            <form id="2fa-verify-form" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <input type="text" id="2fa-verify-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" style="flex: 1; padding: 0.5rem;" required autocomplete="one-time-code">
              <button type="submit" class="btn btn-primary">Activer 2FA</button>
              <button type="button" id="2fa-cancel-setup" class="btn btn-secondary">Annuler</button>
            </form>
            <div id="2fa-verify-error" class="error-message" style="margin-top: 0.5rem;"></div>
          </div>
        </div>
      </div>

      <button id="logout-btn" class="btn btn-danger" style="margin-top: 2rem;">Se déconnecter</button>
    </div>
  `;
}

export function userProfileTemplate(
  userStats: UserStats,
  isFriend: boolean,
  isOwnProfile: boolean
): string {
  const safeDisplayName = sanitizeHTML(userStats.display_name || userStats.username || 'Utilisateur');
  const safeUsername = sanitizeHTML(userStats.username || '');
  const wins = userStats.wins || 0;
  const losses = userStats.losses || 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const isOnline = userStats.is_online ? '🟢 En ligne' : '🔴 Hors ligne';
  const avatarHTML = generateAvatarHTML(userStats.avatar, safeDisplayName, 100);

  return `
    <div class="profile-page">
      <h2>Profil de ${safeDisplayName}</h2>
      <div class="profile-header" style="display: flex; align-items: flex-start; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div class="avatar-section">
          ${avatarHTML}
        </div>
        <div class="profile-info card" style="flex: 1;">
          <p><strong>Nom d'utilisateur:</strong> ${safeUsername}</p>
          <p><strong>Statut:</strong> ${isOnline}</p>
          <p><strong>Victoires Pong:</strong> ${wins}</p>
          <p><strong>Défaites Pong:</strong> ${losses}</p>
          <p><strong>Taux de victoire:</strong> ${winRate}%</p>
        </div>
      </div>

      ${!isOwnProfile ? `
        <div class="profile-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
          <button id="user-profile-friend" class="btn ${isFriend ? 'btn-danger' : 'btn-primary'}">
            ${isFriend ? 'Retirer des amis' : 'Ajouter en ami'}
          </button>
        </div>
      ` : ''}

      <div class="match-history card">
        <h3>Historique des matchs</h3>
        <div id="user-match-history">Chargement...</div>
      </div>
    </div>
  `;
}

export function matchHistoryItemTemplate(
  match: any,
  userId: number
): string {
  const isWinner = match.winner_id === userId;
  const resultClass = isWinner ? 'win' : 'loss';
  const resultText = isWinner ? 'Victoire' : 'Défaite';
  const score = `${match.player1_score || 0} - ${match.player2_score || 0}`;
  const date = new Date(match.created_at).toLocaleDateString('fr-FR');
  const borderColor = isWinner ? '#4caf50' : '#f44336';

  return `
    <div class="match-item ${resultClass}" style="padding: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid ${borderColor};">
      <strong>${resultText}</strong> - ${score} - ${date}
    </div>
  `;
}

export function emptyMatchHistoryTemplate(): string {
  return '<p style="color: #888;">Aucun match joué.</p>';
}

export function loadingProfileTemplate(): string {
  return '<div class="loading"><h2>Chargement du profil...</h2></div>';
}

export function errorProfileTemplate(errorMessage: string): string {
  const safeMessage = sanitizeHTML(errorMessage);
  return `
    <div class="error-page">
      <h2>Erreur</h2>
      <p>Impossible de charger le profil: ${safeMessage}</p>
      <button id="back-to-home" class="btn btn-secondary">Retour à l'accueil</button>
    </div>
  `;
}
