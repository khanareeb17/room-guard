"use client";
import { useEffect } from "react";

interface WakeLockSentinelLike {
  release(): Promise<void>;
  released?: boolean;
}

/** Keeps the screen on while `active`. Re-acquires after the tab becomes visible. Silent if unsupported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wl = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinelLike> } })
      .wakeLock;
    if (!wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        sentinel = await wl.request("screen");
        if (stopped) sentinel.release().catch(() => {});
      } catch {
        /* unsupported / denied / low battery – ignore */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
