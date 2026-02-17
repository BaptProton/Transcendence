import type { Ball, Paddle } from './pong-engine';

export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type AIDecision = 'up' | 'down' | 'none';

export interface AIState {
  lastUpdate: number;
  targetY: number;
  decision: AIDecision;
}

export function createAIState(gameHeight: number): AIState {
  return {
    lastUpdate: 0,
    targetY: gameHeight / 2,
    decision: 'none',
  };
}

export function getPredictionError(difficulty: AIDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 90;
    case 'medium':
      return 40;
    case 'hard':
    default:
      return 1;
  }
}

export function predictBallImpactY(
  ball: Ball,
  paddleX: number,
  gameHeight: number
): number {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.velocityX;
  let vy = ball.velocityY;
  const radius = ball.radius;

  // Direction de la balle
  if (vx <= 0) return gameHeight / 2;

  let steps = 0;
  const maxSteps = 1000;

  while (x + radius < paddleX && steps < maxSteps) {
    x += vx;
    y += vy;

    // Balle rebondit haut
    if (y - radius < 0) {
      y = radius + (radius - y);
      vy = -vy;
    }
    // Balle rebondit bas
    else if (y + radius > gameHeight) {
      y = gameHeight - radius - (y + radius - gameHeight);
      vy = -vy;
    }
    steps++;
  }
  return y;
}

export function updateAI(
  state: AIState,
  ball: Ball,
  aiPaddle: Paddle,
  playerPaddle: Paddle,
  gameHeight: number,
  difficulty: AIDifficulty,
  updateInterval: number = 1000
): AIState {
  const now = performance.now();
  let newState = { ...state };
  aiPaddle.speed = playerPaddle.speed;

  if (now - state.lastUpdate >= updateInterval) {
    newState.lastUpdate = now;

    const ballComingToAI = ball.velocityX > 0;

    if (ballComingToAI) {
      const impactY = predictBallImpactY(ball, aiPaddle.x, gameHeight);
      const predictionError = getPredictionError(difficulty);
      const randomOffset = (Math.random() - 0.5) * predictionError;
      newState.targetY = impactY + randomOffset;
    } else {
      newState.targetY = gameHeight / 2;
    }
  }

  // Decision de la balle par rapport a la cible calculer
  const paddleCenter = aiPaddle.y + aiPaddle.height / 2;
  const margin = 5; // Pour eviter le tremblement
  if (paddleCenter < newState.targetY - margin) {
    newState.decision = 'down';
  } else if (paddleCenter > newState.targetY + margin) {
    newState.decision = 'up';
  } else {
    newState.decision = 'none';
  }

  // Simule la pression des touche haut bas
  aiPaddle.upPressed = (newState.decision === 'up');
  aiPaddle.downPressed = (newState.decision === 'down');

  return newState;
}
