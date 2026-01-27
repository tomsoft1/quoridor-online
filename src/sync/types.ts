export type Unsubscribe = () => void;

export interface SyncProvider {
  subscribe(node: string, id: string, callback: (data: any) => void): Unsubscribe;
  subscribeList(node: string, filter: Record<string, any>, callback: (items: any[]) => void): Unsubscribe;
}
