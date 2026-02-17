import { authService } from '../services/auth.service';
import { friendsService } from '../services/friends.service';
import { profileService } from '../services/profile.service';
import {
  userProfileTemplate,
  matchHistoryItemTemplate,
  emptyMatchHistoryTemplate,
  loadingProfileTemplate,
  errorProfileTemplate,
} from '../templates';
import { initAvatarFallbacks } from '../utils/helpers';

export interface UserPageContext {
  navigateTo: (route: string) => void;
}

export async function renderUserProfilePage(ctx: UserPageContext, userId: number): Promise<void> {
  if (!authService.isAuthenticated()) {
    ctx.navigateTo('/login');
    return;
  }

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = loadingProfileTemplate();

  try {
    const userStats = await profileService.getUserStats(userId);
    const currentUser = authService.currentUser;
    const isOwnProfile = currentUser?.id === userId;
    const isFriend = await checkIfFriend(userId);

    content.innerHTML = userProfileTemplate(userStats, isFriend, isOwnProfile);
    initAvatarFallbacks(content);

    loadUserMatchHistory(userId);

    if (!isOwnProfile) {
      document.getElementById('user-profile-friend')?.addEventListener('click', async () => {
        try {
          if (isFriend) {
            await friendsService.removeFriend(userId);
            alert('Ami retiré');
          } else {
            const result = await friendsService.addFriend(userId);
            if (result.message === 'Already friends') {
              alert('Déjà dans vos amis.');
            } else {
              alert('Ami ajouté');
            }
          }
          renderUserProfilePage(ctx, userId);
        } catch (error) {
          alert((error as Error).message);
        }
      });
    }

    document.getElementById('back-to-home')?.addEventListener('click', () => {
      ctx.navigateTo('/');
    });
  } catch (error) {
    content.innerHTML = errorProfileTemplate((error as Error).message);
    document.getElementById('back-to-home')?.addEventListener('click', () => {
      ctx.navigateTo('/');
    });
  }
}

async function checkIfFriend(userId: number): Promise<boolean> {
  try {
    const friends = await friendsService.getFriends();
    return friends.some((friend) => friend.id === userId);
  } catch {
    return false;
  }
}

async function loadUserMatchHistory(userId: number): Promise<void> {
  const container = document.getElementById('user-match-history');
  if (!container) return;

  try {
    const matches = await profileService.getMatchHistory(userId);
    if (!matches || !matches.length) {
      container.innerHTML = emptyMatchHistoryTemplate();
      return;
    }

    container.innerHTML = matches
      .slice(0, 10)
      .map((match: any) => matchHistoryItemTemplate(match, userId))
      .join('');
  } catch (error) {
    container.innerHTML = '<p style="color: #f44336;">Erreur chargement historique.</p>';
  }
}
