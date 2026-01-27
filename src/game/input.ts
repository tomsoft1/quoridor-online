import type { Wall, GameState, Action } from "./state";
import { posFromPixel, wallFromPixel } from "./board";
import { getValidMoves, isValidWall } from "./rules";

export type InputMode = "move" | "wall";

export interface InputState {
  mode: InputMode;
  ghostWall: Wall | null;
}

export function handleCanvasClick(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  state: GameState,
  playerIdx: 0 | 1,
  mode: InputMode,
): Action | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;

  if (mode === "move") {
    const pos = posFromPixel(px, py);
    if (!pos) return null;
    const valid = getValidMoves(state, playerIdx);
    if (valid.some(m => m.row === pos.row && m.col === pos.col)) {
      return { type: "move", pos };
    }
    return null;
  }

  if (mode === "wall") {
    const w = wallFromPixel(px, py);
    if (!w) return null;
    const wall: Wall = { row: w.row, col: w.col, orientation: w.orientation };
    if (isValidWall(state, wall, playerIdx)) {
      return { type: "wall", wall };
    }
    return null;
  }

  return null;
}

export function handleCanvasMouseMove(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  state: GameState,
  playerIdx: 0 | 1,
  mode: InputMode,
): Wall | null {
  if (mode !== "wall") return null;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;

  const w = wallFromPixel(px, py);
  if (!w) return null;
  const wall: Wall = { row: w.row, col: w.col, orientation: w.orientation };
  if (isValidWall(state, wall, playerIdx)) return wall;
  return null;
}
