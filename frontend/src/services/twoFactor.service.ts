import { authService } from './auth.service';

const API_BASE_URL = `${window.location.origin}/api`;

export interface TwoFactorSetupResponse {
  secret: string;
  qr_code: string;
}

export class TwoFactorService {
  async setup(): Promise<TwoFactorSetupResponse> {
    const response = await authService.makeAuthenticatedRequest(`${API_BASE_URL}/auth/2fa/setup/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to setup 2FA');
    }

    return await response.json();
  }

  async verify(code: string): Promise<{ success: boolean; message: string }> {
    const response = await authService.makeAuthenticatedRequest(`${API_BASE_URL}/auth/2fa/enable/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify 2FA code');
    }

    return await response.json();
  }

  async disable(code: string): Promise<{ success: boolean; message: string }> {
    const response = await authService.makeAuthenticatedRequest(`${API_BASE_URL}/auth/2fa/disable/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disable 2FA');
    }

    return await response.json();
  }

  async getStatus(): Promise<{ enabled: boolean }> {
    const response = await authService.makeAuthenticatedRequest(`${API_BASE_URL}/auth/2fa/status/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get 2FA status');
    }

    return await response.json();
  }
}

export const twoFactorService = new TwoFactorService(); // Instance pour l'export (profile page)
