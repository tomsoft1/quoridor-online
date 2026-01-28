import { create, remove, update, getUserId, isGuest } from "../api";
import type { SyncProvider } from "../sync/types";
import { createInitialState } from "../game/state";

export function initLobbyScreen(
  sync: SyncProvider,
  onGameStart: (gameId: string) => void,
) {
  const listEl = document.getElementById("lobby-list")!;
  const statusEl = document.getElementById("lobby-status")!;
  const nameInput = document.getElementById("lobby-name") as HTMLInputElement;
  let gamesSub: (() => void) | null = null;
  let currentGames: any[] = [];

  function startPolling() {
    stopPolling();
    currentGames = [];

    gamesSub = sync.subscribeList("games", {}, (items: any[]) => {
      currentGames = items;
      renderAll();
    });
  }

  function stopPolling() {
    if (gamesSub) { gamesSub(); gamesSub = null; }
  }

  function renderAll() {
    const userId = getUserId();
    listEl.innerHTML = "";
    statusEl.textContent = "";

    // --- My active games (playing) ---
    const myGames = currentGames.filter((g: any) => {
      const d = g.data;
      if (d.status !== "playing") return false;
      return d.players?.[0]?.userId === userId || d.players?.[1]?.userId === userId;
    });

    if (myGames.length > 0) {
      const title = document.createElement("p");
      title.className = "lobby-section-title";
      title.textContent = "Vos parties en cours";
      listEl.appendChild(title);

      for (const game of myGames) {
        const d = game.data;
        const isMyTurn = d.players?.[d.currentTurn]?.userId === userId;
        const div = document.createElement("div");
        div.className = "lobby-item my-game";
        const opponent = d.players?.[0]?.userId === userId
          ? (d.players?.[1]?.userId || "En attente")
          : (d.players?.[0]?.userId || "En attente");
        const turnText = isMyTurn ? "A vous" : "En attente";
        const name = d.name ? `${d.name} — ` : "";
        div.innerHTML = `<span>${name}vs ${opponent} — <strong>${turnText}</strong></span>`;
        const btn = document.createElement("button");
        btn.textContent = "Reprendre";
        btn.addEventListener("click", () => {
          stopPolling();
          onGameStart(game._id);
        });
        div.appendChild(btn);
        listEl.appendChild(div);
      }
    }

    // --- My waiting games ---
    const myWaiting = currentGames.filter((g: any) => {
      const d = g.data;
      return d.status === "waiting" && d.players?.[0]?.userId === userId;
    });

    if (myWaiting.length > 0) {
      const title = document.createElement("p");
      title.className = "lobby-section-title";
      title.textContent = "Vos parties en attente";
      listEl.appendChild(title);

      for (const game of myWaiting) {
        const d = game.data;
        const name = d.name || "Sans nom";
        const div = document.createElement("div");
        div.className = "lobby-item my-game";
        div.innerHTML = `<span>${name} — en attente d'un adversaire...</span>`;

        const btnStart = document.createElement("button");
        btnStart.textContent = "Entrer";
        btnStart.addEventListener("click", () => {
          stopPolling();
          onGameStart(game._id);
        });
        div.appendChild(btnStart);

        const btnCancel = document.createElement("button");
        btnCancel.textContent = "Annuler";
        btnCancel.style.background = "#16213e";
        btnCancel.style.border = "1px solid #e94560";
        btnCancel.style.color = "#e94560";
        btnCancel.addEventListener("click", async () => {
          try {
            await remove("games", game._id);
          } catch (e: any) {
            statusEl.textContent = e.message;
          }
        });
        div.appendChild(btnCancel);
        listEl.appendChild(div);
      }
    }

    // --- Other waiting games (joinable) ---
    const otherWaiting = currentGames.filter((g: any) => {
      const d = g.data;
      return d.status === "waiting" && d.players?.[0]?.userId !== userId;
    });

    if (otherWaiting.length > 0) {
      const title = document.createElement("p");
      title.className = "lobby-section-title";
      title.textContent = "Parties disponibles";
      listEl.appendChild(title);

      for (const game of otherWaiting) {
        const d = game.data;
        const name = d.name || "Sans nom";
        const div = document.createElement("div");
        div.className = "lobby-item";
        div.innerHTML = `<span>${name}</span>`;
        const btn = document.createElement("button");
        btn.textContent = "Rejoindre";
        btn.addEventListener("click", () => joinGame(game));
        div.appendChild(btn);
        listEl.appendChild(div);
      }
    }
  }

  async function joinGame(game: any) {
    const userId = getUserId();
    statusEl.textContent = "Lancement...";
    try {
      const d = game.data;
      d.players[1].userId = isGuest() ? null : userId;
      d.status = "playing";
      const hostId = d.players[0].userId;
      const allowed = [hostId, userId].filter(Boolean) as string[];
      await update("games", game._id, d, allowed);
      stopPolling();
      onGameStart(game._id);
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  }

  document.getElementById("btn-create-lobby")!.addEventListener("click", async () => {
    const userId = getUserId();
    const name = nameInput.value.trim() || "Sans nom";
    statusEl.textContent = "Creation...";
    try {
      const gameState = createInitialState(userId, null);
      (gameState as any).name = name;
      (gameState as any).status = "waiting";
      await create("games", gameState, [userId]);
      nameInput.value = "";
      statusEl.textContent = "";
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  });

  return { startPolling, stopPolling };
}
