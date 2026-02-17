export function loginTemplate(): string {
  return `
    <div class="auth-container">
      <h2>Connexion</h2>
      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label for="username">Nom d'utilisateur</label>
          <input type="text" id="username" name="username" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        <div class="form-group">
          <button type="submit" class="btn btn-primary">Se connecter</button>
        </div>
        <div class="form-footer">
          <p>Pas encore de compte ? <a href="/register" data-route="/register">S'inscrire</a></p>
        </div>
        <div id="error-message" class="error-message"></div>
      </form>

      <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="text-align: center; margin-bottom: 1rem; color: #888;">Ou se connecter avec :</p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <a href="/api/auth/oauth/42/" class="btn" style="background: #00babc; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 4px; display: inline-block;">
            Se connecter avec 42
          </a>
          <a href="/api/auth/oauth/github/" class="btn" style="background: #333; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 4px; display: inline-block;">
            Se connecter avec GitHub
          </a>
        </div>
      </div>
    </div>
  `;
}
