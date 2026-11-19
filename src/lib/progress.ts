import { itemsForRoom } from "./checklist-data";
import type { RoomDef } from "./rooms";
import type { StayState } from "./storage";

export function roomProgress(stay: StayState, room: RoomDef): { done: number; total: number } {
  const items = itemsForRoom(room.kind);
  const checked = new Set(stay.rooms[room.id]?.checked ?? []);
  return { done: items.filter((i) => checked.has(i.id)).length, total: items.length };
}

/** Overall progress across rooms the user has started (plus the current room). */
export function overallProgress(stay: StayState, rooms: RoomDef[]): { done: number; total: number; rooms: number } {
  const active = rooms.filter((r) => {
    const rec = stay.rooms[r.id];
    return r.id === stay.currentRoom || (rec && (rec.checked.length > 0 || rec.lensScans > 0 || rec.irScans > 0));
  });
  let done = 0;
  let total = 0;
  for (const r of active) {
    const p = roomProgress(stay, r);
    done += p.done;
    total += p.total;
  }
  return { done, total, rooms: active.length };
}
