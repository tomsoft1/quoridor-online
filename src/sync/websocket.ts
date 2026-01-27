import { io, Socket } from "socket.io-client";
import type { SyncProvider, Unsubscribe } from "./types";
import { getList, getOne } from "../api";

export class WebSocketSyncProvider implements SyncProvider {
  private socket: Socket;
  private subscribedNodes = new Map<string, number>(); // node -> ref count

  constructor(url: string, apiKey: string) {
    this.socket = io(url, {
      auth: { apiKey },
      transports: ["websocket"],
    });
    this.socket.on("connect", () => console.log("[ws] connected, id:", this.socket.id));
    this.socket.on("connect_error", (err) => console.error("[ws] connect error:", err.message));
    this.socket.onAny((event, ...args) => console.log("[ws] event:", event, args));
  }

  private joinNode(node: string) {
    const count = this.subscribedNodes.get(node) || 0;
    if (count === 0) {
      this.socket.emit("subscribe", { node });
    }
    this.subscribedNodes.set(node, count + 1);
  }

  private leaveNode(node: string) {
    const count = (this.subscribedNodes.get(node) || 1) - 1;
    if (count <= 0) {
      this.socket.emit("unsubscribe", { node });
      this.subscribedNodes.delete(node);
    } else {
      this.subscribedNodes.set(node, count);
    }
  }

  subscribe(node: string, id: string, callback: (data: any) => void): Unsubscribe {
    let active = true;

    // Initial fetch
    getOne(node, id).then(data => { if (active) callback(data); }).catch(() => {});

    const onUpdated = (event: { node: string; item: any }) => {
      if (!active || event.node !== node) return;
      if (event.item?._id === id) callback(event.item);
    };

    const onCreated = (event: { node: string; item: any }) => {
      if (!active || event.node !== node) return;
      if (event.item?._id === id) callback(event.item);
    };

    this.joinNode(node);
    this.socket.on("data:updated", onUpdated);
    this.socket.on("data:created", onCreated);

    return () => {
      active = false;
      this.socket.off("data:updated", onUpdated);
      this.socket.off("data:created", onCreated);
      this.leaveNode(node);
    };
  }

  subscribeList(node: string, filter: Record<string, any>, callback: (items: any[]) => void): Unsubscribe {
    let active = true;
    let items: any[] = [];

    const matchesFilter = (item: any) => {
      for (const [key, val] of Object.entries(filter)) {
        if (item?.data?.[key] !== val) return false;
      }
      return true;
    };

    // Initial fetch
    getList(node, Object.keys(filter).length ? filter : undefined)
      .then(result => {
        if (!active) return;
        items = Array.isArray(result) ? result : [];
        callback(items);
      })
      .catch(() => {});

    const onCreated = (event: { node: string; item: any }) => {
      if (!active || event.node !== node) return;
      if (matchesFilter(event.item)) {
        items = [...items, event.item];
        callback(items);
      }
    };

    const onUpdated = (event: { node: string; item: any }) => {
      if (!active || event.node !== node) return;
      const idx = items.findIndex(i => i._id === event.item?._id);
      if (idx >= 0) {
        if (matchesFilter(event.item)) {
          items = items.map(i => i._id === event.item._id ? event.item : i);
        } else {
          items = items.filter(i => i._id !== event.item._id);
        }
        callback(items);
      } else if (matchesFilter(event.item)) {
        items = [...items, event.item];
        callback(items);
      }
    };

    const onDeleted = (event: { node: string; id: string }) => {
      if (!active || event.node !== node) return;
      const before = items.length;
      items = items.filter(i => i._id !== event.id);
      if (items.length !== before) callback(items);
    };

    this.joinNode(node);
    this.socket.on("data:created", onCreated);
    this.socket.on("data:updated", onUpdated);
    this.socket.on("data:deleted", onDeleted);

    return () => {
      active = false;
      this.socket.off("data:created", onCreated);
      this.socket.off("data:updated", onUpdated);
      this.socket.off("data:deleted", onDeleted);
      this.leaveNode(node);
    };
  }
}
