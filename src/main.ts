import { setApiKey, hasIdentity } from "./api";
import { WebSocketSyncProvider } from "./sync/websocket";
import { initLoginScreen } from "./screens/login";
import { initLobbyScreen } from "./screens/lobby";
import { initGameScreen } from "./screens/play";

const API_KEY = import.meta.env.VITE_API_KEY || "zs_ef89725e1beff20215fe396a394af373a0563e8b577725612611177e23135cc4";
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3002";
setApiKey(API_KEY);

const sync = new WebSocketSyncProvider(WS_URL, API_KEY);

function showScreen(id: string) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(`screen-${id}`)?.classList.add("active");
}

// Login screen
initLoginScreen(() => {
  showScreen("lobby");
  lobby.startPolling();
});

// Lobby screen
let gameScreen: ReturnType<typeof initGameScreen> | null = null;

const lobby = initLobbyScreen(sync, (gameId: string) => {
  showScreen("game");
  gameScreen = initGameScreen(sync, gameId, () => {
    showScreen("lobby");
    lobby.startPolling();
  });
  gameScreen.start();
});

// Auto-restore session
if (hasIdentity()) {
  showScreen("lobby");
  lobby.startPolling();
}
