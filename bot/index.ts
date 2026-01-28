import { getList, update, BOT_ID } from "./api.js";
import { GameState, chooseAction, applyAction } from "./strategy.js";

const POLL_INTERVAL = 5000; // 5 seconds

// Track games we've already joined to avoid duplicate joins
const joinedGames = new Set<string>();

async function tick() {
  try {
    const games = await getList("games");

    for (const game of games) {
      const state = game.data as GameState;
      const gameId = game._id;

      // Join waiting games
      if (state.status === "waiting" && !joinedGames.has(gameId)) {
        console.log(`[BOT] Joining game ${gameId}...`);
        try {
          state.players[1].userId = BOT_ID;
          state.status = "playing";
          const hostId = state.players[0].userId;
          const allowed = [hostId, BOT_ID].filter(Boolean) as string[];
          await update("games", gameId, state, allowed);
          joinedGames.add(gameId);
          console.log(`[BOT] Joined game ${gameId}`);
        } catch (e: any) {
          console.error(`[BOT] Failed to join game ${gameId}:`, e.message);
        }
        continue;
      }

      // Play in active games where it's bot's turn
      if (state.status === "playing") {
        const botIdx = state.players[0].userId === BOT_ID ? 0 :
                       state.players[1].userId === BOT_ID ? 1 : -1;

        if (botIdx === -1) continue; // Bot not in this game

        if (state.currentTurn === botIdx) {
          console.log(`[BOT] Playing in game ${gameId}...`);
          try {
            const action = chooseAction(state, botIdx as 0 | 1);
            const newState = applyAction(state, action);

            if (newState) {
              await update("games", gameId, newState);
              console.log(`[BOT] Played ${action.type} in game ${gameId}`);

              if (newState.status === "finished") {
                console.log(`[BOT] Game ${gameId} finished! Winner: ${newState.winner === botIdx ? "BOT" : "Player"}`);
                joinedGames.delete(gameId);
              }
            }
          } catch (e: any) {
            console.error(`[BOT] Failed to play in game ${gameId}:`, e.message);
          }
        }
      }

      // Clean up finished games from tracking
      if (state.status === "finished") {
        joinedGames.delete(gameId);
      }
    }
  } catch (e: any) {
    console.error("[BOT] Error during tick:", e.message);
  }
}

async function main() {
  console.log("[BOT] Quoridor Bot started");
  console.log(`[BOT] Bot ID: ${BOT_ID}`);
  console.log(`[BOT] Polling every ${POLL_INTERVAL / 1000}s`);

  // Initial tick
  await tick();

  // Poll loop
  setInterval(tick, POLL_INTERVAL);
}

main();
