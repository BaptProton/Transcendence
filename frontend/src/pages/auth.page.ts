import { authService } from '../services/auth.service';
import { loginTemplate, registerTemplate } from '../templates';
import { validateLoginForm, validateRegistrationForm } from '../utils/validation';
import { showValidationError, clearValidationError } from '../utils/helpers';

export interface AuthPageContext {
  navigateTo: (route: string) => void;
  updateNavigation: () => void;
  apiBaseUrl: string;
}

export function renderLoginPage(ctx: AuthPageContext): void {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = loginTemplate();

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('oauth_error');
  if (oauthError) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    const errorDiv = document.getElementById('error-message');
    let errorMessage = 'L\'authentification OAuth a échoué';

    switch (oauthError) {
      case 'email_already_taken':
        errorMessage = 'Cet email est déjà associé à un autre compte. Connectez-vous avec votre compte existant.';
        break;
      case 'display_name_already_taken':
        errorMessage = 'Ce nom d\'affichage est déjà pris par un autre utilisateur.';
        break;
      case 'username_already_taken':
        errorMessage = 'Ce nom d\'utilisateur est déjà pris par un autre compte.';
        break;
      case 'username_conflict_manual_account':
        errorMessage = 'Un compte avec ce nom d\'utilisateur existe déjà (créé manuellement). Connectez-vous avec votre mot de passe.';
        break;
      case 'no_verified_email':
        errorMessage = 'Aucun email vérifié trouvé sur votre compte GitHub. Veuillez ajouter un email vérifié dans vos paramètres GitHub et réessayer.';
        break;
      case 'oauth_failed':
        errorMessage = 'L\'authentification OAuth a échoué. Veuillez réessayer.';
        break;
    }

    showValidationError(errorDiv, errorMessage);
  }

  const form = document.getElementById('login-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const formData = new FormData(form);
    const username = (formData.get('username') as string) || '';
    const password = (formData.get('password') as string) || '';
    const errorDiv = document.getElementById('error-message');

    clearValidationError(errorDiv);
    const validation = validateLoginForm({ username, password });
    if (!validation.valid) {
      showValidationError(errorDiv, validation.error || 'Validation error');
      return;
    }

    try {
      const result = await authService.login(username.trim(), password);

      if (typeof result === 'object' && 'requires_2fa' in result && result.requires_2fa) {
        show2FAInput(ctx, result.temp_token);
        return;
      }

      ctx.updateNavigation();
      ctx.navigateTo('/');
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });
}

export function show2FAInput(ctx: AuthPageContext, tempToken: string): void {
  const content = document.getElementById('content');
  if (!content) return;

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.style.display = 'none';
  }

  const twoFactorDiv = document.createElement('div');
  twoFactorDiv.id = '2fa-input-section';
  twoFactorDiv.innerHTML = `
    <div class="auth-container">
      <h2>Code d'authentification à deux facteurs</h2>
      <p>Entrez le code à 6 chiffres depuis votre application d'authentification (Google Authenticator, Authy, etc.)</p>
      <form id="2fa-form" class="auth-form">
        <div class="form-group">
          <label for="2fa-code">Code 2FA</label>
          <input type="text" id="2fa-code" name="2fa-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="off">
        </div>
        <div class="form-group">
          <button type="submit" class="btn btn-primary">Vérifier</button>
          <button type="button" id="cancel-2fa" class="btn btn-secondary" style="margin-left: 1rem;">Annuler</button>
        </div>
        <div id="2fa-error-message" class="error-message"></div>
      </form>
    </div>
  `;

  content.appendChild(twoFactorDiv);

  const codeInput = document.getElementById('2fa-code') as HTMLInputElement;
  if (codeInput) {
    codeInput.focus();
  }

  const form = document.getElementById('2fa-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const code = (document.getElementById('2fa-code') as HTMLInputElement)?.value || '';
    const errorDiv = document.getElementById('2fa-error-message');

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      if (errorDiv) {
        errorDiv.textContent = 'Veuillez entrer un code à 6 chiffres';
        errorDiv.style.display = 'block';
      }
      return;
    }

    clearValidationError(errorDiv);

    try {
      await authService.complete2FALogin(tempToken, code);
      ctx.updateNavigation();
      ctx.navigateTo('/');
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });

  document.getElementById('cancel-2fa')?.addEventListener('click', () => {
    renderLoginPage(ctx);
  });
}

export function renderOAuth2FAPage(ctx: AuthPageContext): void {
  const content = document.getElementById('content');
  if (!content) return;

  const params = new URLSearchParams(window.location.search);
  const provider = params.get('provider') || 'OAuth';
  const cleanUrl = window.location.origin + window.location.pathname + '?provider=' + provider;
  window.history.replaceState({}, document.title, cleanUrl);

  content.innerHTML = `
    <div class="auth-container">
      <h2>Code d'authentification à deux facteurs</h2>
      <p>Vous vous connectez via ${provider === '42' ? '42' : provider === 'github' ? 'GitHub' : 'OAuth'}. Entrez le code à 6 chiffres depuis votre application d'authentification.</p>
      <form id="oauth-2fa-form" class="auth-form">
        <div class="form-group">
          <label for="oauth-2fa-code">Code 2FA</label>
          <input type="text" id="oauth-2fa-code" name="oauth-2fa-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="off">
        </div>
        <div class="form-group">
          <button type="submit" class="btn btn-primary">Vérifier</button>
          <button type="button" id="cancel-oauth-2fa" class="btn btn-secondary" style="margin-left: 1rem;">Annuler</button>
        </div>
        <div id="oauth-2fa-error-message" class="error-message"></div>
      </form>
    </div>
  `;

  const codeInput = document.getElementById('oauth-2fa-code') as HTMLInputElement;
  if (codeInput) {
    codeInput.focus();
  }

  const form = document.getElementById('oauth-2fa-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const code = (document.getElementById('oauth-2fa-code') as HTMLInputElement)?.value || '';
    const errorDiv = document.getElementById('oauth-2fa-error-message');

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      if (errorDiv) {
        errorDiv.textContent = 'Veuillez entrer un code à 6 chiffres';
        errorDiv.style.display = 'block';
      }
      return;
    }

    clearValidationError(errorDiv);

    try {
      const response = await fetch(`${ctx.apiBaseUrl}/auth/oauth/2fa/complete/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          two_factor_code: code
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '2FA verification failed');
      }

      const data = await response.json();

      authService.saveUser(data.user);

      ctx.updateNavigation();
      ctx.navigateTo('/');
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });

  document.getElementById('cancel-oauth-2fa')?.addEventListener('click', () => {
    ctx.navigateTo('/login');
  });
}

export function renderRegisterPage(ctx: AuthPageContext): void {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = registerTemplate();

  const form = document.getElementById('register-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const formData = new FormData(form);
    const username = (formData.get('username') as string) || '';
    const email = (formData.get('email') as string) || '';
    const displayName = (formData.get('display_name') as string) || '';
    const password = (formData.get('password') as string) || '';
    const passwordConfirm = (formData.get('password_confirm') as string) || '';
    const errorDiv = document.getElementById('error-message');

    clearValidationError(errorDiv);
    const validation = validateRegistrationForm({
      username,
      email,
      displayName,
      password,
      passwordConfirm,
    });
    if (!validation.valid) {
      showValidationError(errorDiv, validation.error || 'Validation error');
      return;
    }

    try {
      await authService.register(
        username.trim(),
        email.trim(),
        displayName.trim(),
        password,
        passwordConfirm
      );
      ctx.updateNavigation();
      ctx.navigateTo('/');
    } catch (error) {
      showValidationError(errorDiv, (error as Error).message);
    }
  });
}
