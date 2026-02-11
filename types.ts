export type TournamentFormat = 'single' | 'double' | 'roundrobin';

export type SlotKind = 'player' | 'bye' | 'ref';

export interface Slot {
  kind: SlotKind;
  name?: string; // For 'player'
  from?: string; // Match ID for 'ref'
  which?: 'winner' | 'loser'; // For 'ref'
}

export interface Match {
  id: string;
  name: string; // Display name e.g. "W1-1"
  bracket: 'WB' | 'LB' | 'GF' | 'RR';
  round: number;
  a: Slot;
  b: Slot;
  scoreA: number;
  scoreB: number;
  winner: string | null; // Name of winner or "BYE"
}

export interface ResolvedSlot {
  name: string;
  isBye: boolean;
  resolved: boolean;
}

export interface PlayerStats {
  name: string;
  played: number;
  wins: number;
  losses: number;
  matchPoints: number;
  mapPoints: number;
}