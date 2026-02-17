import { authService } from './auth.service';
import type { Participant, TournamentMatch } from '../types';

const MAX_TOURNAMENT_PLAYERS = 42;

export class TournamentManager {
  private participants: Participant[] = [];
  private matches: TournamentMatch[] = [];
  private currentRound: number = 1;
  private winner: Participant | null = null;
  private currentMatchId: number | null = null;
  private nextParticipantId: number = 1;
  private nextMatchId: number = 1;

  public registerPlayer(alias: string): Participant {
    if (this.matches.length > 0) {
      throw new Error('Tournament already started. Reset to register new players');
    }

    if (!alias || alias.trim() === '') {
      throw new Error('Alias cannot be empty');
    }

    if (this.participants.length >= MAX_TOURNAMENT_PLAYERS) {
      throw new Error(`Maximum ${MAX_TOURNAMENT_PLAYERS} players allowed in a tournament`);
    }

    const trimmedAlias = alias.trim();
    const aliasLower = trimmedAlias.toLowerCase();

    if (this.participants.find((p) => p.alias.toLowerCase() === aliasLower)) {
      throw new Error('Alias already taken');
    }

    let linkedUserId: number | null = null;
    const currentUser = authService.currentUser;
    if (currentUser) {
      const userAlreadyLinked = this.participants.some((p) => p.userId === currentUser.id);
      const aliasMatchesUser =
        aliasLower === currentUser.display_name?.toLowerCase() ||
        aliasLower === currentUser.username?.toLowerCase();

      if (userAlreadyLinked && aliasMatchesUser) {
        throw new Error('Vous êtes déjà inscrit dans ce tournoi');
      }

      if (!userAlreadyLinked && aliasMatchesUser) {
        linkedUserId = currentUser.id;
      }
    }

    const participant: Participant = {
      id: this.nextParticipantId++,
      alias: trimmedAlias,
      eliminated: false,
      userId: linkedUserId,
    };

    this.participants.push(participant);
    return participant;
  }

  public startTournament(): TournamentMatch[] {
    if (this.matches.length > 0) {
      throw new Error('Tournament already started');
    }

    if (this.participants.length < 2) {
      throw new Error('Need at least 2 players to start tournament');
    }

    this.generateMatches();
    return this.matches;
  }

  private generateMatches(): void {
    const activePlayers = this.participants.filter((p) => !p.eliminated);

    if (activePlayers.length < 2) {
      return;
    }

    const ordered = [...activePlayers];
    const roundMatches: TournamentMatch[] = [];

    for (let i = 0; i < ordered.length - 1; i += 2) {
      roundMatches.push({
        id: this.nextMatchId++,
        round: this.currentRound,
        player1: ordered[i],
        player2: ordered[i + 1],
        winner: null,
        status: 'pending',
      });
    }

    // BYE si nombre impair de joueurs --> joue au prochain tour
    if (ordered.length % 2 === 1) {
      roundMatches.push({
        id: this.nextMatchId++,
        round: this.currentRound,
        player1: ordered[ordered.length - 1],
        player2: null,
        winner: ordered[ordered.length - 1],
        status: 'bye',
      });
    }

    this.matches.push(...roundMatches);
  }

  public getNextMatch(): TournamentMatch | undefined {
    return this.matches.find((m) => m.status === 'pending');
  }

  public startMatch(matchId: number): TournamentMatch | null {
    const match = this.matches.find((m) => m.id === matchId);
    if (!match || match.status !== 'pending' || !match.player2) {
      return null;
    }

    match.status = 'in_progress';
    this.currentMatchId = matchId;
    return match;
  }

  private completeMatch(matchId: number, winnerId: number, player1Score?: number, player2Score?: number): TournamentMatch {
    const match = this.matches.find((m) => m.id === matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.player2) {
      throw new Error('Invalid match: missing player2');
    }

    if (winnerId !== match.player1.id && winnerId !== match.player2.id) {
      throw new Error('Winner ID does not match any player in this match');
    }

    const winner = winnerId === match.player1.id ? match.player1 : match.player2;
    const loser = winnerId === match.player1.id ? match.player2 : match.player1;

    match.winner = winner;
    match.status = 'completed';
    match.player1Score = player1Score;
    match.player2Score = player2Score;

    if (this.currentMatchId === matchId) {
      this.currentMatchId = null;
    }

    loser.eliminated = true;

    const roundMatches = this.matches.filter((m) => m.round === this.currentRound);
    const allCompleted = roundMatches.every((m) => m.status === 'completed' || m.status === 'bye');

    if (allCompleted) {
      const remainingPlayers = this.participants.filter((p) => !p.eliminated);

      if (remainingPlayers.length > 1) {
        this.currentRound++;
        this.generateMatches();
      } else if (remainingPlayers.length === 1) {
        this.winner = remainingPlayers[0];
      }
    }

    return match;
  }

  public completeMatchWithScores(matchId: number, player1Score: number, player2Score: number): TournamentMatch {
    const match = this.matches.find((m) => m.id === matchId);
    if (!match || !match.player2) {
      throw new Error('Match not found or invalid');
    }

    if (player1Score === player2Score) {
      throw new Error('Scores cannot be equal - there must be a winner');
    }

    const winnerId = player1Score > player2Score ? match.player1.id : match.player2.id;
    return this.completeMatch(matchId, winnerId, player1Score, player2Score);
  }

  public getAllMatches(): TournamentMatch[] {
    return this.matches;
  }

  public getWinner(): Participant | null {
    return this.winner;
  }

  public getFinalMatch(): TournamentMatch | null {
    if (!this.winner) {
      return null;
    }

    const finalRound = Math.max(...this.matches.map(m => m.round));
    const winnerId = this.winner.id;
    const finalMatches = this.matches.filter(m => m.round === finalRound && m.winner?.id === winnerId);

    return finalMatches.length > 0 ? finalMatches[0] : null;
  }

  public async recordTournamentOnBlockchain(): Promise<{ success: boolean; tx_hash?: string; block_number?: number; tournament_id?: number; error?: string }> {
    if (!this.winner) {
      return { success: false, error: 'Tournament is not over' };
    }

    const finalMatch = this.getFinalMatch();
    if (!finalMatch || finalMatch.player1Score === undefined || finalMatch.player2Score === undefined) {
      return { success: false, error: 'Final match not found or missing scores' };
    }

    const isPlayer1Winner = finalMatch.winner?.id === finalMatch.player1.id;
    const winnerScore = isPlayer1Winner ? finalMatch.player1Score! : finalMatch.player2Score!;
    const loserScore = isPlayer1Winner ? finalMatch.player2Score! : finalMatch.player1Score!;
    const loserAlias = isPlayer1Winner ? finalMatch.player2!.alias : finalMatch.player1.alias;

    const tournId = Math.floor(Date.now() / 1000);

    if (!authService.isAuthenticated()) {
      return { success: false, error: 'Authentication required. Please log in again.' };
    }

    try {
      const response = await fetch('/api/blockchain/tournament/record/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournament_id: tournId,
          winner_username: this.winner.alias,
          winner_score: winnerScore,
          loser_username: loserAlias,
          loser_score: loserScore,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return { success: false, error: errorData.error || `HTTP Error ${response.status}` };
      }

      const result = await response.json();
      return {
        success: true,
        tx_hash: result.tx_hash,
        block_number: result.block_number,
        tournament_id: result.tournament_id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public getParticipants(): Participant[] {
    return this.participants;
  }

  public hasStarted(): boolean {
    return this.matches.length > 0;
  }

  public reset(): void {
    this.participants = [];
    this.matches = [];
    this.currentRound = 1;
    this.winner = null;
    this.currentMatchId = null;
    this.nextParticipantId = 1;
    this.nextMatchId = 1;
  }
}

export const tournamentManager = new TournamentManager();
