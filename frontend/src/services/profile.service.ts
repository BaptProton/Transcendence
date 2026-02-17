import type { User, UserStats, Match } from '../types';
import { authService } from './auth.service';

export interface UpdateProfileData {
  display_name?: string;
  email?: string;
  avatar?: File;
}

class ProfileService {
  private readonly baseURL: string = '/api';

  public async updateProfile(data: UpdateProfileData): Promise<User> {
    const formData = new FormData();

    if (data.display_name) formData.append('display_name', data.display_name);
    if (data.email) formData.append('email', data.email);
    if (data.avatar) formData.append('avatar', data.avatar);

    const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/users/profile/`, {
      method: 'PATCH',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error((Object.values(error)[0] as string) || 'Profile update failed');
    }

    const user = (await response.json()) as User;
    authService.saveUser(user);
    return user;
  }

  public async getMatchHistory(userId?: number, limit: number = 20): Promise<Match[]> {
    const url = userId
      ? `${this.baseURL}/pong/matches/history/?userId=${userId}&limit=${limit}`
      : `${this.baseURL}/pong/matches/history/?limit=${limit}`;

    const response = await authService.makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get match history');
    }

    return (await response.json()) as Match[];
  }

  public async getUserStats(userId?: number): Promise<UserStats> {
    const url = userId
      ? `${this.baseURL}/users/${userId}/stats`
      : `${this.baseURL}/users/stats`;

    const response = await authService.makeAuthenticatedRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to get user stats');
    }

    return (await response.json()) as UserStats;
  }
}

export const profileService = new ProfileService();
