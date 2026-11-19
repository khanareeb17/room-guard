"use client";
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { emptyRoom, loadStay, newStay, saveStay, type RoomRecord, type StayState } from "@/lib/storage";
import { createStore } from "@/lib/store";
import { translate, type I18nKey } from "@/lib/i18n";
import { BUILTIN_ROOMS, type RoomDef } from "@/lib/rooms";
import { useHashView, type View } from "@/hooks/useHashView";

const settingsStore = createStore<Settings>(
  () => (typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings()),
  saveSettings,
);
const SERVER_STAY = newStay();
const stayStore = createStore<StayState>(() => (typeof window === "undefined" ? SERVER_STAY : loadStay()), saveStay);

export interface ToastMsg {
  id: number;
  text: string;
  thumb?: string;
  tone?: "info" | "success" | "error";
}

interface AppCtx {
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  stay: StayState;
  updateStay: (fn: (s: StayState) => StayState) => void;
  updateRoom: (roomId: string, fn: (r: RoomRecord) => RoomRecord) => void;
  resetStay: () => void;
  rooms: RoomDef[];
  roomName: (id: string) => string;
  view: View;
  navigate: (v: View, opts?: { replace?: boolean }) => void;
  toast: (text: string, opts?: Omit<ToastMsg, "id" | "text">) => void;
  toasts: ToastMsg[];
  dismissToast: (id: number) => void;
  testVideo: { url: string; name: string } | null;
  setTestVideo: (v: { url: string; name: string } | null) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, () => DEFAULT_SETTINGS);
  const stay = useSyncExternalStore(stayStore.subscribe, stayStore.get, () => SERVER_STAY);
  const [view, navigate] = useHashView();
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [testVideo, setTestVideoState] = useState<{ url: string; name: string } | null>(null);

  const updateSettings = useCallback((p: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...p })), []);
  const updateStay = useCallback((fn: (s: StayState) => StayState) => stayStore.set(fn), []);
  const updateRoom = useCallback(
    (roomId: string, fn: (r: RoomRecord) => RoomRecord) =>
      stayStore.set((s) => ({ ...s, rooms: { ...s.rooms, [roomId]: fn(s.rooms[roomId] ?? emptyRoom()) } })),
    [],
  );
  const resetStay = useCallback(() => stayStore.set(newStay()), []);

  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) => translate(settings.lang, key, vars),
    [settings.lang],
  );

  const rooms = useMemo(() => [...BUILTIN_ROOMS, ...stay.customRooms], [stay.customRooms]);
  const roomName = useCallback(
    (id: string) => {
      const r = rooms.find((x) => x.id === id);
      if (!r) return id;
      return r.labelKey ? t(r.labelKey) : (r.name ?? id);
    },
    [rooms, t],
  );

  const toast = useCallback((text: string, opts?: Omit<ToastMsg, "id" | "text">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const setTestVideo = useCallback((v: { url: string; name: string } | null) => {
    setTestVideoState((prev) => {
      if (prev && prev.url !== v?.url) URL.revokeObjectURL(prev.url);
      return v;
    });
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      settings,
      updateSettings,
      t,
      stay,
      updateStay,
      updateRoom,
      resetStay,
      rooms,
      roomName,
      view,
      navigate,
      toast,
      toasts,
      dismissToast,
      testVideo,
      setTestVideo,
    }),
    [settings, updateSettings, t, stay, updateStay, updateRoom, resetStay, rooms, roomName, view, navigate, toast, toasts, dismissToast, testVideo, setTestVideo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

/** Convenience: just the translator. */
export function useI18n() {
  const { t, settings } = useApp();
  return { t, lang: settings.lang };
}
