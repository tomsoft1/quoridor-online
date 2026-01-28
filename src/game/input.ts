import type { Wall, GameState, Action } from "./state";
import type { BoardRenderer } from "./board";
import { getValidMoves, isValidWall } from "./rules";

export type InputMode = "move" | "wall";

export function handleClick(
  e: MouseEvent,
  board: BoardRenderer,
  state: GameState,
  playerIdx: 0 | 1,
  mode: InputMode,
): Action | null {
  if (mode === "move") {
    const pos = board.getPositionFromMouse(e);
    if (!pos) return null;
    const valid = getValidMoves(state, playerIdx);
    if (valid.some(m => m.row === pos.row && m.col === pos.col)) {
      return { type: "move", pos };
    }
    return null;
  }

  if (mode === "wall") {
    const w = board.getWallFromMouse(e);
    if (!w) return null;
    const wall: Wall = { row: w.row, col: w.col, orientation: w.orientation };
    if (isValidWall(state, wall, playerIdx)) {
      return { type: "wall", wall };
    }
    return null;
  }

  return null;
}

export function handleMouseMove(
  e: MouseEvent,
  board: BoardRenderer,
  state: GameState,
  playerIdx: 0 | 1,
  mode: InputMode,
): Wall | null {
  if (mode !== "wall") return null;
  const w = board.getWallFromMouse(e);
  if (!w) return null;
  const wall: Wall = { row: w.row, col: w.col, orientation: w.orientation };
  if (isValidWall(state, wall, playerIdx)) return wall;
  return null;
}
