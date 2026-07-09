/**
 * 房間即時事件匯流排（同 Node process 內）。
 * action / join 寫入後 publish，SSE 訂閱端立刻收到。
 * 另搭配 SSE 內短輪詢 updatedAt，跨實例／漏訊時仍能追上。
 */

type RoomListener = (version: string) => void;

type GlobalRoomBus = {
  listeners: Map<string, Set<RoomListener>>;
};

const g = globalThis as typeof globalThis & { __siegeRoomBus?: GlobalRoomBus };

function bus(): GlobalRoomBus {
  if (!g.__siegeRoomBus) {
    g.__siegeRoomBus = { listeners: new Map() };
  }
  return g.__siegeRoomBus;
}

export function subscribeRoom(code: string, listener: RoomListener): () => void {
  const key = code.toUpperCase();
  const map = bus().listeners;
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) map.delete(key);
  };
}

export function publishRoom(code: string, version?: string): void {
  const key = code.toUpperCase();
  const set = bus().listeners.get(key);
  if (!set || set.size === 0) return;
  const v = version ?? `${Date.now()}`;
  for (const listener of set) {
    try {
      listener(v);
    } catch {
      /* ignore broken listener */
    }
  }
}
