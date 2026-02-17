import { authService } from '../services/auth.service';
import { tournamentManager } from '../services/tournament.service';
import { statsService } from '../services/stats.service';
import { PongGame } from '../games/pong';
import {
  tournamentPageTemplate,
  participantItemTemplate,
  emptyParticipantsTemplate,
  matchCardTemplate,
  bracketRoundTemplate,
  emptyBracketTemplate,
  tournamentGameTemplate,
  tournamentResultTemplate,
  tournamentWinnerStatusTemplate,
  nextMatchStatusTemplate,
} from '../templates';
import type { Participant, TournamentMatch, TournamentResultData } from '../types';
import { validateTournamentAlias } from '../utils/validation';

export interface TournamentPageContext {
  navigateTo: (route: string) => void;
  currentPongGame: any;
  setCurrentPongGame: (game: any) => void;
}

export function renderTournamentPage(ctx: TournamentPageContext): void {
  const content = document.getElementById('content');
  if (!content) return;

  const defaultAlias = authService.currentUser?.display_name || authService.currentUser?.username || '';
  content.innerHTML = tournamentPageTemplate(defaultAlias);

  bindTournamentEvents(ctx);
  updateTournamentUI(ctx);
}

function bindTournamentEvents(ctx: TournamentPageContext): void {
  const form = document.getElementById('tournament-alias-form') as HTMLFormElement | null;
  const aliasInput = document.getElementById('alias-input') as HTMLInputElement | null;

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!aliasInput) return;

    const alias = aliasInput.value;
    const validation = validateTournamentAlias(alias);
    if (!validation.valid) {
      displayTournamentMessage(validation.error || 'Alias invalide', 'error');
      return;
    }

    try {
      tournamentManager.registerPlayer(alias.trim());
      aliasInput.value = '';
      displayTournamentMessage(`${alias.trim()} rejoint la compétition.`, 'success');
      updateTournamentUI(ctx);
    } catch (error) {
      displayTournamentMessage((error as Error).message, 'error');
    }
  });

  document.getElementById('start-tournament')?.addEventListener('click', () => {
    if (tournamentManager.hasStarted()) {
      const winner = tournamentManager.getWinner();
      if (winner) {
        tournamentManager.reset();
        displayTournamentMessage('Tournoi terminé. Veuillez réinscrire les joueurs.', 'info');
        updateTournamentUI(ctx);
      } else {
        displayTournamentMessage('Un bracket est déjà en cours. Réinitialisez avant de régénérer.', 'error');
      }
      return;
    }

    const participants = tournamentManager.getParticipants();
    if (participants.length < 2) {
      displayTournamentMessage('Deux joueurs minimum sont requis.', 'error');
      return;
    }

    tournamentManager.startTournament();
    displayTournamentMessage('Bracket généré ! Bonne chance aux joueurs.', 'success');
    updateTournamentUI(ctx);
  });

  document.getElementById('reset-tournament')?.addEventListener('click', () => {
    tournamentManager.reset();
    displayTournamentMessage('Tournoi réinitialisé.', 'info');
    updateTournamentUI(ctx);
  });
}

function displayTournamentMessage(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const box = document.getElementById('tournament-message');
  if (!box) return;

  let color = '#00d4ff';
  if (type === 'error') color = '#ff4d4f';
  if (type === 'success') color = '#4caf50';

  box.textContent = message;
  box.setAttribute('style', `display: block; color: ${color}; font-weight: bold;`);
}

function updateTournamentUI(ctx: TournamentPageContext): void {
  renderParticipantList();
  renderTournamentBracket(ctx);
  updateRegistrationState();
  renderTournamentStatus();
}

function renderParticipantList(): void {
  const container = document.getElementById('tournament-participants');
  const participants = tournamentManager.getParticipants() as Participant[];
  const startBtn = document.getElementById('start-tournament') as HTMLButtonElement | null;
  const hasStarted = tournamentManager.hasStarted();
  const hasWinner = tournamentManager.getWinner() !== null;

  if (!container) return;

  if (!participants.length) {
    container.innerHTML = emptyParticipantsTemplate();
  } else {
    container.innerHTML = participants.map((p) => participantItemTemplate(p)).join('');
  }

  if (startBtn) {
    startBtn.disabled = hasWinner ? false : (participants.length < 2 || hasStarted);
  }
}

function updateRegistrationState(): void {
  const hasStarted = tournamentManager.hasStarted();
  const form = document.getElementById('tournament-alias-form') as HTMLFormElement | null;
  const aliasInput = document.getElementById('alias-input') as HTMLInputElement | null;
  const submitBtn = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;

  if (aliasInput) aliasInput.disabled = hasStarted;
  if (submitBtn) submitBtn.disabled = hasStarted;
}

function renderTournamentBracket(ctx: TournamentPageContext): void {
  const container = document.getElementById('tournament-bracket');
  if (!container) return;

  const matches = tournamentManager.getAllMatches() as TournamentMatch[];

  if (!matches.length) {
    container.innerHTML = emptyBracketTemplate();
    return;
  }

  const rounds = new Map<number, TournamentMatch[]>();
  matches.forEach((match) => {
    const list = rounds.get(match.round) || [];
    list.push(match);
    rounds.set(match.round, list);
  });

  const html = Array.from(rounds.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => {
      const matchesHtml = roundMatches.map((match) => matchCardTemplate(match)).join('');
      return bracketRoundTemplate(round, matchesHtml);
    })
    .join('');

  container.innerHTML = `<div class="bracket-rounds">${html}</div>`;

  container.querySelectorAll<HTMLButtonElement>('[data-play-match]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const matchId = Number(btn.getAttribute('data-match-id'));
      startTournamentMatch(ctx, matchId);
    });
  });
}

function startTournamentMatch(ctx: TournamentPageContext, matchId: number): void {
  const match = tournamentManager.startMatch(matchId);
  if (!match || !match.player2) {
    displayTournamentMessage('Impossible de démarrer ce match.', 'error');
    return;
  }

  const player1Name = match.player1.alias;
  const player2Name = match.player2.alias;
  const player1UserId = match.player1.userId;
  const player2UserId = match.player2.userId;

  displayTournamentMessage(`Match lancé : ${player1Name} vs ${player2Name}`, 'success');

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = tournamentGameTemplate(player1Name, player2Name);

  if (ctx.currentPongGame) {
    ctx.currentPongGame.stop();
    ctx.setCurrentPongGame(null);
  }

  const currentUserId = authService.currentUser?.id || null;
  const uniqueMatchId = `tournament-${matchId}-${Date.now()}`;

  const pongGame = new PongGame('tournamentPongCanvas', {
    gameMode: '2p_local',
    player1Name: player1Name,
    player2Name: player2Name,
    maxScore: 5,
    hideGameOverScreen: true,
    hidePlayerNames: true,
    skipAutoSaveStats: true,
    onGameOver: async (result) => {
      const existingOverlay = document.getElementById('game-over-overlay');
      if (existingOverlay) existingOverlay.remove();

      const p1Score = result.player1Score;
      const p2Score = result.player2Score;
      const winnerName = p1Score > p2Score ? player1Name : player2Name;

      const userIsPlayer1 = currentUserId !== null && player1UserId === currentUserId;
      const userIsPlayer2 = currentUserId !== null && player2UserId === currentUserId;

      if (userIsPlayer1 || userIsPlayer2) {
        if (authService.isAuthenticated()) {
          const adjustedPlayer1Score = userIsPlayer1 ? p1Score : p2Score;
          const adjustedPlayer2Score = userIsPlayer1 ? p2Score : p1Score;
          const adjustedWinner = adjustedPlayer1Score > adjustedPlayer2Score ? 'player1' : 'player2';

          try {
            await statsService.saveMatch({
              winner: adjustedWinner,
              duration: result.duration,
              player1Score: adjustedPlayer1Score,
              player2Score: adjustedPlayer2Score,
              gameMode: 'tournament',
              opponentID: null,
              matchId: uniqueMatchId
            });
          } catch (error) {
            console.error('[ERROR] Error saving tournament stats:', error);
          }
        }
      }

      try {
        tournamentManager.completeMatchWithScores(matchId, p1Score, p2Score);
      } catch (error) {
        console.error('[ERROR] Error completing match:', error);
      }

      const tournamentWinner = tournamentManager.getWinner();
      const isFinal = tournamentWinner !== null;

      if (ctx.currentPongGame) {
        ctx.currentPongGame.stop();
        ctx.setCurrentPongGame(null);
      }

      let blockchainResult: { success: boolean; tx_hash?: string; block_number?: number } | null = null;
      if (isFinal) {
        blockchainResult = await tournamentManager.recordTournamentOnBlockchain();
      }

      showTournamentMatchResult(ctx, {
        player1Name,
        player2Name,
        p1Score,
        p2Score,
        winnerName,
        isFinal,
        tx_hash: blockchainResult?.tx_hash,
        block_number: blockchainResult?.block_number
      });
    }
  });

  ctx.setCurrentPongGame(pongGame);
  pongGame.start();
}

function showTournamentMatchResult(ctx: TournamentPageContext, data: TournamentResultData): void {
  const overlay = document.createElement('div');
  overlay.id = 'tournament-result-overlay';
  overlay.innerHTML = tournamentResultTemplate(data);
  document.body.appendChild(overlay);

  document.getElementById('back-to-bracket')?.addEventListener('click', () => {
    overlay.remove();
    renderTournamentPage(ctx);
  });

  document.getElementById('new-tournament')?.addEventListener('click', () => {
    overlay.remove();
    tournamentManager.reset();
    renderTournamentPage(ctx);
  });
}

async function renderTournamentStatus(): Promise<void> {
  const nextMatchBox = document.getElementById('tournament-next-match');
  const winnerBox = document.getElementById('tournament-winner');

  if (!nextMatchBox || !winnerBox) return;

  const winner = tournamentManager.getWinner();
  if (winner) {
    nextMatchBox.textContent = 'Tous les matchs sont terminés.';
    winnerBox.style.display = 'block';

    let txHash: string | null = null;
    let blockNumber: number | null = null;
    let formattedResult: string | null = null;
    try {
      if (authService.isAuthenticated()) {
        const response = await authService.makeAuthenticatedRequest('/api/blockchain/history/', {
          method: 'GET'
        });
        if (response.ok) {
          const history = await response.json();
          const latestTx = history.find((tx: any) => tx.winner_username === winner.alias);
          if (latestTx) {
            txHash = latestTx.tx_hash;
            blockNumber = latestTx.block_number;
            formattedResult = latestTx.formatted_result;
          }
        }
      }
    } catch (error) {
      console.error('[ERROR] Error fetching blockchain history:', error);
    }

    winnerBox.innerHTML = tournamentWinnerStatusTemplate(winner.alias, txHash || undefined, blockNumber || undefined, formattedResult || undefined);
    return;
  }

  winnerBox.style.display = 'none';

  const nextMatch = tournamentManager.getNextMatch() as TournamentMatch | undefined;
  if (!nextMatch) {
    nextMatchBox.textContent = 'Aucun match planifié. Lancez le tournoi pour commencer.';
    return;
  }

  nextMatchBox.textContent = nextMatchStatusTemplate(nextMatch.player1.alias, nextMatch.player2?.alias);
}
