import { authService } from '../services/auth.service';
import { friendsService } from '../services/friends.service';
import type { User } from '../types';
import {
  friendsPageTemplate,
  friendCardTemplate,
  emptyFriendsTemplate,
  searchResultItemTemplate,
} from '../templates';
import { sanitizeHTML, initAvatarFallbacks } from '../utils/helpers';

export interface FriendsPageContext {
  navigateTo: (route: string) => void;
  friendsSearchClickHandler: ((e: MouseEvent) => void) | null;
  setFriendsSearchClickHandler: (handler: ((e: MouseEvent) => void) | null) => void;
}

export async function renderFriendsPage(ctx: FriendsPageContext): Promise<void> {
  if (!authService.isAuthenticated()) {
    ctx.navigateTo('/login');
    return;
  }

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = friendsPageTemplate();

  try {
    const allFriends = await friendsService.getFriends();

    renderFriendsList(allFriends, 'all');
    initAvatarFallbacks(content);
    setupFriendsSearch(ctx, allFriends);
    setupFriendsFilter(ctx, allFriends);
    setupRemoveFriendButtons(ctx);
  } catch (error) {
    content.innerHTML = `<div class="error-page"><h2>Erreur</h2><p>${sanitizeHTML((error as Error).message)}</p></div>`;
  }
}

function renderFriendsList(friends: User[], filter: 'all' | 'online' | 'offline'): void {
  const listContainer = document.getElementById('friends-list');
  if (!listContainer) return;

  let filteredFriends = friends;

  if (filter === 'online') {
    filteredFriends = friends.filter(f => f.online);
  } else if (filter === 'offline') {
    filteredFriends = friends.filter(f => !f.online);
  }

  if (filteredFriends.length === 0) {
    listContainer.innerHTML = emptyFriendsTemplate();
  } else {
    listContainer.innerHTML = filteredFriends.map(f => friendCardTemplate(f)).join('');
  }
}

function setupFriendsSearch(ctx: FriendsPageContext, allFriends: User[]): void {
  const searchInput = document.getElementById('friends-search') as HTMLInputElement;
  const searchResults = document.getElementById('search-results');
  if (!searchInput || !searchResults) return;

  let searchTimeout: number;

  searchInput.addEventListener('input', async () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();

    if (query.length < 2) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      return;
    }

    searchTimeout = window.setTimeout(async () => {
      try {
        const results = await friendsService.searchUsers(query);
        const currentUserId = authService.currentUser?.id;
        const friendIds = new Set(allFriends.map(f => f.id));

        const filteredResults = results.filter(user => user.id !== currentUserId);

        if (filteredResults.length === 0) {
          searchResults.innerHTML = '<div style="padding: 1rem; color: #888;">Aucun résultat</div>';
        } else {
          searchResults.innerHTML = filteredResults
            .map(user => searchResultItemTemplate(user, friendIds.has(user.id)))
            .join('');

          searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
              const target = e.target as HTMLElement;
              if (!target.classList.contains('add-friend-search')) {
                const userId = item.getAttribute('data-user-id');
                ctx.navigateTo(`/user/${userId}`);
              }
            });
          });

          searchResults.querySelectorAll<HTMLButtonElement>('.add-friend-search').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const userId = Number(btn.getAttribute('data-user-id'));
              try {
                const result = await friendsService.addFriend(userId);
                if (result.message === 'Already friends') {
                  alert('Déjà dans vos amis.');
                } else {
                  alert('Ami ajouté !');
                }
                renderFriendsPage(ctx);
              } catch (error) {
                alert((error as Error).message);
              }
            });
          });
        }

        searchResults.style.display = 'block';
        searchResults.style.background = 'var(--bg-light)';
        searchResults.style.border = '1px solid var(--primary-color)';
        searchResults.style.borderRadius = '5px';
        searchResults.style.marginTop = '-1rem';
      } catch (error) {
        searchResults.innerHTML = `<div style="padding: 1rem; color: #f44336;">Erreur: ${sanitizeHTML((error as Error).message)}</div>`;
        searchResults.style.display = 'block';
      }
    }, 300);
  });

  if (ctx.friendsSearchClickHandler) {
    document.removeEventListener('click', ctx.friendsSearchClickHandler);
  }

  const clickHandler = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.friends-controls')) {
      searchResults.style.display = 'none';
    }
  };

  ctx.setFriendsSearchClickHandler(clickHandler);
  document.addEventListener('click', clickHandler);
}

function setupFriendsFilter(ctx: FriendsPageContext, allFriends: User[]): void {
  const filterButtons = document.querySelectorAll<HTMLButtonElement>('[data-filter]');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');

      const filter = btn.getAttribute('data-filter') as 'all' | 'online' | 'offline';
      renderFriendsList(allFriends, filter);
      initAvatarFallbacks(document.getElementById('friends-list') || document);

      setupRemoveFriendButtons(ctx);
    });
  });
}

function setupRemoveFriendButtons(ctx: FriendsPageContext): void {
  document.querySelectorAll<HTMLButtonElement>('.remove-friend').forEach(btn => {
    btn.addEventListener('click', async () => {
      const friendId = Number(btn.getAttribute('data-friend-id'));
      if (confirm('Voulez-vous vraiment retirer cet ami ?')) {
        try {
          await friendsService.removeFriend(friendId);
          alert('Ami retiré');
          renderFriendsPage(ctx);
        } catch (error) {
          alert((error as Error).message);
        }
      }
    });
  });
}
