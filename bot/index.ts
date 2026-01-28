import { getList, update, BOT_ID } from "./api.js";
import { GameState, chooseAction, applyAction } from "./strategy.js";

const POLL_INTERVAL = 5000; // 5 seconds

// Track games we've already joined to avoid duplicate joins
const joinedGames = new Set<string>();

async function tick() {
  try {
    const games = await getList("games");

    // Stats
    const waitingGames = games.filter((g: any) => g.data.status === "waiting");
    const playingGames = games.filter((g: any) => g.data.status === "playing");
    const botGames = playingGames.filter((g: any) =>
      g.data.players?.[0]?.userId === BOT_ID || g.data.players?.[1]?.userId === BOT_ID
    );
    const botTurn = botGames.filter((g: any) => {
      const botIdx = g.data.players?.[0]?.userId === BOT_ID ? 0 : 1;
      return g.data.currentTurn === botIdx;
    });

    console.log(`[BOT] Games: ${games.length} total | ${waitingGames.length} waiting | ${playingGames.length} playing | ${botGames.length} bot games | ${botTurn.length} bot's turn`);

    for (const game of games) {
      const state = game.data as GameState;
      const gameId = game._id;

      // Request to join waiting games (skip if someone else already requested)
      if (state.status === "waiting" && !joinedGames.has(gameId) && !(state as any).pendingPlayer) {
        const gameName = (state as any).name || "Sans nom";
        const host = state.players[0]?.userId || "?";
        console.log(`[BOT] Requesting to join "${gameName}" (${gameId}) hosted by ${host}...`);
        try {
          (state as any).pendingPlayer = BOT_ID;
          await update("games", gameId, state);
          joinedGames.add(gameId);
          console.log(`[BOT] Requested to join game ${gameId}, waiting for acceptance`);
        } catch (e: any) {
          console.error(`[BOT] Failed to request join for game ${gameId}:`, e.message);
        }
        continue;
      }

      // Play in active games where it's bot's turn
      if (state.status === "playing") {
        const botIdx = state.players[0].userId === BOT_ID ? 0 :
                       state.players[1].userId === BOT_ID ? 1 : -1;

        if (botIdx === -1) continue; // Bot not in this game

        if (state.currentTurn === botIdx) {
          const gameName = (state as any).name || "Sans nom";
          const opponent = state.players[1 - botIdx]?.userId || "?";
          console.log(`[BOT] Playing in "${gameName}" (${gameId}) vs ${opponent}...`);
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
