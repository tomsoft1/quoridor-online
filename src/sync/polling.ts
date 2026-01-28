import type { SyncProvider, Unsubscribe } from "./types";
import { getOne, getList } from "../api";

export class PollingSyncProvider implements SyncProvider {
  private interval: number;

  constructor(intervalMs = 1500) {
    this.interval = intervalMs;
  }

  subscribe(node: string, id: string, callback: (data: any) => void): Unsubscribe {
    let active = true;
    let lastJson = "";

    const poll = async () => {
      if (!active) return;
      try {
        const result = await getOne(node, id);
        const json = JSON.stringify(result);
        if (json !== lastJson) {
          lastJson = json;
          callback(result);
        }
      } catch { /* ignore poll errors */ }
      if (active) setTimeout(poll, this.interval);
    };

    poll();
    return () => { active = false; };
  }

  subscribeList(node: string, filter: Record<string, any>, callback: (items: any[]) => void): Unsubscribe {
    let active = true;
    let lastJson = "";

    const poll = async () => {
      if (!active) return;
      try {
        const result = await getList(node, filter);
        const items = Array.isArray(result) ? result : [];
        const json = JSON.stringify(items);
        if (json !== lastJson) {
          lastJson = json;
          callback(items);
        }
      } catch { /* ignore poll errors */ }
      if (active) setTimeout(poll, this.interval);
    };

    poll();
    return () => { active = false; };
  }
}
