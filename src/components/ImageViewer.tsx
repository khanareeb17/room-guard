"use client";
import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";

/** Full-screen photo viewer with pinch-zoom, pan and double-tap zoom. */
export function ImageViewer({
  src,
  alt,
  onClose,
  onDelete,
  closeLabel,
  deleteLabel,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onDelete?: () => void;
  closeLabel: string;
  deleteLabel: string;
}) {
  const [tf, setTf] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ s: number; x: number; y: number; d: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const snapshot = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, d };
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="safe-top absolute inset-x-0 top-0 z-10 flex justify-between p-2">
        {onDelete ? (
          <button type="button" onClick={onDelete} aria-label={deleteLabel} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/60 text-red-300">
            <Trash2 size={22} />
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} aria-label={closeLabel} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/60 text-white">
          <X size={24} />
        </button>
      </div>
      <div
        className="relative flex-1 touch-none overflow-hidden"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const s = snapshot();
          start.current = { ...tf, ...s };
          if (pointers.current.size === 1) {
            const now = Date.now();
            if (now - lastTap.current < 300) setTf((p) => (p.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
            lastTap.current = now;
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId) || !start.current) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const s = snapshot();
          const st = start.current;
          const scale = st.d > 0 && s.d > 0 ? Math.max(1, Math.min(8, (st.s * s.d) / st.d)) : st.s;
          setTf({ s: scale, x: st.x + (s.cx - st.cx), y: st.y + (s.cy - st.cy) });
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          start.current = pointers.current.size ? { ...tf, ...snapshot() } : null;
          if (tf.s <= 1.01) setTf({ s: 1, x: 0, y: 0 });
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          start.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full select-none"
          style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.s})`, transformOrigin: "center" }}
        />
      </div>
    </div>
  );
}
