export function pongModeTemplate(): string {
  return `
    <div class="game-page">
      <h2>🏓 Pong</h2>

      <div class="game-mode-selector">
        <h3>Choisissez un mode de jeu :</h3>
        <div class="mode-buttons">
          <button id="mode-local" class="btn btn-primary">2 Joueurs (Local)</button>
          <button id="mode-ai" class="btn btn-secondary">vs IA</button>
          <button id="mode-tournament" class="btn btn-tournament-mode">🏆 Tournoi</button>
        </div>
      </div>

      <div id="ai-difficulty-selector" style="display: none; margin-top: 2rem;">
        <h3>Choisissez la difficulté :</h3>
        <div class="mode-buttons" style="margin-top: 1rem;">
          <button id="ai-easy" class="btn btn-success">Facile</button>
          <button id="ai-medium" class="btn btn-warning" style="background: #ffaa00;">Moyen</button>
          <button id="ai-hard" class="btn btn-danger" style="background: #ff4d4f;">Difficile</button>
        </div>
        <div style="margin-top: 1rem;">
          <button id="back-to-mode-select" class="btn btn-secondary">Retour</button>
        </div>
      </div>

      <div id="game-container" style="display: none; text-align: center; margin-top: 2rem;">
        <canvas id="pongCanvas" width="800" height="600" style="border: 2px solid #00d4ff; background: #000;"></canvas>
        <div style="margin-top: 1rem;">
          <button id="back-to-modes" class="btn btn-secondary">Retour aux modes</button>
        </div>
      </div>
    </div>
  `;
}
