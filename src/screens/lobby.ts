import { create, getList, getUserId, isGuest } from "../api";
import type { SyncProvider } from "../sync/types";
import { createInitialState } from "../game/state";

export function initLobbyScreen(
  sync: SyncProvider,
  onGameStart: (gameId: string) => void,
) {
  const listEl = document.getElementById("lobby-list")!;
  const statusEl = document.getElementById("lobby-status")!;
  let lobbySub: (() => void) | null = null;
  let gamesSub: (() => void) | null = null;
  let joined = false;
  let currentGames: any[] = [];

  function startPolling() {
    stopPolling();
    joined = false;
    currentGames = [];

    lobbySub = sync.subscribeList("lobbies", {}, renderLobby);

    gamesSub = sync.subscribeList("games", {}, (items: any[]) => {
      currentGames = items;
      const userId = getUserId();
      const myGame = items.find((g: any) => {
        const d = g.data;
        if (d.status !== "playing") return false;
        const p0 = d.players?.[0]?.userId;
        const p1 = d.players?.[1]?.userId;
        // Match by userId, or if we're guest and player1 is null (we just created it)
        return p0 === userId || p1 === userId || (joined && p1 === null);
      });
      if (myGame) {
        stopPolling();
        onGameStart(myGame._id);
      }
    });
  }

  function stopPolling() {
    if (lobbySub) { lobbySub(); lobbySub = null; }
    if (gamesSub) { gamesSub(); gamesSub = null; }
  }

  // Check if a game already exists for this host
  function hostHasGame(hostId: string): boolean {
    return currentGames.some((g: any) =>
      g.data?.status === "playing" && g.data?.players?.[0]?.userId === hostId
    );
  }

  function renderLobby(items: any[]) {
    const userId = getUserId();
    const lobby = items[0] as { _id: string; data: { hostId: string; status: string } } | undefined;

    if (!lobby) {
      renderEmpty();
      return;
    }

    const d = lobby.data;

    // I'm the host, waiting
    if (d.hostId === userId && d.status === "waiting") {
      listEl.innerHTML = "";
      document.getElementById("btn-create-lobby")!.style.display = "none";
      statusEl.textContent = "En attente d'un adversaire...";
      return;
    }

    // Someone else is waiting, I can join
    if (d.status === "waiting" && d.hostId !== userId) {
      // Already joined or host already has a game → don't show join button
      if (joined || hostHasGame(d.hostId)) {
        document.getElementById("btn-create-lobby")!.style.display = "none";
        listEl.innerHTML = "";
        statusEl.textContent = joined ? "Lancement..." : "Partie deja en cours, veuillez patienter...";
        return;
      }
      document.getElementById("btn-create-lobby")!.style.display = "none";
      statusEl.textContent = "";
      listEl.innerHTML = "";
      const div = document.createElement("div");
      div.className = "lobby-item";
      div.innerHTML = `<span>Partie en attente</span>`;
      const btn = document.createElement("button");
      btn.textContent = "Rejoindre";
      btn.addEventListener("click", () => joinGame(d.hostId));
      div.appendChild(btn);
      listEl.appendChild(div);
      return;
    }

    renderEmpty();
  }

  function renderEmpty() {
    statusEl.textContent = "";
    listEl.innerHTML = "";
    document.getElementById("btn-create-lobby")!.style.display = "block";
  }

  async function joinGame(hostId: string) {
    const userId = getUserId();
    joined = true;
    statusEl.textContent = "Lancement...";
    listEl.innerHTML = "";
    try {
      const guestId = isGuest() ? null : userId;
      const gameState = createInitialState(hostId, guestId);
      await create("games", gameState);
    } catch (e: any) {
      statusEl.textContent = e.message;
      joined = false;
    }
  }

  document.getElementById("btn-create-lobby")!.addEventListener("click", async () => {
    const userId = getUserId();
    statusEl.textContent = "Creation...";
    try {
      const existing = await getList("lobbies");
      const items = Array.isArray(existing) ? existing : [];
      if (items.length > 0) {
        statusEl.textContent = "Un lobby existe deja.";
        return;
      }
      await create("lobbies", {
        hostId: userId,
        status: "waiting",
      });
      statusEl.textContent = "En attente d'un adversaire...";
      document.getElementById("btn-create-lobby")!.style.display = "none";
    } catch (e: any) {
      statusEl.textContent = e.message;
    }
  });

  return { startPolling, stopPolling };
}
