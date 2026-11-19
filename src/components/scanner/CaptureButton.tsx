"use client";

export function CaptureButton({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={busy}
      className="relative inline-flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/90 bg-white/15 backdrop-blur transition-transform active:scale-95 disabled:opacity-60"
    >
      <span className={`h-14 w-14 rounded-full bg-white ${busy ? "animate-pulse" : ""}`} />
    </button>
  );
}
