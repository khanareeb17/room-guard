"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during SSR / hydration, true afterwards. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function subscribeVisibility(fn: () => void) {
  document.addEventListener("visibilitychange", fn);
  return () => document.removeEventListener("visibilitychange", fn);
}

/** document.visibilityState === "visible" */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}
