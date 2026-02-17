export function notFoundTemplate(): string {
  return `
    <div class="not-found">
      <h2>404 - Page non trouvée</h2>
      <p>La page demandée n'existe pas.</p>
      <a href="/" data-route="/" class="btn btn-primary">Retour à l'accueil</a>
    </div>
  `;
}
