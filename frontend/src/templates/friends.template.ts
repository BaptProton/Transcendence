import { sanitizeHTML, sanitizeAvatarUrl } from '../utils/helpers';
import type { User } from '../types';

export function friendsPageTemplate(): string {
  return `
    <div class="friends-page">
      <h2>Mes amis</h2>

      <div class="friends-controls" style="margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
        <input
          type="text"
          id="friends-search"
          placeholder="Rechercher un utilisateur..."
          maxlength="20"
          style="flex: 1; min-width: 200px; padding: 0.75rem; background: var(--bg-light); border: 1px solid var(--primary-color); border-radius: 5px; color: var(--text-light);"
          autocomplete="off"
        />
        <div class="filter-buttons" style="display: flex; gap: 0.5rem;">
          <button id="filter-all" class="btn btn-primary active" data-filter="all">Tous</button>
          <button id="filter-online" class="btn btn-secondary" data-filter="online">En ligne</button>
          <button id="filter-offline" class="btn btn-secondary" data-filter="offline">Hors ligne</button>
        </div>
      </div>

      <div id="search-results" style="display: none; margin-bottom: 1rem;"></div>

      <div id="friends-list" class="friends-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
        <!-- Populated dynamically -->
      </div>
    </div>
  `;
}

export function friendCardTemplate(friend: User): string {
  const safeName = sanitizeHTML(friend.display_name || friend.username);
  const safeUsername = sanitizeHTML(friend.username);
  const isOnline = friend.online;
  const statusIcon = isOnline ? '🟢' : '🔴';
  const statusText = isOnline ? 'En ligne' : 'Hors ligne';

  const initials = safeName.slice(0, 2).toUpperCase();
  const avatarHTML = friend.avatar
    ? `<img src="${sanitizeAvatarUrl(friend.avatar.startsWith('http') ? friend.avatar : window.location.origin + friend.avatar)}" alt="Avatar" class="avatar-with-fallback" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
       <div class="avatar-initials avatar-fallback" style="display: none; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #00babc, #4ecdc4); color: #1a1a2e; font-size: 24px; font-weight: bold; align-items: center; justify-content: center;">${initials}</div>`
    : `<div class="avatar-initials" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #00babc, #4ecdc4); color: #1a1a2e; font-size: 24px; font-weight: bold; display: flex; align-items: center; justify-content: center;">${initials}</div>`;

  return `
    <div class="friend-card card" data-friend-id="${friend.id}" data-online="${isOnline ? '1' : '0'}" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        ${avatarHTML}
        <div style="flex: 1;">
          <h3 style="margin: 0; color: var(--primary-color);">${safeName}</h3>
          <p style="margin: 0.25rem 0; color: #888;">@${safeUsername}</p>
          <p style="margin: 0.25rem 0; color: ${isOnline ? '#4caf50' : '#888'};">${statusIcon} ${statusText}</p>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <a href="/user/${friend.id}" data-route="/user/${friend.id}" class="btn btn-primary" style="flex: 1; text-align: center; text-decoration: none;">Profil</a>
        <button class="btn btn-danger remove-friend" data-friend-id="${friend.id}">Retirer</button>
      </div>
    </div>
  `;
}

export function emptyFriendsTemplate(): string {
  return `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #888;">
      <p style="font-size: 1.2rem;">Aucun ami pour le moment.</p>
      <p>Utilisez la barre de recherche pour trouver d'autres joueurs !</p>
    </div>
  `;
}

export function searchResultItemTemplate(user: User, isFriend: boolean): string {
  const safeName = sanitizeHTML(user.display_name || user.username);
  const safeUsername = sanitizeHTML(user.username);

  return `
    <div class="search-result-item" style="padding: 0.75rem; border-bottom: 1px solid var(--bg-light); display: flex; align-items: center; gap: 1rem; cursor: pointer;" data-user-id="${user.id}">
      <div style="font-weight: bold; color: var(--primary-color);">${safeName}</div>
      <div style="color: #888;">@${safeUsername}</div>
      ${isFriend ? '<span style="color: #4caf50;">✓ Ami</span>' : '<button class="btn btn-primary btn-sm add-friend-search" data-user-id="' + user.id + '" style="margin-left: auto; padding: 0.4rem 0.8rem;">Ajouter</button>'}
    </div>
  `;
}
