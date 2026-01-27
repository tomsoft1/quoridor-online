import type { GameState, Pos, Wall, Action } from "./state";
import { goalRow } from "./state";

// Check if a wall blocks movement between two adjacent cells
function wallBlocks(walls: Wall[], from: Pos, to: Pos): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;

  for (const w of walls) {
    if (w.orientation === "h") {
      // Horizontal wall blocks vertical movement
      if (dr === 1 && dc === 0) {
        // Moving down: wall at row=from.row, col=from.col or col=from.col-1
        if (w.row === from.row && (w.col === from.col || w.col === from.col - 1)) return true;
      }
      if (dr === -1 && dc === 0) {
        // Moving up: wall at row=to.row, col=to.col or col=to.col-1
        if (w.row === to.row && (w.col === to.col || w.col === to.col - 1)) return true;
      }
    }
    if (w.orientation === "v") {
      // Vertical wall blocks horizontal movement
      if (dc === 1 && dr === 0) {
        // Moving right: wall at col=from.col, row=from.row or row=from.row-1
        if (w.col === from.col && (w.row === from.row || w.row === from.row - 1)) return true;
      }
      if (dc === -1 && dr === 0) {
        // Moving left: wall at col=to.col, row=to.row or row=to.row-1
        if (w.col === to.col && (w.row === to.row || w.row === to.row - 1)) return true;
      }
    }
  }
  return false;
}

function canStep(walls: Wall[], from: Pos, to: Pos): boolean {
  if (to.row < 0 || to.row > 8 || to.col < 0 || to.col > 8) return false;
  return !wallBlocks(walls, from, to);
}

export function getValidMoves(state: GameState, playerIdx: 0 | 1): Pos[] {
  const me = state.players[playerIdx].pos;
  const opp = state.players[1 - playerIdx].pos;
  const moves: Pos[] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of dirs) {
    const target: Pos = { row: me.row + dr, col: me.col + dc };
    if (!canStep(state.walls, me, target)) continue;

    // If opponent is on target, try jumping
    if (target.row === opp.row && target.col === opp.col) {
      const jump: Pos = { row: opp.row + dr, col: opp.col + dc };
      if (canStep(state.walls, opp, jump) && jump.row >= 0 && jump.row <= 8 && jump.col >= 0 && jump.col <= 8) {
        moves.push(jump);
      } else {
        // Diagonal jumps
        const sideDirs = dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
        for (const [sdr, sdc] of sideDirs) {
          const side: Pos = { row: opp.row + sdr, col: opp.col + sdc };
          if (canStep(state.walls, opp, side) && side.row >= 0 && side.row <= 8 && side.col >= 0 && side.col <= 8) {
            moves.push(side);
          }
        }
      }
    } else {
      moves.push(target);
    }
  }
  return moves;
}

// BFS: can player reach their goal row?
function hasPath(walls: Wall[], start: Pos, targetRow: number): boolean {
  const visited = new Set<string>();
  const queue: Pos[] = [start];
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === targetRow) return true;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next: Pos = { row: cur.row + dr, col: cur.col + dc };
      const key = `${next.row},${next.col}`;
      if (next.row < 0 || next.row > 8 || next.col < 0 || next.col > 8) continue;
      if (visited.has(key)) continue;
      if (!canStep(walls, cur, next)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

function wallsOverlap(existing: Wall[], w: Wall): boolean {
  for (const e of existing) {
    if (e.orientation === w.orientation) {
      if (e.orientation === "h" && e.row === w.row && Math.abs(e.col - w.col) < 2) return true;
      if (e.orientation === "v" && e.col === w.col && Math.abs(e.row - w.row) < 2) return true;
    } else {
      // Cross overlap: h and v walls cross if same position
      if (e.row === w.row && e.col === w.col) return true;
    }
  }
  return false;
}

export function isValidWall(state: GameState, wall: Wall, playerIdx: 0 | 1): boolean {
  if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) return false;
  if (state.players[playerIdx].wallsLeft <= 0) return false;
  if (wallsOverlap(state.walls, wall)) return false;

  // Check both players can still reach their goals
  const newWalls = [...state.walls, wall];
  for (let i = 0; i < 2; i++) {
    if (!hasPath(newWalls, state.players[i].pos, goalRow(i as 0 | 1))) return false;
  }
  return true;
}

export function applyAction(state: GameState, action: Action): GameState | null {
  const pIdx = state.currentTurn;

  if (action.type === "move") {
    const validMoves = getValidMoves(state, pIdx);
    if (!validMoves.some(m => m.row === action.pos.row && m.col === action.pos.col)) return null;

    const newPlayers = state.players.map((p, i) =>
      i === pIdx ? { ...p, pos: action.pos } : { ...p }
    ) as [typeof state.players[0], typeof state.players[1]];

    const won = action.pos.row === goalRow(pIdx);
    return {
      players: newPlayers,
      walls: state.walls,
      currentTurn: won ? pIdx : ((1 - pIdx) as 0 | 1),
      status: won ? "finished" : "playing",
      winner: won ? pIdx : undefined,
    };
  }

  if (action.type === "wall") {
    if (!isValidWall(state, action.wall, pIdx)) return null;

    const newPlayers = state.players.map((p, i) =>
      i === pIdx ? { ...p, wallsLeft: p.wallsLeft - 1 } : { ...p }
    ) as [typeof state.players[0], typeof state.players[1]];

    return {
      players: newPlayers,
      walls: [...state.walls, action.wall],
      currentTurn: (1 - pIdx) as 0 | 1,
      status: "playing",
    };
  }

  return null;
}
