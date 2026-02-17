import { PongGame } from '../games/pong';
import { pongModeTemplate } from '../templates';

export interface PongPageContext {
  navigateTo: (route: string) => void;
  currentPongGame: any;
  setCurrentPongGame: (game: any) => void;
}

export function renderPongPage(ctx: PongPageContext): void {
  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = pongModeTemplate();

  document.getElementById('mode-local')?.addEventListener('click', () => {
    startPongGame(ctx, '2p_local');
  });

  document.getElementById('mode-ai')?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      (document.querySelector('.game-mode-selector') as HTMLElement)!.style.display = 'none';
      document.getElementById('ai-difficulty-selector')!.style.display = 'block';
    });
  });

  document.getElementById('mode-tournament')?.addEventListener('click', () => {
    ctx.navigateTo('/tournament');
  });

  document.getElementById('ai-easy')?.addEventListener('click', () => {
    startPongGame(ctx, 'vs_ai', 'easy');
  });

  document.getElementById('ai-medium')?.addEventListener('click', () => {
    startPongGame(ctx, 'vs_ai', 'medium');
  });

  document.getElementById('ai-hard')?.addEventListener('click', () => {
    startPongGame(ctx, 'vs_ai', 'hard');
  });

  document.getElementById('back-to-mode-select')?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      document.getElementById('ai-difficulty-selector')!.style.display = 'none';
      (document.querySelector('.game-mode-selector') as HTMLElement)!.style.display = 'block';
    });
  });

  document.getElementById('back-to-modes')?.addEventListener('click', () => {
    if (ctx.currentPongGame) {
      ctx.currentPongGame.stop();
      ctx.setCurrentPongGame(null);
    }
    requestAnimationFrame(() => {
      (document.querySelector('.game-mode-selector') as HTMLElement)!.style.display = 'block';
      document.getElementById('ai-difficulty-selector')!.style.display = 'none';
      document.getElementById('game-container')!.style.display = 'none';
    });
  });
}

function startPongGame(
  ctx: PongPageContext,
  mode: '2p_local' | 'vs_ai',
  aiDifficulty?: 'easy' | 'medium' | 'hard'
): void {
  requestAnimationFrame(() => {
    (document.querySelector('.game-mode-selector') as HTMLElement)!.style.display = 'none';
    document.getElementById('ai-difficulty-selector')!.style.display = 'none';
    document.getElementById('game-container')!.style.display = 'block';
  });

  if (ctx.currentPongGame) {
    ctx.currentPongGame.stop();
  }

  const pongGame = new PongGame('pongCanvas', {
    gameMode: mode,
    aiDifficulty: aiDifficulty || 'medium',
  });

  ctx.setCurrentPongGame(pongGame);
  pongGame.start();
}
