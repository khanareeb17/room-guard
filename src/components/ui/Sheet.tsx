"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Accessible bottom sheet (modal dialog). Escape / backdrop closes. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel = "Close",
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
  tall?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`safe-bottom relative w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pt-3 shadow-2xl outline-none ${tall ? "max-h-[92dvh]" : "max-h-[85dvh]"}`}
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-surface-3" aria-hidden />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-white/5"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
