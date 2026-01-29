import type { GameState } from "../game/state";
import { getPlayerIndex } from "../game/state";
import { getValidMoves, applyAction } from "../game/rules";
import { initBoard } from "../game/board";
import type { BoardRenderer } from "../game/board";
import type { InputMode } from "../game/input";
import { handleClick, handleMouseMove } from "../game/input";
import type { SyncProvider, Unsubscribe } from "../sync/types";
import { update, remove, getUserId, incrementStats } from "../api";
import { playMoveSound, playWallSound, playWinSound, playLoseSound } from "../game/sounds";

export function initGameScreen(
  sync: SyncProvider,
  gameId: string,
  onGameEnd: () => void,
) {
  const container = document.getElementById("board-container")!;
  const infoEl = document.getElementById("game-info")!;
  const wallsLeftEl = document.getElementById("walls-left")!;
  const btnMove = document.getElementById("btn-mode-move")!;
  const btnWall = document.getElementById("btn-mode-wall")!;
  const endOverlay = document.getElementById("end-overlay")!;
  const endMessage = document.getElementById("end-message")!;
  const btnBackLobby = document.getElementById("btn-back-lobby")!;
  const btnRotate = document.getElementById("btn-rotate")!;
  const btnQuit = document.getElementById("btn-quit-game")!;

  let state: GameState | null = null;
  let playerIdx: 0 | 1 = 0;
  let mode: InputMode = "move";
  let ghostWall: import("../game/state").Wall | null = null;
  let unsub: Unsubscribe | null = null;
  let board: BoardRenderer | null = null;
  const userId = getUserId();

  function render() {
    if (!state || !board) return;
    const isMyTurn = state.currentTurn === playerIdx && state.status === "playing";
    const validMoves = isMyTurn
      ? (mode === "move" ? getValidMoves(state, playerIdx) : [])
      : [];
    board.update(state, validMoves, mode === "wall" ? ghostWall : null, isMyTurn, playerIdx);

    const turnLabel = isMyTurn ? "Votre tour" : "Tour de l'adversaire";
    const colorLabel = playerIdx === 0 ? "Rouge" : "Bleu";
    infoEl.textContent = `${turnLabel} | Vous etes ${colorLabel} | User: ${userId} | Game: ${gameId}`;
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
  btnRotate.addEventListener("click", () => { if (board) board.rotate(); });
  btnQuit.addEventListener("click", () => {
    stop();
    onGameEnd();
  });

  function createConfetti() {
    const colors = ["#4ade80", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa"];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 2 + "s";
      confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
      endOverlay.appendChild(confetti);
      setTimeout(() => confetti.remove(), 5000);
    }
  }

  function showEnd(s: GameState) {
    const won = s.winner === playerIdx;
    const endSubtitle = document.getElementById("end-subtitle")!;

    // Clear previous classes and confetti
    endOverlay.classList.remove("win", "lose");
    endOverlay.querySelectorAll(".confetti").forEach(c => c.remove());

    if (won) {
      endMessage.textContent = "Victoire !";
      endSubtitle.textContent = "Bien joue, vous avez gagne !";
      endOverlay.classList.add("win");
      createConfetti();
      playWinSound();
    } else {
      endMessage.textContent = "Defaite...";
      endSubtitle.textContent = "Pas de chance, retentez votre chance !";
      endOverlay.classList.add("lose");
      playLoseSound();
    }

    endOverlay.classList.add("active");

    // Update stats and delete game after 2 seconds
    setTimeout(async () => {
      try {
        // Update stats
        await incrementStats("gamesPlayed");
        const winnerUserId = s.players[s.winner!]?.userId;
        if (winnerUserId?.startsWith("bot_")) {
          await incrementStats("botWins");
        } else {
          await incrementStats("humanWins");
        }

        // Delete game
        await remove("games", gameId);
        console.log("Game deleted and stats updated");
      } catch (e) {
        console.error("Failed to update stats or delete game:", e);
      }
    }, 2000);
  }

  btnBackLobby.addEventListener("click", () => {
    stop();
    endOverlay.classList.remove("active");
    onGameEnd();
  });

  function start() {
    // Initialize 3D board
    container.innerHTML = "";
    board = initBoard(container);
    const canvas = board.getDomElement();

    canvas.addEventListener("click", async (e) => {
      if (!state || !board || state.status !== "playing" || state.currentTurn !== playerIdx) return;

      const action = handleClick(e, board, state, playerIdx, mode);
      if (!action) return;

      const newState = applyAction(state, action);
      if (!newState) return;

      // Play sound effect
      if (action.type === "move") {
        playMoveSound();
      } else if (action.type === "wall") {
        playWallSound();
      }

      state = newState;
      ghostWall = null;
      render();

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
      if (!state || !board || state.status !== "playing" || state.currentTurn !== playerIdx) return;
      ghostWall = handleMouseMove(e, board, state, playerIdx, mode);
      render();
    });

    canvas.addEventListener("mouseleave", () => {
      ghostWall = null;
      render();
    });

    unsub = sync.subscribe("games", gameId, (result: any) => {
      const gs = result.data as GameState;
      if (!gs || !gs.players) return;

      const wasMyTurn = state?.currentTurn === playerIdx;

      if (!state) {
        const idx = getPlayerIndex(gs, userId);
        playerIdx = idx === -1 ? (gs.players[1].userId === null ? 1 : 0) : idx;
      }

      // Play sound if opponent just moved (it's now my turn)
      const isNowMyTurn = gs.currentTurn === playerIdx && gs.status === "playing";
      if (state && !wasMyTurn && isNowMyTurn) {
        playMoveSound(); // Opponent moved, notify player it's their turn
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
    if (board) { board.dispose(); board = null; }
  }

  return { start, stop };
}
