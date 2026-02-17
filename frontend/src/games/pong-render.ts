import { PongGameEngine } from './pong-engine';
import { sanitizeHTML } from '../utils/helpers';

export class PongGameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: PongGameEngine;
  private playerNamesContainer: HTMLElement | null = null;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(canvasId: string, engine: PongGameEngine, hidePlayerNames: boolean = false) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas with id "${canvasId}" not found`);
    }
    this.canvas = canvas;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    this.ctx = ctx;

    this.engine = engine;

    // cache les dimensions pour éviter les forced reflows lors du nettoyage
    this.canvasWidth = engine.width;
    this.canvasHeight = engine.height;
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;

    if (!hidePlayerNames) {
      this.createPlayerNamesDisplay();
    }
  }

  private createPlayerNamesDisplay(): void {
    const existing = document.getElementById('player-names-display');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'player-names-display';
    container.style.cssText = `
      display: flex;
      align-items: center;
      width: ${this.canvasWidth}px;
      margin: 0 auto 10px auto;
      padding: 10px 20px;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid #00d4ff;
      border-radius: 8px 8px 0 0;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
    `;

    //affichage des noms des joueurs
    const player1Div = document.createElement('div');
    player1Div.style.cssText = 'color: #00d4ff; text-align: left; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    player1Div.textContent = this.engine.player1Name;

    const vsDiv = document.createElement('div');
    vsDiv.style.cssText = 'color: #fff; font-size: 14px; flex-shrink: 0; padding: 0 1rem;';
    vsDiv.textContent = 'VS';

    const player2Div = document.createElement('div');
    player2Div.style.cssText = 'color: #00d4ff; text-align: right; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    player2Div.textContent = this.engine.player2Name;

    container.appendChild(player1Div);
    container.appendChild(vsDiv);
    container.appendChild(player2Div);

    this.canvas.parentElement?.insertBefore(container, this.canvas);
    this.playerNamesContainer = container;
  }

  public render(): void {
    // nettoyage du canvas
    this.ctx.clearRect(0, 0, this.engine.width, this.engine.height);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.engine.width, this.engine.height);

    this.drawCenterLine();

    // afficher les raquettes
    this.ctx.fillStyle = '#FFF';
    this.ctx.fillRect(this.engine.player1.x, this.engine.player1.y, this.engine.player1.width, this.engine.player1.height);
    this.ctx.fillRect(this.engine.player2.x, this.engine.player2.y, this.engine.player2.width, this.engine.player2.height);

    // afficher la balle
    this.ctx.beginPath();
    this.ctx.arc(this.engine.ball.x, this.engine.ball.y, this.engine.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.drawScores();
    if (this.engine.paused) {
      this.drawPauseOverlay();
    }
    this.drawControlsHint();
    this.drawBallSpeed();
    this.drawGameTime();
    this.drawUiElements();
  }

  private drawCenterLine(): void {
    this.ctx.strokeStyle = '#FFF';
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.engine.width / 2, 0);
    this.ctx.lineTo(this.engine.width / 2, this.engine.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawScores(): void {
    this.ctx.font = '48px monospace';
    this.ctx.fillStyle = '#ffffffff';
    this.ctx.fillText(this.engine.player1.score.toString(), this.engine.width / 4, 60);
    this.ctx.fillText(this.engine.player2.score.toString(), (3 * this.engine.width) / 4, 60);
  }

  private drawPauseOverlay(): void {
    // Superposition semi-transparente
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.engine.width, this.engine.height);

    // Texte de pause
    this.ctx.font = 'bold 48px monospace';
    this.ctx.fillStyle = '#00d4ff';
    this.ctx.shadowColor = '#00d4ff';
    this.ctx.shadowBlur = 20;
    const text = this.engine.started ? 'PAUSED' : 'PRESS START';
    const textWidth = this.ctx.measureText(text).width;
    this.ctx.fillText(text, (this.engine.width - textWidth) / 2, this.engine.height / 2 - 20);
    this.ctx.shadowBlur = 0;

    // Instructions
    this.ctx.font = '20px monospace';
    this.ctx.fillStyle = '#fff';
    const resumeText = this.engine.started ? 'Appuyez sur ESPACE ou ESC pour continuer' : 'Appuyez sur ESPACE ou ESC pour commencer';
    const resumeWidth = this.ctx.measureText(resumeText).width;
    this.ctx.fillText(resumeText, (this.engine.width - resumeWidth) / 2, this.engine.height / 2 + 40);
  }

  private drawControlsHint(): void {
    this.ctx.font = '14px monospace';
    this.ctx.fillStyle = '#888';
    if (this.engine.gameMode === '2p_local') {
      this.ctx.fillText('P1: W/S | P2: ↑/↓ | SPACE/ESC: Start/Pause', 10, this.engine.height - 10);
    } else if (this.engine.gameMode === 'vs_ai') {
      this.ctx.fillText('Movement: W/S | SPACE/ESC: Start/Pause', 10, this.engine.height - 10);
    } else {
      this.ctx.fillText('Movement: ↑/↓', 10, this.engine.height - 10);
    }
  }

  private drawBallSpeed(): void {
    this.ctx.font = '14px monospace';
    this.ctx.fillStyle = '#888';
    this.ctx.fillText(`Ball Speed: ${(this.engine.ball.speed / 100).toFixed(2)}`, this.engine.width - 130, this.engine.height - 10);
  }

  private drawGameTime(): void {
    const totalSeconds = Math.floor(this.engine.gameTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeString = `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;

    this.ctx.font = '17px monospace';
    this.ctx.fillStyle = '#888';
    const textWidth = this.ctx.measureText(`Time: ${timeString}`).width;
    this.ctx.fillText(`Time: ${timeString}`, (this.engine.width - textWidth) / 2, 0 + 30);
  }

  private drawUiElements(): void {
    const playerInfoDiv = document.getElementById('player-info');
    if (playerInfoDiv) {
      playerInfoDiv.textContent = `Joueur 1: ${this.engine.player1.score} - Joueur 2: ${this.engine.player2.score}`;
    }
  }

  public showGameOverScreen(
    onRestart?: () => void,
    viewerContext?: {
      isViewer: boolean;
      viewerWon: boolean;
      viewerPlayerNumber?: number;
    },
    options?: {
      forfeit?: boolean;
      hideRestart?: boolean;
      message?: string;
    }
  ): void {
    // Créer overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';

    const content = document.createElement('div');
    content.className = 'game-over-content';

    const winnerName = sanitizeHTML(this.engine.winner === 'player1' ? this.engine.player1Name : this.engine.player2Name);
    const safeP1Name = sanitizeHTML(this.engine.player1Name);
    const safeP2Name = sanitizeHTML(this.engine.player2Name);

    const isForfeit = options?.forfeit === true;
    const hideRestart = options?.hideRestart === true || isForfeit;

    let titleText = 'FIN DE PARTIE!';
    let titleClass = 'game-over-title neutral';

    if (viewerContext?.isViewer) {
      if (viewerContext.viewerWon) {
        titleText = isForfeit ? 'VICTOIRE PAR FORFAIT!' : 'VICTOIRE!';
        titleClass = 'game-over-title victory';
      } else {
        titleText = isForfeit ? 'DÉFAITE PAR FORFAIT!' : 'DÉFAITE!';
        titleClass = 'game-over-title defeat';
        content.classList.add('defeat');
      }
    }

    const winnerLine = options?.message
      ? options.message
      : isForfeit
        ? `${winnerName} gagne par forfait!`
        : `${winnerName} gagne!`;

    const buttonsHtml = `
      <div class="game-over-buttons">
        ${hideRestart ? '' : '<button id="restart-btn" class="pong-btn">Rejouer</button>'}
        <button id="accueil-btn" class="pong-btn">Menu</button>
      </div>
    `;

    content.innerHTML = `
      <h1 class="${titleClass}">${titleText}</h1>
      <p class="game-over-winner">${winnerLine}</p>
      <div class="game-over-score-box">
        <p class="game-over-score-label">Score Final</p>
        <p class="game-over-duration">${safeP1Name} vs ${safeP2Name}</p>
        <p class="game-over-duration">Durée: ${Math.floor(this.engine.gameTime / 60)}:${Math.floor(this.engine.gameTime % 60).toString().padStart(2, '0')}</p>
        <p class="game-over-final-score">
          ${this.engine.player1.score} - ${this.engine.player2.score}
        </p>
      </div>
      ${buttonsHtml}
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Bouton restart - appelle le callback si fourni
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        if (onRestart) {
          onRestart();
        } else {
          overlay.remove();
          if (this.engine?.restart) {
            this.engine.restart();
          }
        }
      });
    }

    const accueilBtn = document.getElementById('accueil-btn');
    if (accueilBtn) {
      accueilBtn.addEventListener('click', () => {
        overlay.remove();
        if (this.engine?.stop) {
          this.engine.stop();
        }
        window.location.href = '/';
      });
    }
  }

  public removeGameOverScreen(): void {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.remove();
  }

  public cleanup(): void {
    if (this.playerNamesContainer) {
      this.playerNamesContainer.remove();
      this.playerNamesContainer = null;
    }

    this.removeGameOverScreen();

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    // Libérer les références
    // @ts-ignore - Nullifying for cleanup
    this.ctx = null;
    // @ts-ignore - Nullifying for cleanup
    this.canvas = null;
    // @ts-ignore - Nullifying for cleanup
    this.engine = null;
  }
}
