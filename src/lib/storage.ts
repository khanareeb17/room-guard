/**
 * On-device storage.
 *  - Photos (evidence) → IndexedDB via idb-keyval (blobs).
 *  - Stay state (rooms, checklist ticks, scan results) → localStorage (small JSON).
 * Nothing is ever sent anywhere.
 */
import { createStore, del, get, keys, set, clear } from "idb-keyval";
import type { DetectMode } from "./detection/types";
import type { RoomDef } from "./rooms";

export type CandidateVerdict = "possible" | "likely" | "reflection" | "light" | "inconclusive" | "safe" | "ir";

export interface CandidateRecord {
  id: string;
  at: number;
  mode: DetectMode;
  verdict: CandidateVerdict;
}

export interface RoomRecord {
  scanMs: number;
  irScanMs: number;
  checked: string[];
  candidates: CandidateRecord[];
  lensScans: number;
  irScans: number;
}

export interface StayState {
  id: string;
  startedAt: number;
  address: string;
  currentRoom: string;
  customRooms: RoomDef[];
  rooms: Record<string, RoomRecord>;
}

export interface CaptureMeta {
  id: string;
  createdAt: number;
  roomId: string;
  roomName: string;
  mode: DetectMode;
  verdict: string;
  width: number;
  height: number;
  bytes: number;
}

const STAY_KEY = "rg.stay.v1";

export function emptyRoom(): RoomRecord {
  return { scanMs: 0, irScanMs: 0, checked: [], candidates: [], lensScans: 0, irScans: 0 };
}

export function newStay(): StayState {
  return {
    id: `${Date.now().toString(36)}`,
    startedAt: Date.now(),
    address: "",
    currentRoom: "bedroom1",
    customRooms: [],
    rooms: {},
  };
}

export function loadStay(): StayState {
  try {
    const raw = localStorage.getItem(STAY_KEY);
    if (raw) return { ...newStay(), ...(JSON.parse(raw) as Partial<StayState>) };
  } catch {
    /* ignore */
  }
  return newStay();
}

export function saveStay(s: StayState): void {
  try {
    localStorage.setItem(STAY_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---- IndexedDB (photos) ----

let store: ReturnType<typeof createStore> | null = null;
function db() {
  if (!store) store = createStore("roomguard", "evidence");
  return store;
}

const META_KEY = "captures:index";

export async function listCaptures(): Promise<CaptureMeta[]> {
  try {
    return ((await get<CaptureMeta[]>(META_KEY, db())) ?? []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveCapture(meta: CaptureMeta, full: Blob, thumb: Blob): Promise<void> {
  await set(`full:${meta.id}`, full, db());
  await set(`thumb:${meta.id}`, thumb, db());
  const list = (await get<CaptureMeta[]>(META_KEY, db())) ?? [];
  list.push(meta);
  await set(META_KEY, list, db());
}

export async function getCaptureBlob(id: string, kind: "full" | "thumb"): Promise<Blob | undefined> {
  try {
    return await get<Blob>(`${kind}:${id}`, db());
  } catch {
    return undefined;
  }
}

export async function deleteCapture(id: string): Promise<void> {
  await del(`full:${id}`, db());
  await del(`thumb:${id}`, db());
  const list = (await get<CaptureMeta[]>(META_KEY, db())) ?? [];
  await set(
    META_KEY,
    list.filter((m) => m.id !== id),
    db(),
  );
}

export async function clearCaptures(): Promise<void> {
  try {
    await clear(db());
  } catch {
    /* ignore */
  }
}

/** Approximate bytes used by saved photos (+ origin estimate when available). */
export async function storageUsed(): Promise<number> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === "number") return est.usage;
    }
  } catch {
    /* fall through */
  }
  try {
    const ks = await keys(db());
    let total = 0;
    for (const k of ks) {
      const v = await get(k, db());
      if (v instanceof Blob) total += v.size;
    }
    return total;
  } catch {
    return 0;
  }
}
