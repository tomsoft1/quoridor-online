import { io } from "socket.io-client";
import ZeroStack from "zerostack-sdk";

// SDK expects global `io` for WebSocket support
(window as any).io = io;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002/api";
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3002";
const API_KEY = import.meta.env.VITE_API_KEY || "zs_ef89725e1beff20215fe396a394af373a0563e8b577725612611177e23135cc4";

export const zs = new ZeroStack({ apiUrl: API_URL, wsUrl: WS_URL, apiKey: API_KEY });

// Session persistence
let accessToken = sessionStorage.getItem("accessToken") || "";
let currentUserId = sessionStorage.getItem("userId") || "";
let guestId = sessionStorage.getItem("guestId") || "";

if (accessToken) zs.setToken(accessToken);
if (guestId && !accessToken) zs.setGuestId(guestId);

function persist() {
  sessionStorage.setItem("accessToken", accessToken);
  sessionStorage.setItem("userId", currentUserId);
}

export function getUserId() { return currentUserId; }
export function hasIdentity() { return !!currentUserId; }
export function isGuest() { return !accessToken && !!guestId; }

function ensureGuestId(): string {
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("guestId", guestId);
  }
  zs.setGuestId(guestId);
  return guestId;
}

export function loginAsGuest() {
  currentUserId = ensureGuestId();
  persist();
}

export function logout() {
  accessToken = "";
  currentUserId = "";
  guestId = "";
  zs.clearToken();
  zs.clearGuestId();
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("userId");
  sessionStorage.removeItem("guestId");
}

// Auth
export async function register(email: string, password: string) {
  const data = await zs.auth.register(email, password);
  accessToken = data.accessToken;
  zs.setToken(accessToken);
  currentUserId = data.user?.id || data.user?._id || "";
  persist();
  return data;
}

export async function login(email: string, password: string) {
  const data = await zs.auth.login(email, password);
  accessToken = data.accessToken;
  zs.setToken(accessToken);
  currentUserId = data.user?.id || data.user?._id || "";
  persist();
  return data;
}

// Data CRUD
export async function getList(node: string, filter?: Record<string, any>, limit = 50) {
  const result = await zs.data.list(node, { limit, filter });
  return Array.isArray(result) ? result : [];
}

export async function getOne(node: string, id: string) {
  // SDK doesn't expose GET /data/:node/:id, use internal _request
  return (zs as any)._request("GET", `/data/${node}/${id}`);
}

export async function create(node: string, data: any, allowed?: string[]) {
  return zs.data.create(node, data, { visibility: "public", ...(allowed ? { allowed } : {}) });
}

export async function update(node: string, id: string, data: any, allowed?: string[]) {
  return zs.data.update(node, id, data, allowed ? { allowed } : undefined);
}

export async function remove(node: string, id: string) {
  return zs.data.delete(node, id);
}

// Stats
const STATS_ID = "global";

export async function getStats() {
  try {
    const result = await getList("stats");
    return result.find((s: any) => s.data?.id === STATS_ID)?.data || null;
  } catch {
    return null;
  }
}

export async function incrementStats(field: "gamesPlayed" | "botWins" | "humanWins") {
  try {
    const result = await getList("stats");
    const existing = result.find((s: any) => s.data?.id === STATS_ID);

    if (existing) {
      const data = { ...existing.data, [field]: (existing.data[field] || 0) + 1 };
      await update("stats", existing._id, data);
    } else {
      const data = { id: STATS_ID, gamesPlayed: 0, botWins: 0, humanWins: 0, [field]: 1 };
      await create("stats", data);
    }
  } catch (e) {
    console.error("Failed to update stats:", e);
  }
}
