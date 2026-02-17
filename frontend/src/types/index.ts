export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  display_name?: string;
  online?: boolean;
}

export interface UserStats {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  avatar?: string;
  wins: number;
  losses: number;
  games_played?: number;
  win_rate?: number;
  is_online?: boolean;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Match {
  id: number;
  player1: User;
  player2: User;
  score1: number;
  score2: number;
  winner?: User;
  created_at: string;
  game_type: 'pong';
}

export interface Participant {
  id: number;
  alias: string;
  eliminated: boolean;
  userId?: number | null;
}

export interface TournamentMatch {
  id: number;
  round: number;
  player1: Participant;
  player2: Participant | null;
  winner: Participant | null;
  status: 'pending' | 'in_progress' | 'completed' | 'bye';
  player1Score?: number;
  player2Score?: number;
}

export interface TournamentResultData {
  player1Name: string;
  player2Name: string;
  p1Score: number;
  p2Score: number;
  winnerName: string;
  isFinal: boolean;
  tx_hash?: string;
  block_number?: number;
}
