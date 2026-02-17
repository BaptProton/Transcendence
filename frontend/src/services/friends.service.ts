import type { User } from '../types';
import { authService } from './auth.service';

class FriendsService {
  private readonly baseURL: string = '/api';

  public async getFriends(): Promise<User[]> {
    const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/users/friends/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get friends list');
    }

    const friendships = (await response.json()) as Array<{ friend: User }>;
    return friendships.map((entry) => entry.friend);
  }

  public async addFriend(userId: number): Promise<{ message: string }> {
    const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/users/friends/${userId}/add/`, {
      method: 'POST',
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add friend');
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to add friend') {
          throw e;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  public async removeFriend(userId: number): Promise<{ message: string }> {
    const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/users/friends/${userId}/remove/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove friend');
    }

    return await response.json();
  }

  public async searchUsers(query: string): Promise<User[]> {
    if (!query.trim()) return [];

    const response = await authService.makeAuthenticatedRequest(
      `${this.baseURL}/users/search/?query=${encodeURIComponent(query)}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    return (await response.json()) as User[];
  }
}

export const friendsService = new FriendsService();
