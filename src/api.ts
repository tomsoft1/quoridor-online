const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3002/api";

let apiKey = "";
let accessToken = sessionStorage.getItem("accessToken") || "";
let refreshToken = sessionStorage.getItem("refreshToken") || "";
let currentUserId = sessionStorage.getItem("userId") || "";

function persist() {
  sessionStorage.setItem("accessToken", accessToken);
  sessionStorage.setItem("refreshToken", refreshToken);
  sessionStorage.setItem("userId", currentUserId);
}

export function setApiKey(key: string) { apiKey = key; }
export function getToken() { return accessToken; }
export function getUserId() { return currentUserId; }
export function isLoggedIn() { return !!accessToken; }
export function hasIdentity() { return !!currentUserId; }
export function isGuest() { return !accessToken && !!guestId; }

let guestId = sessionStorage.getItem("guestId") || "";

function ensureGuestId(): string {
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("guestId", guestId);
  }
  return guestId;
}

export function loginAsGuest() {
  currentUserId = ensureGuestId();
  persist();
}

function headers(auth = true): Record<string, string> {
  const h: Record<string, string> = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };
  if (auth && accessToken) {
    h["Authorization"] = `Bearer ${accessToken}`;
  } else if (!accessToken) {
    h["x-guest-id"] = ensureGuestId();
  }
  return h;
}

async function request(method: string, path: string, body?: any, auth = true) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(auth),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  // ZeroStack wraps responses in { success, data }
  return json.data !== undefined ? json.data : json;
}

// Auth
export async function register(email: string, password: string) {
  const data = await request("POST", "/auth/register", { email, password }, false);
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  currentUserId = data.user?.id || data.user?._id || "";
  persist();
  return data;
}

export async function login(email: string, password: string) {
  const data = await request("POST", "/auth/login", { email, password }, false);
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  currentUserId = data.user?.id || data.user?._id || "";
  persist();
  return data;
}

export async function refreshAuth() {
  const data = await request("POST", "/auth/refresh", { refreshToken }, false);
  accessToken = data.accessToken;
  if (data.refreshToken) refreshToken = data.refreshToken;
}

// Data CRUD
export async function getList(node: string, filter?: Record<string, any>, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filter) params.set("filter", JSON.stringify(filter));
  return request("GET", `/data/${node}?${params}`);
}

export async function getOne(node: string, id: string) {
  return request("GET", `/data/${node}/${id}`);
}

export async function create(node: string, data: any, visibility: "public" | "private" = "public") {
  return request("POST", `/data/${node}`, { data, visibility });
}

export async function update(node: string, id: string, data: any) {
  return request("PUT", `/data/${node}/${id}`, { data });
}

export async function remove(node: string, id: string) {
  return request("DELETE", `/data/${node}/${id}`);
}
