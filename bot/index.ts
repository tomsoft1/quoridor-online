import { getList, update, BOT_ID, zs } from "./api.js";
import { GameState, chooseAction, applyAction } from "./strategy.js";

// Track games we've already joined to avoid duplicate joins
const joinedGames = new Set<string>();

// Track when games were first seen (for delay before joining)
const gameFirstSeen = new Map<string, number>();

// Delay before bot requests to join (give humans a chance)
const JOIN_DELAY_MS = 10000;

// Local cache of games
let gamesCache: Map<string, any> = new Map();

function logStats() {
  const games = Array.from(gamesCache.values());
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
}

async function processGame(game: any) {
  const state = game.data as GameState;
  const gameId = game._id;

  // Request to join waiting games (skip if someone else already requested)
  if (state.status === "waiting" && !joinedGames.has(gameId) && !(state as any).pendingPlayer) {
    // Track when we first saw this game
    if (!gameFirstSeen.has(gameId)) {
      gameFirstSeen.set(gameId, Date.now());
      const gameName = (state as any).name || "Sans nom";
      console.log(`[BOT] New game "${gameName}" (${gameId}) detected, waiting ${JOIN_DELAY_MS / 1000}s before joining...`);
      setTimeout(() => processGame(game), JOIN_DELAY_MS);
      return;
    }

    // Check if delay has passed
    const elapsed = Date.now() - gameFirstSeen.get(gameId)!;
    if (elapsed < JOIN_DELAY_MS) {
      return; // Still waiting
    }

    const gameName = (state as any).name || "Sans nom";
    const host = state.players[0]?.userId || "?";
    console.log(`[BOT] Requesting to join "${gameName}" (${gameId}) hosted by ${host}...`);
    try {
      (state as any).pendingPlayer = BOT_ID;
      await update("games", gameId, state);
      joinedGames.add(gameId);
      gameFirstSeen.delete(gameId);
      console.log(`[BOT] Requested to join game ${gameId}, waiting for acceptance`);
    } catch (e: any) {
      console.error(`[BOT] Failed to request join for game ${gameId}:`, e.message);
    }
    return;
  }

  // Play in active games where it's bot's turn
  if (state.status === "playing") {
    const botIdx = state.players[0].userId === BOT_ID ? 0 :
                   state.players[1].userId === BOT_ID ? 1 : -1;

    if (botIdx === -1) return; // Bot not in this game

    if (state.currentTurn === botIdx) {
      const gameName = (state as any).name || "Sans nom";
      const opponent = state.players[1 - botIdx]?.userId || "?";
      console.log(`[BOT] Playing in "${gameName}" (${gameId}) vs ${opponent}...`);
      try {
        const action = chooseAction(state, botIdx as 0 | 1);
        const newState = applyAction(state, action);

        if (newState) {
          await update("games", gameId, newState);
          const actionDesc = action.type === "move"
            ? `move to (${action.pos.row},${action.pos.col})`
            : `wall ${action.wall.orientation} at (${action.wall.row},${action.wall.col})`;
          console.log(`[BOT] Played ${actionDesc} in game ${gameId}`);

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

  // Clean up finished/playing games from tracking
  if (state.status === "finished" || state.status === "playing") {
    joinedGames.delete(gameId);
    gameFirstSeen.delete(gameId);
  }
}

async function main() {
  console.log("[BOT] Quoridor Bot started (WebSocket mode)");
  console.log(`[BOT] Bot ID: ${BOT_ID}`);

  // Initial fetch
  console.log("[BOT] Fetching initial games...");
  const initialGames = await getList("games");
  for (const game of initialGames) {
    gamesCache.set(game._id, game);
  }
  logStats();

  // Process all games initially
  for (const game of initialGames) {
    await processGame(game);
  }

  // Subscribe to realtime updates
  console.log("[BOT] Subscribing to realtime updates...");
  zs.realtime.subscribe("games", async (item: any, event: string) => {
    const itemId = item?._id || item?.id;
    console.log(`[BOT] Realtime event: ${event} for game ${itemId || "unknown"}`);

    if (!itemId) {
      console.log(`[BOT] Ignoring event with no item ID`);
      return;
    }

    if (event === "created" || event === "updated") {
      gamesCache.set(itemId, item);
      logStats();
      await processGame(item);
    } else if (event === "deleted") {
      gamesCache.delete(itemId);
      joinedGames.delete(itemId);
      gameFirstSeen.delete(itemId);
      logStats();
    }
  });

  console.log("[BOT] Listening for game updates...");
}

main().catch(console.error);
