import { sanitizeHTML } from '../utils/helpers';
import type { Participant, TournamentMatch, TournamentResultData } from '../types';

export function tournamentPageTemplate(defaultAlias: string): string {
  const safeDefaultAlias = sanitizeHTML(defaultAlias);

  return `
    <div class="tournament-page">
      <h2>Organisation d'un tournoi Pong</h2>
      <p>Ajoutez des joueurs en saisissant leur alias (maximum 42), générez un bracket et suivez l'avancement des matchs.</p>

      <div class="tournament-layout">
        <section class="card">
          <h3>Inscription des joueurs</h3>
          <form id="tournament-alias-form" class="auth-form">
            <input type="text" id="alias-input" placeholder="Alias du joueur" value="${safeDefaultAlias}" required autocomplete="off" />
            <button type="submit" class="btn btn-primary">Ajouter</button>
          </form>
          <div id="tournament-message" class="notice" style="display: none;"></div>
          <ul id="tournament-participants" class="participant-list"></ul>
          <div class="tournament-actions">
            <button id="start-tournament" class="btn btn-success">Générer le bracket</button>
            <button id="reset-tournament" class="btn btn-secondary">Réinitialiser</button>
          </div>
        </section>

        <section class="card">
          <h3>Suivi en direct</h3>
          <div id="tournament-next-match" class="panel muted">Ajoutez au moins deux joueurs pour lancer un match.</div>
          <div id="tournament-winner" class="panel success" style="display: none;"></div>
        </section>
      </div>

      <section class="card bracket-section">
        <h3>Bracket</h3>
        <div id="tournament-bracket" class="bracket-grid"></div>
      </section>
    </div>
  `;
}

export function participantItemTemplate(participant: Participant): string {
  const safeAlias = sanitizeHTML(participant.alias);
  return `<li>${safeAlias}</li>`;
}

export function emptyParticipantsTemplate(): string {
  return '<li class="empty">Aucun joueur inscrit pour le moment.</li>';
}

export function matchCardTemplate(match: TournamentMatch): string {
  const player1 = match.player1 ? sanitizeHTML(match.player1.alias) : '???';
  const player2 = match.player2 ? sanitizeHTML(match.player2.alias) : '???';
  const winner = match.winner ? sanitizeHTML(match.winner.alias) : null;
  const isBye = match.status === 'bye';

  let controls = '';
  if (match.status === 'pending' && match.player2) {
    controls = `<div class="match-controls"><button class="btn btn-success" data-play-match data-match-id="${match.id}">Jouer ce match</button></div>`;
  }

  let status = '';
  let scoreDisplay = '';
  if (isBye) {
    status = `<span class="status-bye">${player1} passe automatiquement</span>`;
  } else if (winner) {
    const p1Score = match.player1Score ?? '-';
    const p2Score = match.player2Score ?? '-';
    scoreDisplay = `<span class="match-score">${p1Score} - ${p2Score}</span>`;
    status = `<span class="status-winner">Vainqueur: ${winner}</span>`;
  } else {
    status = `<span class="status-pending">En attente</span>`;
  }

  return `
    <div class="match-card" data-match-card="${match.id}">
      <div class="match-players">
        <strong class="${winner && match.winner?.id === match.player1.id ? 'winner' : ''}">${player1}</strong>
        <span class="vs-label">VS</span>
        <strong class="${winner && match.winner?.id === match.player2?.id ? 'winner' : ''}">${player2}</strong>
      </div>
      ${scoreDisplay ? `<div class="match-score-display">${scoreDisplay}</div>` : ''}
      <div class="match-status">${status}</div>
      ${controls}
    </div>
  `;
}

export function bracketRoundTemplate(round: number, matchesHtml: string): string {
  return `<div class="bracket-round"><h4>Round ${round}</h4>${matchesHtml}</div>`;
}

export function emptyBracketTemplate(): string {
  return '<p class="empty">Ajoutez des joueurs puis générez le bracket pour visualiser les rencontres.</p>';
}

export function tournamentGameTemplate(player1Name: string, player2Name: string): string {
  const safeP1 = sanitizeHTML(player1Name);
  const safeP2 = sanitizeHTML(player2Name);

  return `
    <div class="tournament-game-container">
      <div class="tournament-versus-header">
        <span class="versus-name p1">${safeP1}</span>
        <span class="versus-vs">VS</span>
        <span class="versus-name p2">${safeP2}</span>
      </div>
      <div class="tournament-game-canvas-container">
        <canvas id="tournamentPongCanvas" width="800" height="600"></canvas>
      </div>
    </div>
  `;
}

export function tournamentResultTemplate(data: TournamentResultData): string {
  const { player1Name, player2Name, p1Score, p2Score, winnerName, isFinal, tx_hash, block_number } = data;
  const safeP1 = sanitizeHTML(player1Name);
  const safeP2 = sanitizeHTML(player2Name);
  const safeWinner = sanitizeHTML(winnerName);

  return `
    <div class="result-card">
      <h1 class="result-title">${isFinal ? 'CHAMPION !' : 'VICTOIRE !'}</h1>
      <p class="winner-name">${safeWinner} ${isFinal ? 'remporte le tournoi !' : 'gagne !'}</p>

      <div class="score-box">
        <div class="score-label">Score Final</div>
        <div class="players-vs">${safeP1} vs ${safeP2}</div>
        <div class="final-score">
          <span class="${p1Score > p2Score ? 'winner' : 'loser'}">${p1Score}</span>
          <span class="score-dash">-</span>
          <span class="${p2Score > p1Score ? 'winner' : 'loser'}">${p2Score}</span>
        </div>
      </div>

      ${isFinal ? `
        <div class="blockchain-info">
          ${tx_hash ? `
            <div class="blockchain-label">Transaction Blockchain</div>
            <div class="tx-hash">${sanitizeHTML(tx_hash)}</div>
            ${block_number ? `<div class="block-number">Block: ${block_number}</div>` : ''}
            <a href="https://testnet.snowtrace.io/tx/${sanitizeHTML(tx_hash)}" target="_blank" class="blockchain-link">Voir sur Snowtrace</a>
          ` : `
            <div class="blockchain-label warning">Enregistrement Blockchain</div>
            <div class="blockchain-error-text">L'enregistrement n'a pas pu être effectué.</div>
          `}
        </div>
      ` : ''}

      <div class="action-buttons">
        <button id="back-to-bracket" class="btn-tournament">${isFinal ? 'Voir le classement' : 'Retour au bracket'}</button>
        ${isFinal ? '<button id="new-tournament" class="btn-tournament secondary">Nouveau tournoi</button>' : ''}
      </div>
    </div>
  `;
}

export function tournamentWinnerStatusTemplate(winnerAlias: string, txHash?: string, blockNumber?: number, formattedResult?: string): string {
  const safeAlias = sanitizeHTML(winnerAlias);
  const safeTxHash = txHash ? sanitizeHTML(txHash) : null;

  if (safeTxHash) {
    return `
      <div class="winner-status">
        <strong>Champion : ${safeAlias}</strong>
        <div class="blockchain-info">
          <div class="blockchain-label">Transaction Blockchain</div>
          <div class="tx-hash">${safeTxHash}</div>
          ${blockNumber ? `<div class="block-number">Block: ${blockNumber}</div>` : ''}
          <a href="https://testnet.snowtrace.io/tx/${safeTxHash}" target="_blank" class="blockchain-link">Voir sur Snowtrace</a>
          ${formattedResult ? `<div class="blockchain-result">Résultat blockchain : ${sanitizeHTML(formattedResult)}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `<strong>Champion : ${safeAlias}</strong>`;
}

export function nextMatchStatusTemplate(player1Alias: string, player2Alias?: string): string {
  const safeP1 = sanitizeHTML(player1Alias);
  if (!player2Alias) {
    return `${safeP1} bénéficie d'un passage automatique au prochain tour.`;
  }
  const safeP2 = sanitizeHTML(player2Alias);
  return `Prochaine rencontre : ${safeP1} vs ${safeP2}`;
}
