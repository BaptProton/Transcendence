import type { User } from '../types';

export class AuthService {
  private readonly baseURL: string = '/api';
  public currentUser: User | null = null;
  private hasTriggeredLogoutRedirect = false;

  private filterSensitiveData(user: any): any {
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
      wins: user.wins || 0,
      losses: user.losses || 0,
      online: user.online ?? user.is_online ?? false,
    };
  }

  public saveUser(user: User): void {
    this.currentUser = user;
    const publicData = this.filterSensitiveData(user);
    localStorage.setItem('current_user', JSON.stringify(publicData));
  }

  public clearAuth(): void {
    this.currentUser = null;
    localStorage.removeItem('current_user');
    this.hasTriggeredLogoutRedirect = false;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
      },
    });

    if (response.status !== 401) {
      return response;
    }

    try {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...options.headers,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to refresh access token:', error);
    }

    this.clearAuth();
    if (!this.hasTriggeredLogoutRedirect) {
      this.hasTriggeredLogoutRedirect = true;
      window.location.replace('/login');
    }

    return response;
  }

  // si refresh page -> verif JWT dans cookie + recupe infos user
  public async verifyAuth(): Promise<boolean> {
    try {
      const statusResponse = await fetch(`${this.baseURL}/auth/status`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!statusResponse.ok) {
        this.clearAuth();
        return false;
      }

      const status = await statusResponse.json();
      if (!status.authenticated) {
        this.clearAuth();
        return false;
      }

      const response = await this.makeAuthenticatedRequest(`${this.baseURL}/users/me/`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn('[WARN] Invalid tokens detected, automatic logout');
        this.clearAuth();
        return false;
      }

      const user = await response.json();
      this.saveUser(user);
      return true;
    } catch (error) {
      console.error('[ERROR] Error verifying tokens:', error);
      this.clearAuth();
      return false;
    }
  }

  public async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      this.clearAuth();
      return false;
    }
  }

  public async register(
    username: string,
    email: string,
    displayName: string,
    password: string,
    passwordConfirm: string
  ): Promise<User> {
    const response = await fetch(`${this.baseURL}/users/register/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        display_name: displayName,
        password,
        password_confirm: passwordConfirm,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error((Object.values(error)[0] as string) || 'Registration failed');
    }

    const data = (await response.json()) as { user: User };
    this.saveUser(data.user);

    return data.user;
  }

  public async login(username: string, password: string): Promise<User | { requires_2fa: boolean; temp_token: string }> {
    const response = await fetch(`${this.baseURL}/users/login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    if (data.requires_2fa) {
      return {
        requires_2fa: true,
        temp_token: data.temp_token,
      };
    }

    const loginData = data as { user: User };
    this.saveUser(loginData.user);

    return loginData.user;
  }

  public async complete2FALogin(tempToken: string, twoFactorCode: string): Promise<User> {
    const response = await fetch(`${this.baseURL}/users/login/2fa/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        temp_token: tempToken,
        two_factor_code: twoFactorCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '2FA verification failed');
    }

    const data = (await response.json()) as { user: User };
    this.saveUser(data.user);

    return data.user;
  }

  public async logout(): Promise<void> {
    if (!this.isAuthenticated()) {
      this.clearAuth();
      return;
    }

    try {
      await fetch(`${this.baseURL}/users/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.error('[ERROR] Logout error:', error);
    }

    this.clearAuth();
  }

  public async checkServerSession(): Promise<void> {
    try {
      const response = await fetch('/api/server-session', {
        credentials: 'include',
      });
      if (!response.ok) return;

      const authStatus = await fetch('/api/auth/status', {
        credentials: 'include',
      });
      const status = await authStatus.json();

      if (!status.authenticated && this.currentUser) {
        this.clearAuth();
      }
    } catch (error) {
      console.error('[ERROR] Error checking server session:', error);
    }
  }

  public async handleOAuthCallback(onSuccess?: () => void): Promise<boolean> {
    if (window.location.pathname === '/oauth-2fa') {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');

    if (!oauthSuccess) {
      return false;
    }

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    try {
      const response = await fetch(`${this.baseURL}/users/me/`, {
        credentials: 'include',
      });

      if (response.ok) {
        const user = await response.json();
        this.saveUser(user);

        if (onSuccess) {
          onSuccess();
        }

        setTimeout(() => {
          alert(`Bienvenue ${user.display_name} ! Vous êtes connecté via OAuth.`);
        }, 100);

        return true;
      } else {
        console.error('[ERROR] Failed to fetch user info after OAuth');
        this.clearAuth();
      }
    } catch (error) {
      console.error('[ERROR] Error processing OAuth callback:', error);
      this.clearAuth();
    }

    return false;
  }
}

export const authService = new AuthService();
