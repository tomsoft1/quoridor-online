import type { GameState, Pos, Wall } from "./state";

const BOARD_SIZE = 9;
const CANVAS_SIZE = 500;
const MARGIN = 20;
const CELL_SIZE = (CANVAS_SIZE - 2 * MARGIN) / BOARD_SIZE;
const WALL_THICKNESS = 8;
const PAWN_RADIUS = CELL_SIZE * 0.32;
const GAP = 2;

const COLORS = {
  bg: "#0a0e27",
  cell: "#141b3d",
  cellLight: "#1b2550",
  grid: "#0d1230",
  player0: "#ff4d6d",
  player0glow: "rgba(255, 77, 109, 0.4)",
  player1: "#4cc9f0",
  player1glow: "rgba(76, 201, 240, 0.4)",
  wall: "#fbbf24",
  wallGlow: "rgba(251, 191, 36, 0.3)",
  wallGhost: "rgba(251, 191, 36, 0.35)",
  validMove: "rgba(255, 77, 109, 0.25)",
  validMoveBorder: "rgba(255, 77, 109, 0.6)",
  goalRow0: "rgba(255, 77, 109, 0.08)",
  goalRow1: "rgba(76, 201, 240, 0.08)",
};

let animFrame = 0;
let animRunning = false;
let animCtx: CanvasRenderingContext2D | null = null;
let animState: { state: GameState; validMoves: Pos[]; ghostWall: Wall | null; myTurn: boolean; playerIdx: 0 | 1 } | null = null;

function cellCenter(row: number, col: number): [number, number] {
  return [
    MARGIN + col * CELL_SIZE + CELL_SIZE / 2,
    MARGIN + row * CELL_SIZE + CELL_SIZE / 2,
  ];
}

export function posFromPixel(px: number, py: number): Pos | null {
  const col = Math.floor((px - MARGIN) / CELL_SIZE);
  const row = Math.floor((py - MARGIN) / CELL_SIZE);
  if (row < 0 || row > 8 || col < 0 || col > 8) return null;
  return { row, col };
}

export function wallFromPixel(px: number, py: number): { row: number; col: number; orientation: "h" | "v" } | null {
  const x = px - MARGIN;
  const y = py - MARGIN;
  const col = x / CELL_SIZE;
  const row = y / CELL_SIZE;
  const fracX = col - Math.floor(col);
  const fracY = row - Math.floor(row);
  const t = 0.2;

  if (fracY < t || fracY > 1 - t) {
    const wRow = fracY < 0.5 ? Math.floor(row) - 1 : Math.floor(row);
    const wCol = Math.floor(col);
    if (wRow >= 0 && wRow <= 7 && wCol >= 0 && wCol <= 7)
      return { row: wRow, col: wCol, orientation: "h" };
  }
  if (fracX < t || fracX > 1 - t) {
    const wCol = fracX < 0.5 ? Math.floor(col) - 1 : Math.floor(col);
    const wRow = Math.floor(row);
    if (wRow >= 0 && wRow <= 7 && wCol >= 0 && wCol <= 7)
      return { row: wRow, col: wCol, orientation: "v" };
  }
  return null;
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  validMoves: Pos[],
  ghostWall: Wall | null,
  myTurn: boolean = false,
  playerIdx: 0 | 1 = 0,
) {
  animCtx = ctx;
  animState = { state, validMoves, ghostWall, myTurn, playerIdx };

  if (!animRunning) {
    animRunning = true;
    requestAnimationFrame(animLoop);
  }

  drawFrame(ctx, state, validMoves, ghostWall, myTurn, playerIdx, animFrame);
}

function animLoop() {
  animFrame++;
  if (animCtx && animState) {
    const { state, validMoves, ghostWall, myTurn, playerIdx } = animState;
    drawFrame(animCtx, state, validMoves, ghostWall, myTurn, playerIdx, animFrame);
  }
  requestAnimationFrame(animLoop);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  validMoves: Pos[],
  ghostWall: Wall | null,
  myTurn: boolean,
  playerIdx: 0 | 1,
  frame: number,
) {
  const t = frame / 60; // ~1 second cycle at 60fps
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const slowPulse = 0.5 + 0.5 * Math.sin(t * Math.PI);

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Background gradient
  const bgGrad = ctx.createRadialGradient(CANVAS_SIZE / 2, CANVAS_SIZE / 2, 50, CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE);
  bgGrad.addColorStop(0, "#111638");
  bgGrad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Goal rows (subtle highlight)
  for (let c = 0; c < BOARD_SIZE; c++) {
    const x0 = MARGIN + c * CELL_SIZE;
    ctx.fillStyle = COLORS.goalRow0;
    ctx.fillRect(x0 + GAP, MARGIN + 8 * CELL_SIZE + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
    ctx.fillStyle = COLORS.goalRow1;
    ctx.fillRect(x0 + GAP, MARGIN + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);
  }

  // Cells
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const x = MARGIN + c * CELL_SIZE;
      const y = MARGIN + r * CELL_SIZE;
      // Alternating subtle pattern
      ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.cell : COLORS.cellLight;
      roundRect(ctx, x + GAP, y + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2, 3);
    }
  }

  // Valid moves (animated)
  for (const m of validMoves) {
    const x = MARGIN + m.col * CELL_SIZE;
    const y = MARGIN + m.row * CELL_SIZE;
    const alpha = 0.15 + 0.15 * pulse;
    ctx.fillStyle = `rgba(255, 77, 109, ${alpha})`;
    roundRect(ctx, x + GAP, y + GAP, CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2, 3);
    // Border
    ctx.strokeStyle = `rgba(255, 77, 109, ${0.4 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + GAP + 1, y + GAP + 1, CELL_SIZE - GAP * 2 - 2, CELL_SIZE - GAP * 2 - 2, 3);
    ctx.stroke();
  }

  // Walls
  for (const w of state.walls) {
    drawWall(ctx, w, COLORS.wall, COLORS.wallGlow);
  }

  // Ghost wall
  if (ghostWall) {
    drawWall(ctx, ghostWall, COLORS.wallGhost, "transparent");
  }

  // Pawns
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    const [cx, cy] = cellCenter(p.pos.row, p.pos.col);
    const isActive = state.currentTurn === i;
    const color = i === 0 ? COLORS.player0 : COLORS.player1;
    const glowColor = i === 0 ? COLORS.player0glow : COLORS.player1glow;

    // Glow for active player
    if (isActive) {
      const glowRadius = PAWN_RADIUS + 6 + 4 * pulse;
      const glow = ctx.createRadialGradient(cx, cy, PAWN_RADIUS, cx, cy, glowRadius);
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Pawn body
    const r = isActive ? PAWN_RADIUS + 1.5 * pulse : PAWN_RADIUS;
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, lighten(color, 40));
    grad.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fill();
  }

  // Turn indicator bar at top
  const barColor = state.currentTurn === 0 ? COLORS.player0 : COLORS.player1;
  const barAlpha = 0.6 + 0.4 * slowPulse;
  ctx.fillStyle = barColor;
  ctx.globalAlpha = myTurn ? barAlpha : 0.3;
  ctx.fillRect(MARGIN, 2, CANVAS_SIZE - MARGIN * 2, 4);
  ctx.globalAlpha = 1;

  // Goal labels
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.player0;
  ctx.globalAlpha = 0.6;
  ctx.fillText("GOAL", MARGIN + 2, MARGIN + 8.9 * CELL_SIZE + 12);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.player1;
  ctx.fillText("GOAL", CANVAS_SIZE - MARGIN - 2, MARGIN + 0.1 * CELL_SIZE + 10);
  ctx.globalAlpha = 1;
}

function drawWall(ctx: CanvasRenderingContext2D, w: Wall, color: string, glowColor: string) {
  let x: number, y: number, width: number, height: number;
  if (w.orientation === "h") {
    x = MARGIN + w.col * CELL_SIZE + 1;
    y = MARGIN + (w.row + 1) * CELL_SIZE - WALL_THICKNESS / 2;
    width = CELL_SIZE * 2 - 2;
    height = WALL_THICKNESS;
  } else {
    x = MARGIN + (w.col + 1) * CELL_SIZE - WALL_THICKNESS / 2;
    y = MARGIN + w.row * CELL_SIZE + 1;
    width = WALL_THICKNESS;
    height = CELL_SIZE * 2 - 2;
  }

  // Glow
  if (glowColor !== "transparent") {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, height, WALL_THICKNESS / 2);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}
