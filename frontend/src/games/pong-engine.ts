import { statsService } from "@/services/stats.service";
import { authService } from '@/services/auth.service';
import { createAIState, updateAI as updateAIState, type AIState, type AIDifficulty } from './pong-ai';

export const VIRTUAL_WIDTH = 800;
export const VIRTUAL_HEIGHT = 600;

export interface Ball {
  x: number;
  y: number;
  radius: number;
  speed: number;
  velocityX: number;
  velocityY: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  speed: number;
  velocityY: number;
  upPressed: boolean;
  downPressed: boolean;
}

export interface PongGameOptions {
  width?: number;
  height?: number;
  initialBallSpeed?: number;
  maxBallSpeed?: number;
  speedIncrement?: number;
  gameMode?: '2p_local' | 'vs_ai';
  maxScore?: number;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  player1Name?: string;
  player2Name?: string;
  hideGameOverScreen?: boolean;
  hidePlayerNames?: boolean;
  initialScores?: { player1: number; player2: number };
  skipAutoSaveStats?: boolean; // Désactiver la sauvegarde automatique des stats (pour les tournois)
  onGameOver?: (result: { winner: string; player1Score: number; player2Score: number; duration: number }) => void;
}

export class PongGameEngine {
  public width: number;
  public height: number;
  public gameMode: string;
  public ball: Ball;
  public player1: Paddle;
  public player2: Paddle;
  public running: boolean = false;
  public paused: boolean = true;
  public gameOver: boolean = false;
  public winner: string | null = null;
  public started: boolean = false;
  public player1Name: string;
  public player2Name: string;
  public gameTime: number = 0;
  
  private initialBallSpeed: number;
  private maxBallSpeed: number;
  private speedIncrement: number;
  private paddleHeight: number;
  private paddleWidth: number;
  private maxScore: number;
  private aiDifficulty: AIDifficulty;
  private onGameOver: ((result: { winner: string; player1Score: number; player2Score: number; duration: number }) => void) | null;
  private keyDownHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;
  private aiState: AIState;
  private skipAutoSaveStats: boolean;

  constructor(options: PongGameOptions = {}) {
    // Paramètres de jeu
    this.width = options.width || 800;
    this.height = options.height || 600;

    // mode de jeu
    this.gameMode = options.gameMode || '2p_local';

    // Balle
    this.initialBallSpeed = options.initialBallSpeed || 350;
    this.maxBallSpeed = options.maxBallSpeed || 1200;
    this.speedIncrement = options.speedIncrement || 45;
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      radius: 10,
      speed: this.initialBallSpeed,
      velocityX: this.initialBallSpeed * 0.6,
      velocityY: this.initialBallSpeed * 0.2,
    };

    // Raquettes
    this.paddleHeight = 90;
    this.paddleWidth = 12;
    this.player1 = {
      x: 30,
      y: VIRTUAL_HEIGHT / 2 - this.paddleHeight / 2,
      width: this.paddleWidth,
      height: this.paddleHeight,
      score: options.initialScores?.player1 || 0,
      speed: 12,
      velocityY: 0,
      upPressed: false,
      downPressed: false,
    };

    this.player2 = {
      x: VIRTUAL_WIDTH - 30 - this.paddleWidth,
      y: VIRTUAL_HEIGHT / 2 - this.paddleHeight / 2,
      width: this.paddleWidth,
      height: this.paddleHeight,
      score: options.initialScores?.player2 || 0,
      speed: 12,
      velocityY: 0,
      upPressed: false,
      downPressed: false,
    };

    // Score max
    this.maxScore = options.maxScore || 5;

    // Paramètres IA
    this.aiDifficulty = options.aiDifficulty || 'medium';
    this.aiState = createAIState(this.height);

    // Noms des joueurs
    this.player1Name = options.player1Name || 'Player 1';
    this.player2Name = options.player2Name || (this.gameMode === 'vs_ai' ? `IA (${this.aiDifficulty})` : 'Player 2');

    // Callbacks
    this.onGameOver = options.onGameOver || null;

    // Option pour désactiver la sauvegarde automatique des stats.
    // Par défaut: si l'utilisateur n'est pas connecté, on ne tente pas de sauvegarder.
    this.skipAutoSaveStats = options.skipAutoSaveStats ?? !authService.isAuthenticated();

    // Configuration des contrôles
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.setupControls();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key.toLowerCase() === ' ' || e.key.toLowerCase() === 'arrowup' || e.key.toLowerCase() === 'arrowdown' || e.key.toLowerCase() === 'arrowleft' || e.key.toLowerCase() === 'arrowright') {
          e.preventDefault();
      }
    switch (e.key.toLowerCase()) {
      case 'w':
        this.player1.upPressed = true;
        break;
      case 's':
        this.player1.downPressed = true;
        break;
      case 'arrowup':
        e.preventDefault();
        this.player2.upPressed = true;
        break;
      case 'arrowdown':
        e.preventDefault();
        this.player2.downPressed = true;
        break;
      case ' ':
      case 'escape':
        e.preventDefault();
        this.togglePause();
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.key.toLowerCase() === 'arrowup' || e.key.toLowerCase() === 'arrowdown' || e.key.toLowerCase() === 'arrowleft' || e.key.toLowerCase() === 'arrowright') {
          e.preventDefault();
      }
    switch (e.key.toLowerCase()) {
      case 'w':
        this.player1.upPressed = false;
        break;
      case 's':
        this.player1.downPressed = false;
        break;
      case 'arrowup':
        this.player2.upPressed = false;
        break;
      case 'arrowdown':
        this.player2.downPressed = false;
        break;
    }
  }

  // Joueur 1 controles: W/S
  // Joueur 2 controles: Fleches Haut/Bas
  private setupControls(): void {
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
  }

  public start(): void {
    this.running = true;
    this.paused = true;
    this.started = false;
    this.gameTime = 0;
    this.resetBall();
  }

  public togglePause(): void {
    if (this.gameOver) return;
    if (!this.started) {
      this.started = true;
    }
    this.paused = !this.paused;
  }

  public stop(): void {
    this.running = false;
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
  }

  private setBallDirection(directionSign: 1 | -1 = (Math.random() < 0.5 ? 1 : -1)): void {
    const maxAngle = Math.PI / 4;
    const angle = (Math.random() * maxAngle) - maxAngle / 2;
    this.ball.velocityX = directionSign * this.ball.speed * Math.cos(angle);
    this.ball.velocityY = this.ball.speed * Math.sin(angle);
  }

  public resetBall(directionSign?: 1 | -1): void {
    this.ball.x = this.width / 2;
    this.ball.y = this.height / 2;
    this.ball.speed = this.initialBallSpeed;
    const dir = directionSign ?? (Math.random() < 0.5 ? 1 : -1);
    this.setBallDirection(dir);
  }

  private computeVelocities(): void {
    // Joueur 1
    if (this.player1.upPressed) {
      this.player1.velocityY = -this.player1.speed * 60;  // 720 px/s (vitesse=12)
    } else if (this.player1.downPressed) {
      this.player1.velocityY = this.player1.speed * 60;
    } else {
      this.player1.velocityY = 0;
    }

    // Joueur 2 (humain OU IA - même système de mouvement)
    // L'IA définit upPressed/downPressed dans updateAI(), donc le calcul est identique
    if (this.player2.upPressed) {
      this.player2.velocityY = -this.player2.speed * 60;
    } else if (this.player2.downPressed) {
      this.player2.velocityY = this.player2.speed * 60;
    } else {
      this.player2.velocityY = 0;
    }
  }

  private updatePaddle(player: Paddle, dt: number): void {
    player.y += player.velocityY * dt;
    
    // Limiter la position de la raquette
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > VIRTUAL_HEIGHT) {
      player.y = VIRTUAL_HEIGHT - player.height;
    }
  }

  // Logique IA
  private updateAI(): void {
    this.aiState = updateAIState(
      this.aiState,
      this.ball,
      this.player2,
      this.player1,
      this.height,
      this.aiDifficulty
    );
  }
  private checkCollisionWithPlayer(b: Ball, player: Paddle): boolean {
    return (
      b.x - b.radius < player.x + player.width &&
      b.x + b.radius > player.x &&
      b.y + b.radius > player.y &&
      b.y - b.radius < player.y + player.height
    )
  }

  private updateBall(dt: number): void {
    const prevX = this.ball.x
    const prevY = this.ball.y
    const dx = this.ball.velocityX * dt
    const dy = this.ball.velocityY * dt
    const moveDist = Math.hypot(dx, dy)
    // choisir la longueur du pas par rapport au rayon de la balle (plus petit -> plus précis)
    const stepLen = Math.max(1, Math.floor(this.ball.radius * 0.5))
    const steps = Math.max(1, Math.ceil(moveDist / stepLen))

    let collided = false
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const nx = prevX + dx * t
      const ny = prevY + dy * t

      // rebond haut/bas
      if (ny + this.ball.radius > VIRTUAL_HEIGHT) {
        this.ball.y = VIRTUAL_HEIGHT - this.ball.radius
        this.ball.velocityY = -this.ball.velocityY
        collided = true
        break
      } else if (ny - this.ball.radius < 0) {
        this.ball.y = this.ball.radius
        this.ball.velocityY = -this.ball.velocityY
        collided = true
        break
      }

      // test collision contre les deux raquettes à cette position intermédiaire
      const tempBall = { ...this.ball, x: nx, y: ny }
      const hitP1 = this.checkCollisionWithPlayer(tempBall, this.player1)
      const hitP2 = this.checkCollisionWithPlayer(tempBall, this.player2)
      if (hitP1 || hitP2) {
        const player = hitP1 ? this.player1 : this.player2
        const collidePoint = ny - (player.y + player.height / 2)
        const normalizedCollidePoint = collidePoint / (player.height / 2)
        const angleRad = (Math.PI / 4) * normalizedCollidePoint
        const direction: 1 | -1 = player.x < VIRTUAL_WIDTH / 2 ? 1 : -1

        // incrémenter la vitesse 
        if (this.ball.speed < this.maxBallSpeed / 4 * 3) {
          this.ball.speed = Math.min(this.maxBallSpeed, this.ball.speed + (this.speedIncrement * 1.5))
        }
        else if (this.ball.speed < this.maxBallSpeed) {
          this.ball.speed = Math.min(this.maxBallSpeed, this.ball.speed + this.speedIncrement)
        }
        else {
          this.ball.speed = this.maxBallSpeed
        }

        // définir la vélocité réfléchie à partir de la vitesse et de l'angle d'impact
        this.ball.velocityX = direction * this.ball.speed * Math.cos(angleRad)
        this.ball.velocityY = this.ball.speed * Math.sin(angleRad)

        // repousser la balle hors de la raquette
        if (player.x < VIRTUAL_WIDTH / 2) {
          this.ball.x = player.x + player.width + this.ball.radius + 0.1
        } else {
          this.ball.x = player.x - this.ball.radius - 0.1
        }

        collided = true
        break
      }
    }

    if (!collided) {
      this.ball.x = prevX + dx
      this.ball.y = prevY + dy
    }
    
    // Score
    if (this.ball.x - this.ball.radius < 0) {
      this.player2.score++;
      this.onScore('player2');
    }
    else if (this.ball.x + this.ball.radius > this.width) {
      this.player1.score++;
      this.onScore('player1');
    }
  }

  private onScore(_scorer: string): void {

    this.resetBall();

    if (this.player1.score >= this.maxScore) {
      this.endGame('player1');
    } else if (this.player2.score >= this.maxScore) {
      this.endGame('player2');
    }
  }

  private async endGame(winner: string): Promise<void> {
  this.gameOver = true;
  this.running = false;
  this.winner = winner;

  const duration = this.gameTime;

  // Sauvegarder les stats (sauf si désactivé, ex: tournois / invité)
  // On re-check l'auth au moment de la sauvegarde (l'utilisateur peut avoir été déconnecté entre temps).
  if (!this.skipAutoSaveStats && authService.isAuthenticated()) {
    const success = await statsService.saveMatch({
      winner: winner,
      duration: Math.floor(duration),
      player1Score: this.player1.score,
      player2Score: this.player2.score,
      gameMode: this.gameMode,
      opponentID: null
    });

    if (!success) {
      console.error('[ERROR] Failed to save match');
    }
  }

  // Callback pour l'UI
  if (this.onGameOver) {
    this.onGameOver({
      winner: winner,
      player1Score: this.player1.score,
      player2Score: this.player2.score,
      duration: Math.floor(duration),
    });
  }
}


  public restart(): void {
    this.player1.score = 0;
    this.player2.score = 0;

    this.gameOver = false;
    this.winner = null;
    this.paused = true;
    this.started = false;
    this.running = true;
    this.gameTime = 0;
    
    this.resetBall();
    this.player1.y = this.height / 2 - this.player1.height / 2;
    this.player2.y = this.height / 2 - this.player2.height / 2;
  }

  public update(dt: number): void {
    if (!this.running || this.paused || this.gameOver) return;

    this.gameTime += dt;

    // Pour l'IA, mettre à jour les décisions AVANT de calculer les vélocités
    // Cela permet à l'IA d'utiliser le même système de mouvement que le joueur humain
    if (this.gameMode === 'vs_ai') {
      this.updateAI();
    }

    this.computeVelocities();

    this.updatePaddle(this.player1, dt);
    this.updatePaddle(this.player2, dt);

    this.updateBall(dt);
  }
}
