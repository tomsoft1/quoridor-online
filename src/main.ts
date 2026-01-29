import { hasIdentity, logout, zs } from "./api";
import { WebSocketSyncProvider } from "./sync/websocket";
import { initLoginScreen } from "./screens/login";
import { initLobbyScreen } from "./screens/lobby";
import { initGameScreen } from "./screens/play";

const sync = new WebSocketSyncProvider();

function showScreen(id: string) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(`screen-${id}`)?.classList.add("active");
}

function startGame(gameId: string) {
  window.location.hash = `game=${gameId}`;
  showScreen("game");
  gameScreen = initGameScreen(sync, gameId, () => {
    window.location.hash = "";
    showScreen("lobby");
    lobby.startPolling();
  });
  gameScreen.start();
}

function getGameIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#game=(.+)$/);
  return match ? match[1] : null;
}

// Login screen
initLoginScreen(() => {
  showScreen("lobby");
  lobby.startPolling();
});

// Lobby screen
let gameScreen: ReturnType<typeof initGameScreen> | null = null;

const lobby = initLobbyScreen(sync, startGame);

// Logout button
document.getElementById("btn-logout")!.addEventListener("click", () => {
  lobby.stopPolling();
  logout();
  showScreen("login");
});

// Configure TTL: games expire after 60 minutes
zs.config.setNodeTTL({ games: 21600 }).catch(() => {}); // 6 hours

// Auto-restore session
if (hasIdentity()) {
  const savedGameId = getGameIdFromHash();
  if (savedGameId) {
    startGame(savedGameId);
  } else {
    showScreen("lobby");
    lobby.startPolling();
  }
}
