import type { SyncProvider, Unsubscribe } from "./types";
import { zs, getList, getOne } from "../api";

export class WebSocketSyncProvider implements SyncProvider {
  subscribe(node: string, id: string, callback: (data: any) => void): Unsubscribe {
    let active = true;

    // Initial fetch
    getOne(node, id).then(data => { if (active && data) callback(data); }).catch(() => {});

    // Realtime updates
    const handler = (item: any, event: string) => {
      if (!active) return;
      if (event === "updated" || event === "created") {
        if (item?._id === id) callback(item);
      }
    };

    zs.realtime.subscribe(node, handler);

    return () => {
      active = false;
      zs.realtime.unsubscribe(node);
    };
  }

  subscribeList(node: string, filter: Record<string, any>, callback: (items: any[]) => void): Unsubscribe {
    let active = true;
    const filterObj = Object.keys(filter).length ? filter : undefined;

    const refresh = () => {
      getList(node, filterObj)
        .then(result => {
          if (!active) return;
          callback(Array.isArray(result) ? result : []);
        })
        .catch(() => {});
    };

    // Initial fetch
    refresh();

    const handler = (_item: any, _event: string) => {
      if (!active) return;
      refresh();
    };

    zs.realtime.subscribe(node, handler);

    return () => {
      active = false;
      zs.realtime.unsubscribe(node);
    };
  }
}
