"use client";
import { useCallback, useSyncExternalStore } from "react";

export const VIEWS = ["home", "scan", "ir", "checklist", "mirror", "found", "report", "limits", "settings"] as const;
export type View = (typeof VIEWS)[number];

function parse(hash: string): View {
  const v = hash.replace(/^#\/?/, "").split(/[?&/]/)[0];
  return (VIEWS as readonly string[]).includes(v) ? (v as View) : "home";
}

function subscribe(fn: () => void) {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}

/**
 * Current view from the URL hash. Navigating pushes a history entry, so the
 * Android back button / browser back moves between views.
 */
export function useHashView(): [View, (v: View, opts?: { replace?: boolean }) => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => parse(window.location.hash),
    () => "home" as View,
  );
  const navigate = useCallback((v: View, opts?: { replace?: boolean }) => {
    const hash = v === "home" ? "" : `#${v}`;
    if (opts?.replace) {
      history.replaceState(null, "", hash || window.location.pathname);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else if (v === "home" && window.location.hash) {
      // Going home: prefer history back so we don't stack entries.
      if (history.length > 1) history.back();
      else {
        history.replaceState(null, "", window.location.pathname);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    } else if (hash) {
      window.location.hash = hash;
    }
    window.scrollTo({ top: 0 });
  }, []);
  return [view, navigate];
}
