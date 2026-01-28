export interface Pos {
  row: number; // 0-8
  col: number; // 0-8
}

export interface Wall {
  row: number; // 0-7 (top-left corner of the 2-cell wall)
  col: number; // 0-7
  orientation: "h" | "v";
}

export interface PlayerState {
  userId: string | null;
  pos: Pos;
  wallsLeft: number;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  walls: Wall[];
  currentTurn: 0 | 1;
  status: "waiting" | "playing" | "finished";
  winner?: 0 | 1;
  name?: string;
  pendingPlayer?: string; // userId of player requesting to join
}

export type ActionMove = { type: "move"; pos: Pos };
export type ActionWall = { type: "wall"; wall: Wall };
export type Action = ActionMove | ActionWall;

export function createInitialState(userId0: string, userId1: string | null): GameState {
  return {
    players: [
      { userId: userId0, pos: { row: 0, col: 4 }, wallsLeft: 10 },
      { userId: userId1, pos: { row: 8, col: 4 }, wallsLeft: 10 },
    ],
    walls: [],
    currentTurn: 0,
    status: "playing",
  };
}

export function getPlayerIndex(state: GameState, userId: string): 0 | 1 | -1 {
  if (state.players[0].userId === userId) return 0;
  if (state.players[1].userId === userId) return 1;
  return -1;
}

export function goalRow(playerIndex: 0 | 1): number {
  return playerIndex === 0 ? 8 : 0;
}
