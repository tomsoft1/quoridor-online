import type { GameState } from "../game/state";
import { getPlayerIndex } from "../game/state";
import { getValidMoves, applyAction } from "../game/rules";
import { drawBoard } from "../game/board";
import type { InputMode } from "../game/input";
import { handleCanvasClick, handleCanvasMouseMove } from "../game/input";
import type { SyncProvider, Unsubscribe } from "../sync/types";
import { update, getUserId } from "../api";

export function initGameScreen(
  sync: SyncProvider,
  gameId: string,
  onGameEnd: () => void,
) {
  const canvas = document.getElementById("board") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const infoEl = document.getElementById("game-info")!;
  const wallsLeftEl = document.getElementById("walls-left")!;
  const btnMove = document.getElementById("btn-mode-move")!;
  const btnWall = document.getElementById("btn-mode-wall")!;
  const endOverlay = document.getElementById("end-overlay")!;
  const endMessage = document.getElementById("end-message")!;
  const btnBackLobby = document.getElementById("btn-back-lobby")!;

  let state: GameState | null = null;
  let playerIdx: 0 | 1 = 0;
  let mode: InputMode = "move";
  let ghostWall: import("../game/state").Wall | null = null;
  let unsub: Unsubscribe | null = null;
  const userId = getUserId();

  function render() {
    if (!state) return;
    const validMoves = (state.currentTurn === playerIdx && state.status === "playing")
      ? (mode === "move" ? getValidMoves(state, playerIdx) : [])
      : [];
    drawBoard(ctx, state, validMoves, mode === "wall" ? ghostWall : null);

    const isMyTurn = state.currentTurn === playerIdx;
    const turnLabel = isMyTurn ? "Votre tour" : "Tour de l'adversaire";
    const colorLabel = playerIdx === 0 ? "Rouge" : "Bleu";
    infoEl.textContent = `${turnLabel} | Vous etes ${colorLabel}`;
    wallsLeftEl.textContent = String(state.players[playerIdx].wallsLeft);
  }

  function setMode(m: InputMode) {
    mode = m;
    btnMove.classList.toggle("active", m === "move");
    btnWall.classList.toggle("active", m === "wall");
    ghostWall = null;
    render();
  }

  btnMove.addEventListener("click", () => setMode("move"));
  btnWall.addEventListener("click", () => setMode("wall"));

  canvas.addEventListener("click", async (e) => {
    if (!state || state.status !== "playing" || state.currentTurn !== playerIdx) return;

    const action = handleCanvasClick(e, canvas, state, playerIdx, mode);
    if (!action) return;

    const newState = applyAction(state, action);
    if (!newState) return;

    state = newState;
    ghostWall = null;
    render();

    // Push to server
    try {
      await update("games", gameId, newState);
    } catch (err) {
      console.error("Failed to push state:", err);
    }

    if (newState.status === "finished") {
      showEnd(newState);
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!state || state.status !== "playing" || state.currentTurn !== playerIdx) return;
    ghostWall = handleCanvasMouseMove(e, canvas, state, playerIdx, mode);
    render();
  });

  canvas.addEventListener("mouseleave", () => {
    ghostWall = null;
    render();
  });

  function showEnd(s: GameState) {
    const won = s.winner === playerIdx;
    endMessage.textContent = won ? "Victoire !" : "Defaite...";
    endOverlay.classList.add("active");
  }

  btnBackLobby.addEventListener("click", () => {
    stop();
    endOverlay.classList.remove("active");
    onGameEnd();
  });

  function start() {
    unsub = sync.subscribe("games", gameId, (result: any) => {
      const gs = result.data as GameState;
      if (!gs || !gs.players) return;

      if (!state) {
        const idx = getPlayerIndex(gs, userId);
        // If not found by userId, guest is player 1 (player with null userId)
        playerIdx = idx === -1 ? (gs.players[1].userId === null ? 1 : 0) : idx;
      }

      state = gs;
      render();

      if (gs.status === "finished") {
        showEnd(gs);
      }
    });
  }

  function stop() {
    if (unsub) { unsub(); unsub = null; }
  }

  return { start, stop };
}
