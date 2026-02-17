export function registerTemplate(): string {
  return `
    <div class="auth-container">
      <h2>Inscription</h2>
      <form id="register-form" class="auth-form">
        <div class="form-group">
          <label for="username">Nom d'utilisateur (3-20 caractères)</label>
          <input type="text" id="username" name="username" required minlength="3" maxlength="20" autocomplete="username">
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required maxlength="100" autocomplete="email">
        </div>
        <div class="form-group">
          <label for="display_name">Nom d'affichage (2-20 caractères)</label>
          <input type="text" id="display_name" name="display_name" required minlength="2" maxlength="20" autocomplete="nickname">
        </div>
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label for="password_confirm">Confirmer le mot de passe</label>
          <input type="password" id="password_confirm" name="password_confirm" required autocomplete="new-password">
        </div>
        <div class="form-group">
          <button type="submit" class="btn btn-primary">S'inscrire</button>
        </div>
        <div class="form-footer">
          <p>Déjà un compte ? <a href="/login" data-route="/login">Se connecter</a></p>
        </div>
        <div id="error-message" class="error-message"></div>
      </form>
    </div>
  `;
}
