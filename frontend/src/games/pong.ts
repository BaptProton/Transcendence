import { PongGameEngine, type PongGameOptions } from './pong-engine';
import { PongGameRenderer } from './pong-render';

export class PongGame {
  private engine: PongGameEngine;
  private renderer: PongGameRenderer;
  private lastTime: number = performance.now();
  private animationFrameId: number | null = null;

  // creer une nouvelle instance de PongGameEngine avec les options fournies et une fonction de rappel pour la fin du jeu
  constructor(canvasId: string, options: PongGameOptions = {}) {
    const engineOptions = {
      ...options,
      onGameOver: (result: { winner: string; player1Score: number; player2Score: number; duration: number }) => {
        if (options.onGameOver) {
          options.onGameOver(result);
        }
        // Afficher l'écran de fin de jeu uniquement si ce n'est pas masqué (pour les tournois)
        if (!options.hideGameOverScreen) {
          let viewerContext: { isViewer: boolean; viewerWon: boolean; viewerPlayerNumber?: number } | undefined;

          if (this.engine.gameMode === 'vs_ai') {
            viewerContext = {
              isViewer: true,
              viewerWon: result.winner === 'player1',
              viewerPlayerNumber: 1
            };
          } else if (this.engine.gameMode === '2p_local') {
            viewerContext = {
              isViewer: false,
              viewerWon: false
            };
          }
          this.renderer.showGameOverScreen(undefined, viewerContext);
        }
      }
    };

    this.engine = new PongGameEngine(engineOptions);
    this.renderer = new PongGameRenderer(canvasId, this.engine, options.hidePlayerNames);

    this.gameLoop();
  }

  public start(): void {
    this.engine.start();
  }

  public stop(): void {
    this.engine.stop();
    this.renderer.cleanup();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public restart(): void {
    this.renderer.removeGameOverScreen();
    this.engine.restart();
  }

  private gameLoop(): void {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.engine.update(dt);
    this.renderer.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }
}
