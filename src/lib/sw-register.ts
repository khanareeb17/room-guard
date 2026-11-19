/** Registers the offline service worker in production only and warms its cache. */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      // Tell the worker which same-origin assets this page loaded so they're cached for offline use.
      const urls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin));
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: "CACHE_URLS", urls: [...urls, location.href.split("#")[0]] });
      // Warm the detector worker chunk so Lens Scan works offline even before first use.
      try {
        const w = new Worker(new URL("../workers/detector.worker.ts", import.meta.url), { type: "module" });
        setTimeout(() => w.terminate(), 3000);
      } catch {
        /* ignore */
      }
    } catch {
      /* SW not available (private mode etc.) */
    }
  };
  if (document.readyState === "complete") void go();
  else window.addEventListener("load", () => void go(), { once: true });
}
