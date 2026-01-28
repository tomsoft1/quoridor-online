import { io } from "socket.io-client";
import ZeroStack from "zerostack-sdk";

// SDK expects global `io` for WebSocket support
(globalThis as any).io = io;

const API_URL = process.env.API_URL || "https://zerostack.myapp.fr/api";
const WS_URL = process.env.WS_URL || "https://zerostack.myapp.fr";
const API_KEY = process.env.API_KEY || "zs_bfb573f4d58f804cfc475757e9d3f7a2376428cb3cf2193e31f2571124d167e7";

export const BOT_ID = "bot_quoridor";

export const zs = new ZeroStack({ apiUrl: API_URL, wsUrl: WS_URL, apiKey: API_KEY });
zs.setGuestId(BOT_ID);

export async function getList(node: string, filter?: Record<string, any>, limit = 50) {
  const result = await zs.data.list(node, { limit, filter });
  return Array.isArray(result) ? result : [];
}

export async function getOne(node: string, id: string) {
  return (zs as any)._request("GET", `/data/${node}/${id}`);
}

export async function update(node: string, id: string, data: any, allowed?: string[]) {
  return zs.data.update(node, id, data, allowed ? { allowed } : undefined);
}
