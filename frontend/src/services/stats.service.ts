  import type { UserStats } from '../types';
  import { authService } from './auth.service';

  export interface MatchData {
    winner: string;           // 'player1' or 'player2'
    player1Score: number;
    player2Score: number;
    gameMode: string;         // 'vs_ai', 'vs_friend', 'tournament'
    opponentID?: number | null;
    duration: number;
    matchId?: string;         // ID unique optionnel pour la déduplication
  }

  export class StatsService {
    private readonly baseURL: string = `${window.location.origin}/api`;
    private savedMatchIds: Set<string> = new Set(); // Prévention des doublons côté client

    async getUserStats(): Promise<UserStats | null> {
      try {
        const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/users/stats/`, {
          method: 'GET'
        });

        if (!response.ok) {
          console.error('[ERROR] Failed to load user stats:', response.status);
          return null;
        }

        const data = await response.json();
        return data;

      } catch (error) {
        console.error('[ERROR] StatsService error:', error);
        return null;
      }
    }

    private generateMatchKey(matchData: MatchData): string {
      if (matchData.matchId) {
        return matchData.matchId;
      }
      // Générer une clé basée sur les données du match
      return `${matchData.gameMode}-${matchData.player1Score}-${matchData.player2Score}-${matchData.winner}-${matchData.opponentID || 'null'}-${matchData.duration}`;
    }

    async saveMatch(matchData: MatchData, options: { signal?: AbortSignal } = {}): Promise<boolean> {
      try {
        // Vérification de déduplication côté client
        const matchKey = this.generateMatchKey(matchData);
        if (this.savedMatchIds.has(matchKey)) {
          // Match déjà sauvegardé - ignoré (déduplication client)
          return true; // Retourne true car ce n'est pas une erreur
        }

        const response = await authService.makeAuthenticatedRequest(`${this.baseURL}/stats/save-match`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(matchData),
          signal: options.signal
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[ERROR] Failed to save match:', errorData);
          return false;
        }

        await response.json();

        // Marquer le match comme sauvegardé pour éviter les doublons
        this.savedMatchIds.add(matchKey);

        return true;

      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return false;
        }
        console.error('[ERROR] Error saving match:', error);
        return false;
      }
    }

  }

  export const statsService = new StatsService();
