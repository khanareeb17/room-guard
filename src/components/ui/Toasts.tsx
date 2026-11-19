"use client";
import { useApp } from "@/components/AppProvider";

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm shadow-xl backdrop-blur ${
            t.tone === "error" ? "border-danger/50 bg-red-950/90" : "border-line bg-surface/95"
          }`}
        >
          {t.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.thumb} alt="" className="h-10 w-14 rounded-lg object-cover" />
          )}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
