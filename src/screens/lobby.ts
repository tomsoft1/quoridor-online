import { create, remove, update, getUserId, getStats } from "../api";
import type { SyncProvider } from "../sync/types";
import { createInitialState } from "../game/state";

export function initLobbyScreen(
  sync: SyncProvider,
  onGameStart: (gameId: string) => void,
) {
  const listEl = document.getElementById("lobby-list")!;
  const statusEl = document.getElementById("lobby-status")!;
  const statsEl = document.getElementById("lobby-stats")!;
  const nameInput = document.getElementById("lobby-name") as HTMLInputElement;
  let gamesSub: (() => void) | null = null;
  let currentGames: any[] = [];

  async function loadStats() {
    const stats = await getStats();
    if (stats) {
      statsEl.innerHTML = `<strong>Stats globales:</strong> ${stats.gamesPlayed || 0} parties jouees | Humains: ${stats.humanWins || 0} victoires | Bot: ${stats.botWins || 0} victoires`;
    } else {
      statsEl.innerHTML = `<strong>Stats globales:</strong> Aucune partie jouee`;
    }
  }

  function startPolling() {
    stopPolling();
    currentGames = [];
    loadStats();

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

    // --- My waiting games (with pending requests) ---
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

        // Check if there's a pending player
        if (d.pendingPlayer) {
          div.innerHTML = `<span>${name} — <strong>${d.pendingPlayer}</strong> veut rejoindre</span>`;

          const btnAccept = document.createElement("button");
          btnAccept.textContent = "Accepter";
          btnAccept.addEventListener("click", () => acceptPlayer(game));
          div.appendChild(btnAccept);

          const btnReject = document.createElement("button");
          btnReject.textContent = "Refuser";
          btnReject.style.background = "#16213e";
          btnReject.style.border = "1px solid #555";
          btnReject.addEventListener("click", () => rejectPlayer(game));
          div.appendChild(btnReject);

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
        } else {
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
        }

        listEl.appendChild(div);
      }
    }

    // --- My pending join requests ---
    const myPending = currentGames.filter((g: any) => {
      const d = g.data;
      return d.status === "waiting" && d.pendingPlayer === userId;
    });

    if (myPending.length > 0) {
      const title = document.createElement("p");
      title.className = "lobby-section-title";
      title.textContent = "En attente d'acceptation";
      listEl.appendChild(title);

      for (const game of myPending) {
        const d = game.data;
        const name = d.name || "Sans nom";
        const div = document.createElement("div");
        div.className = "lobby-item";
        div.innerHTML = `<span>${name} — en attente de reponse...</span>`;

        const btnCancel = document.createElement("button");
        btnCancel.textContent = "Annuler";
        btnCancel.style.background = "#16213e";
        btnCancel.style.border = "1px solid #555";
        btnCancel.addEventListener("click", () => cancelJoinRequest(game));
        div.appendChild(btnCancel);

        listEl.appendChild(div);
      }
    }

    // --- Other waiting games (joinable) ---
    const otherWaiting = currentGames.filter((g: any) => {
      const d = g.data;
      if (d.status !== "waiting") return false;
      if (d.players?.[0]?.userId === userId) return false;
      if (d.pendingPlayer === userId) return false; // Already requested
      if (d.pendingPlayer) return false; // Someone else already requested
      return true;
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
        btn.addEventListener("click", () => requestJoin(game));
        div.appendChild(btn);
        listEl.appendChild(div);
      }
    }
  }

  async function requestJoin(game: any) {
    const userId = getUserId();
    statusEl.textContent = "Demande en cours...";
    try {
      const d = { ...game.data, pendingPlayer: userId };
      await update("games", game._id, d);
      statusEl.textContent = "";
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  }

  async function cancelJoinRequest(game: any) {
    try {
      const d = { ...game.data };
      delete d.pendingPlayer;
      await update("games", game._id, d);
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  }

  async function acceptPlayer(game: any) {
    const userId = getUserId();
    statusEl.textContent = "Acceptation...";
    try {
      const d = game.data;
      const pendingId = d.pendingPlayer;
      d.players[1].userId = pendingId;
      d.status = "playing";
      delete d.pendingPlayer;
      const allowed = [userId, pendingId].filter(Boolean) as string[];
      await update("games", game._id, d, allowed);
      statusEl.textContent = "";
      stopPolling();
      onGameStart(game._id);
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  }

  async function rejectPlayer(game: any) {
    try {
      const d = { ...game.data };
      delete d.pendingPlayer;
      await update("games", game._id, d);
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
      await create("games", gameState); // No allowed restriction - anyone can request to join
      nameInput.value = "";
      statusEl.textContent = "";
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  });

  return { startPolling, stopPolling };
}
