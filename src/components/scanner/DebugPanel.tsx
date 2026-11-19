"use client";
import { useEffect, useRef, useState } from "react";
import type { DetectorController, DetectorSnapshot } from "@/hooks/useDetector";
import type { ExtCaps } from "@/hooks/useCameraControls";

/** Debug overlay: fps, timing, resolution, capabilities, live mask, tracks. */
export function DebugPanel({
  snap,
  ctrl,
  caps,
  cameraLabel,
}: {
  snap: DetectorSnapshot;
  ctrl: DetectorController;
  caps: ExtCaps;
  cameraLabel: string;
}) {
  const [open, setOpen] = useState(true);
  const maskRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let img: ImageData | null = null;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const m = ctrl.mask;
      const c = maskRef.current;
      if (!m || !c) return;
      if (c.width !== m.w || c.height !== m.h) {
        c.width = m.w;
        c.height = m.h;
        img = null;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      if (!img) img = ctx.createImageData(m.w, m.h);
      const d = img.data;
      for (let i = 0, n = m.w * m.h; i < n; i++) {
        const v = m.data[i] ? 255 : 0;
        const p = i << 2;
        d[p] = v;
        d[p + 1] = v ? 80 : 0;
        d[p + 2] = v ? 80 : 0;
        d[p + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, ctrl]);

  const s = snap.stats;
  const capList = [
    caps.torch ? "torch" : null,
    caps.zoom ? `zoom ${caps.zoom.min}-${caps.zoom.max}` : null,
    caps.exposureCompensation ? `ec ${caps.exposureCompensation.min}..${caps.exposureCompensation.max}` : null,
    caps.exposureMode?.includes("manual") ? "manualExp" : null,
    caps.focusMode?.join("/") || null,
  ].filter(Boolean);

  return (
    <div className="pointer-events-auto absolute left-2 top-52 z-30 max-w-[62vw] rounded-xl bg-black/75 p-2 font-mono text-[10px] leading-tight text-lime-300">
      <button type="button" className="mb-1 min-h-6 text-xs text-white underline" onClick={() => setOpen(!open)}>
        Debug {open ? "▾" : "▸"}
      </button>
      {open && (
        <>
          <div>
            FPS {snap.fps.toFixed(1)} · proc {s?.procMs.toFixed(1) ?? "-"}ms · {snap.pipelineMode}
          </div>
          <div>
            res {s ? `${s.width}×${s.height}` : "-"} (target {snap.procWidth}) · mean {s?.mean.toFixed(0) ?? "-"} σ {s?.std.toFixed(0) ?? "-"}
          </div>
          <div>
            cand px {s?.candidatePixels ?? 0} · blobs {s?.acceptedBlobs ?? 0}/{s?.blobCount ?? 0} · bright {((s?.brightFraction ?? 0) * 100).toFixed(1)}%
          </div>
          <div>
            motion {((s?.motionX ?? 0) * 1000).toFixed(1)},{((s?.motionY ?? 0) * 1000).toFixed(1)} ‰w
          </div>
          <div className="truncate">cam: {cameraLabel || "-"}</div>
          <div className="truncate">caps: {capList.join(", ") || "none"}</div>
          <canvas ref={maskRef} className="my-1 w-40 border border-white/30 bg-black" aria-label="mask" />
          <div className="max-h-28 overflow-y-auto">
            {snap.tracks.slice(0, 12).map((t) => (
              <div key={t.id}>
                #{t.id} {t.confidence[0]} v{(t.value * 100).toFixed(0)} b{(t.blobScore * 100).toFixed(0)} h{t.hits} cv
                {t.brightnessCv.toFixed(2)} d{(t.drift * 1000).toFixed(1)} {t.verdict !== "unverified" ? t.verdict : ""}
                {t.safe ? " safe" : ""}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
