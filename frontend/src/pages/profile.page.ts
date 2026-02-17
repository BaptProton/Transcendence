import { authService } from '../services/auth.service';
import { profileService } from '../services/profile.service';
import { twoFactorService } from '../services/twoFactor.service';
import { profileTemplate } from '../templates';
import { validateEmail, validateDisplayName } from '../utils/validation';
import { sanitizeHTML, showValidationError, clearValidationError, initAvatarFallbacks } from '../utils/helpers';

export interface ProfilePageContext {
  navigateTo: (route: string) => void;
  updateNavigation: () => void;
}

export function renderProfilePage(ctx: ProfilePageContext): void {
  if (!authService.isAuthenticated()) {
    ctx.navigateTo('/login');
    return;
  }

  const content = document.getElementById('content');
  if (!content) return;

  const user = authService.currentUser;
  content.innerHTML = profileTemplate(user);
  initAvatarFallbacks(content);

  setupAvatarUpload();
  setupProfileUpdateForm();
  setupLogoutButton(ctx);
  setup2FASection();
}

function setupAvatarUpload(): void {
  const avatarInput = document.getElementById('avatar-input') as HTMLInputElement;
  const statusDiv = document.getElementById('avatar-upload-status');

  avatarInput?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (statusDiv) {
        statusDiv.textContent = 'Fichier trop volumineux (max 2MB)';
        statusDiv.style.color = '#f44336';
      }
      return;
    }

    if (statusDiv) {
      statusDiv.textContent = 'Upload en cours...';
      statusDiv.style.color = '#00babc';
    }

    try {
      await profileService.updateProfile({ avatar: file });
      if (statusDiv) {
        statusDiv.textContent = 'Avatar mis à jour!';
        statusDiv.style.color = '#4caf50';
      }
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      if (statusDiv) {
        statusDiv.textContent = 'Erreur lors de l\'upload';
        statusDiv.style.color = '#f44336';
      }
      console.error('[ERROR] Avatar upload error:', error);
    }
  });
}

function setupProfileUpdateForm(): void {
  const profileUpdateForm = document.getElementById('profile-update-form') as HTMLFormElement;
  const profileUpdateMessage = document.getElementById('profile-update-message');

  profileUpdateForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const displayNameInput = document.getElementById('update-display-name') as HTMLInputElement;
    const emailInput = document.getElementById('update-email') as HTMLInputElement;

    if (!displayNameInput || !emailInput) return;

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();

    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.valid) {
      if (profileUpdateMessage) {
        profileUpdateMessage.textContent = displayNameValidation.error || 'Nom d\'affichage invalide';
        profileUpdateMessage.style.color = '#f44336';
      }
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      if (profileUpdateMessage) {
        profileUpdateMessage.textContent = emailValidation.error || 'Email invalide';
        profileUpdateMessage.style.color = '#f44336';
      }
      return;
    }

    if (profileUpdateMessage) {
      profileUpdateMessage.textContent = 'Mise à jour en cours...';
      profileUpdateMessage.style.color = '#00babc';
    }

    try {
      await profileService.updateProfile({
        display_name: displayName,
        email: email
      });

      if (profileUpdateMessage) {
        profileUpdateMessage.textContent = '✓ Informations mises à jour avec succès';
        profileUpdateMessage.style.color = '#4caf50';
      }

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      if (profileUpdateMessage) {
        profileUpdateMessage.textContent = `Erreur: ${(error as Error).message}`;
        profileUpdateMessage.style.color = '#f44336';
      }
      console.error('[ERROR] Profile update error:', error);
    }
  });
}

function setupLogoutButton(ctx: ProfilePageContext): void {
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async () => {
    await authService.logout();
    ctx.updateNavigation();
    ctx.navigateTo('/login');
  });
}

async function setup2FASection(): Promise<void> {
  const statusSection = document.getElementById('2fa-status-section');
  const setupSection = document.getElementById('2fa-setup-section');
  if (!statusSection) return;

  try {
    const status = await twoFactorService.getStatus();

    if (status.enabled) {
      render2FAEnabled(statusSection);
    } else {
      render2FADisabled(statusSection, setupSection);
    }
  } catch (error) {
    statusSection.innerHTML = `<p style="color: #f44336;">Erreur lors du chargement du statut 2FA: ${sanitizeHTML((error as Error).message)}</p>`;
  }
}

function render2FAEnabled(statusSection: HTMLElement): void {
  statusSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="color: #4caf50; font-weight: bold;">✅ 2FA activé</p>
        <p style="color: #888; font-size: 0.9rem;">Votre compte est protégé par authentification à deux facteurs.</p>
      </div>
      <button id="2fa-disable-btn" class="btn btn-danger">Désactiver 2FA</button>
    </div>
    <div id="2fa-disable-form" style="display: none; margin-top: 1rem; padding: 1rem; background: rgba(244, 67, 54, 0.1); border-radius: 4px;">
      <p style="color: #888; font-size: 0.9rem; margin-bottom: 0.5rem;">Entrez votre code 2FA pour désactiver :</p>
      <form id="2fa-disable-form-submit" style="display: flex; gap: 0.5rem;">
        <input type="text" id="2fa-disable-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" style="flex: 1; padding: 0.5rem;" required autocomplete="one-time-code">
        <button type="submit" class="btn btn-danger">Confirmer désactivation</button>
        <button type="button" id="2fa-cancel-disable" class="btn btn-secondary">Annuler</button>
      </form>
      <div id="2fa-disable-error" class="error-message" style="margin-top: 0.5rem;"></div>
    </div>
  `;

  document.getElementById('2fa-disable-btn')?.addEventListener('click', () => {
    const disableForm = document.getElementById('2fa-disable-form');
    if (disableForm) {
      disableForm.style.display = 'block';
      (document.getElementById('2fa-disable-code') as HTMLInputElement)?.focus();
    }
  });

  document.getElementById('2fa-cancel-disable')?.addEventListener('click', () => {
    const disableForm = document.getElementById('2fa-disable-form');
    if (disableForm) {
      disableForm.style.display = 'none';
    }
  });

  document.getElementById('2fa-disable-form-submit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (document.getElementById('2fa-disable-code') as HTMLInputElement)?.value || '';
    const errorDiv = document.getElementById('2fa-disable-error');

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      if (errorDiv) {
        errorDiv.textContent = 'Veuillez entrer un code à 6 chiffres';
        errorDiv.style.display = 'block';
      }
      return;
    }

    clearValidationError(errorDiv);

    try {
      await twoFactorService.disable(code);
      alert('2FA désactivé avec succès');
      window.location.reload();
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });
}

function render2FADisabled(
  statusSection: HTMLElement,
  setupSection: HTMLElement | null
): void {
  statusSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="color: #ff9800; font-weight: bold;">⚠️ 2FA non activé</p>
        <p style="color: #888; font-size: 0.9rem;">Activez l'authentification à deux facteurs pour renforcer la sécurité de votre compte.</p>
      </div>
      <button id="2fa-setup-btn" class="btn btn-primary">Activer 2FA</button>
    </div>
  `;

  document.getElementById('2fa-setup-btn')?.addEventListener('click', async () => {
    try {
      const setupData = await twoFactorService.setup();

      const qrContainer = document.getElementById('2fa-qr-container');
      if (qrContainer) {
        qrContainer.innerHTML = `
          <img src="${setupData.qr_code}" alt="QR Code 2FA" style="max-width: 250px; border: 2px solid #00babc; border-radius: 8px; padding: 1rem; background: white;">
          <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Ou entrez manuellement : <code style="background: rgba(0,0,0,0.2); padding: 0.2rem 0.4rem; border-radius: 4px;">${setupData.secret}</code></p>
        `;
      }

      if (setupSection) {
        setupSection.style.display = 'block';
        (document.getElementById('2fa-verify-code') as HTMLInputElement)?.focus();
      }
    } catch (error) {
      alert(`Erreur lors de la configuration 2FA: ${(error as Error).message}`);
    }
  });

  document.getElementById('2fa-cancel-setup')?.addEventListener('click', () => {
    if (setupSection) {
      setupSection.style.display = 'none';
    }
  });

  document.getElementById('2fa-verify-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (document.getElementById('2fa-verify-code') as HTMLInputElement)?.value || '';
    const errorDiv = document.getElementById('2fa-verify-error');

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      if (errorDiv) {
        errorDiv.textContent = 'Veuillez entrer un code à 6 chiffres';
        errorDiv.style.display = 'block';
      }
      return;
    }

    clearValidationError(errorDiv);

    try {
      await twoFactorService.verify(code);
      alert('2FA activé avec succès !');
      window.location.reload();
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });
}
