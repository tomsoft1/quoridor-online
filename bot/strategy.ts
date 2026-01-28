// Types
export interface Pos {
  row: number;
  col: number;
}

export interface Wall {
  row: number;
  col: number;
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
  pendingPlayer?: string;
}

export type Action = { type: "move"; pos: Pos } | { type: "wall"; wall: Wall };

export function goalRow(playerIndex: 0 | 1): number {
  return playerIndex === 0 ? 8 : 0;
}

// Game logic (copied from src/game/rules.ts)
function wallBlocks(walls: Wall[], from: Pos, to: Pos): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;

  for (const w of walls) {
    if (w.orientation === "h") {
      if (dr === 1 && dc === 0) {
        if (w.row === from.row && (w.col === from.col || w.col === from.col - 1)) return true;
      }
      if (dr === -1 && dc === 0) {
        if (w.row === to.row && (w.col === to.col || w.col === to.col - 1)) return true;
      }
    }
    if (w.orientation === "v") {
      if (dc === 1 && dr === 0) {
        if (w.col === from.col && (w.row === from.row || w.row === from.row - 1)) return true;
      }
      if (dc === -1 && dr === 0) {
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

    if (target.row === opp.row && target.col === opp.col) {
      const jump: Pos = { row: opp.row + dr, col: opp.col + dc };
      if (canStep(state.walls, opp, jump) && jump.row >= 0 && jump.row <= 8 && jump.col >= 0 && jump.col <= 8) {
        moves.push(jump);
      } else {
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

// BFS to find shortest path length to goal
function shortestPath(walls: Wall[], start: Pos, targetRow: number): number {
  const visited = new Set<string>();
  const queue: { pos: Pos; dist: number }[] = [{ pos: start, dist: 0 }];
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    const { pos: cur, dist } = queue.shift()!;
    if (cur.row === targetRow) return dist;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next: Pos = { row: cur.row + dr, col: cur.col + dc };
      const key = `${next.row},${next.col}`;
      if (next.row < 0 || next.row > 8 || next.col < 0 || next.col > 8) continue;
      if (visited.has(key)) continue;
      if (!canStep(walls, cur, next)) continue;
      visited.add(key);
      queue.push({ pos: next, dist: dist + 1 });
    }
  }
  return Infinity;
}

function wallsOverlap(existing: Wall[], w: Wall): boolean {
  for (const e of existing) {
    if (e.orientation === w.orientation) {
      if (e.orientation === "h" && e.row === w.row && Math.abs(e.col - w.col) < 2) return true;
      if (e.orientation === "v" && e.col === w.col && Math.abs(e.row - w.row) < 2) return true;
    } else {
      if (e.row === w.row && e.col === w.col) return true;
    }
  }
  return false;
}

export function isValidWall(state: GameState, wall: Wall, playerIdx: 0 | 1): boolean {
  if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) return false;
  if (state.players[playerIdx].wallsLeft <= 0) return false;
  if (wallsOverlap(state.walls, wall)) return false;

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
    ) as [PlayerState, PlayerState];

    const won = action.pos.row === goalRow(pIdx);
    return {
      ...state,
      players: newPlayers,
      currentTurn: won ? pIdx : ((1 - pIdx) as 0 | 1),
      status: won ? "finished" : "playing",
      winner: won ? pIdx : undefined,
    };
  }

  if (action.type === "wall") {
    if (!isValidWall(state, action.wall, pIdx)) return null;

    const newPlayers = state.players.map((p, i) =>
      i === pIdx ? { ...p, wallsLeft: p.wallsLeft - 1 } : { ...p }
    ) as [PlayerState, PlayerState];

    return {
      ...state,
      players: newPlayers,
      walls: [...state.walls, action.wall],
      currentTurn: (1 - pIdx) as 0 | 1,
    };
  }

  return null;
}

// Find the next cell on the shortest path to goal
function getPathNextStep(walls: Wall[], start: Pos, targetRow: number): Pos | null {
  const visited = new Map<string, Pos | null>();
  const queue: Pos[] = [start];
  visited.set(`${start.row},${start.col}`, null);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === targetRow) {
      // Backtrack to find first step
      let step = cur;
      let prev = visited.get(`${step.row},${step.col}`);
      while (prev && (prev.row !== start.row || prev.col !== start.col)) {
        step = prev;
        prev = visited.get(`${step.row},${step.col}`);
      }
      return step;
    }

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next: Pos = { row: cur.row + dr, col: cur.col + dc };
      const key = `${next.row},${next.col}`;
      if (next.row < 0 || next.row > 8 || next.col < 0 || next.col > 8) continue;
      if (visited.has(key)) continue;
      if (!canStepCheck(walls, cur, next)) continue;
      visited.set(key, cur);
      queue.push(next);
    }
  }
  return null;
}

// Helper to check step (duplicated for use in pathfinding)
function canStepCheck(walls: Wall[], from: Pos, to: Pos): boolean {
  if (to.row < 0 || to.row > 8 || to.col < 0 || to.col > 8) return false;
  const dr = to.row - from.row;
  const dc = to.col - from.col;

  for (const w of walls) {
    if (w.orientation === "h") {
      if (dr === 1 && dc === 0) {
        if (w.row === from.row && (w.col === from.col || w.col === from.col - 1)) return false;
      }
      if (dr === -1 && dc === 0) {
        if (w.row === to.row && (w.col === to.col || w.col === to.col - 1)) return false;
      }
    }
    if (w.orientation === "v") {
      if (dc === 1 && dr === 0) {
        if (w.col === from.col && (w.row === from.row || w.row === from.row - 1)) return false;
      }
      if (dc === -1 && dr === 0) {
        if (w.col === to.col && (w.row === to.row || w.row === to.row - 1)) return false;
      }
    }
  }
  return true;
}

// Find best wall to block opponent's path
function findBlockingWall(state: GameState, botIdx: 0 | 1): Wall | null {
  const oppIdx = (1 - botIdx) as 0 | 1;
  const oppPos = state.players[oppIdx].pos;
  const oppGoal = goalRow(oppIdx);
  const currentOppDist = shortestPath(state.walls, oppPos, oppGoal);

  // Get opponent's next step on their shortest path
  const nextStep = getPathNextStep(state.walls, oppPos, oppGoal);
  if (!nextStep) return null;

  let bestWall: Wall | null = null;
  let bestIncrease = 0;

  // Try walls that could block the opponent's path
  // Focus on the area between opponent and their next few steps
  for (let row = Math.max(0, oppPos.row - 2); row <= Math.min(7, oppPos.row + 2); row++) {
    for (let col = Math.max(0, oppPos.col - 2); col <= Math.min(7, oppPos.col + 2); col++) {
      for (const orientation of ["h", "v"] as const) {
        const wall: Wall = { row, col, orientation };

        if (!isValidWall(state, wall, botIdx)) continue;

        const newWalls = [...state.walls, wall];
        const newOppDist = shortestPath(newWalls, oppPos, oppGoal);
        const increase = newOppDist - currentOppDist;

        // Also check we don't hurt ourselves too much
        const botPos = state.players[botIdx].pos;
        const botGoal = goalRow(botIdx);
        const currentBotDist = shortestPath(state.walls, botPos, botGoal);
        const newBotDist = shortestPath(newWalls, botPos, botGoal);
        const selfHurt = newBotDist - currentBotDist;

        // Net benefit: opponent slowdown minus self slowdown
        const netBenefit = increase - selfHurt;

        if (netBenefit > bestIncrease) {
          bestIncrease = netBenefit;
          bestWall = wall;
        }
      }
    }
  }

  // Only return wall if it provides significant benefit
  return bestIncrease >= 2 ? bestWall : null;
}

// AI Strategy: smart approach with path evaluation
export function chooseAction(state: GameState, botIdx: 0 | 1): Action {
  const validMoves = getValidMoves(state, botIdx);
  const goal = goalRow(botIdx);
  const oppIdx = (1 - botIdx) as 0 | 1;

  const botPos = state.players[botIdx].pos;
  const oppPos = state.players[oppIdx].pos;
  const botDist = shortestPath(state.walls, botPos, goal);
  const oppDist = shortestPath(state.walls, oppPos, goalRow(oppIdx));

  // Find best move (closest to goal)
  let bestMove: Pos | null = null;
  let bestDist = Infinity;

  for (const move of validMoves) {
    const dist = shortestPath(state.walls, move, goal);
    if (dist < bestDist) {
      bestDist = dist;
      bestMove = move;
    }
  }

  // Decision: move or place wall?
  const wallsLeft = state.players[botIdx].wallsLeft;

  // Consider wall if:
  // 1. We have walls
  // 2. Opponent is closer to their goal than us, OR opponent is getting close
  // 3. Not in endgame (save some walls)
  const shouldConsiderWall = wallsLeft > 2 && (oppDist <= botDist || oppDist <= 4);

  if (shouldConsiderWall) {
    const blockingWall = findBlockingWall(state, botIdx);
    if (blockingWall) {
      return { type: "wall", wall: blockingWall };
    }
  }

  // Default: move towards goal
  if (bestMove) {
    return { type: "move", pos: bestMove };
  }

  // Fallback: random valid move
  if (validMoves.length > 0) {
    return { type: "move", pos: validMoves[Math.floor(Math.random() * validMoves.length)] };
  }

  throw new Error("No valid moves available");
}
