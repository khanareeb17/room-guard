"use client";
import { useEffect, useRef, type MouseEvent } from "react";
import type { TrackView } from "@/lib/detection/types";
import { coverMap, toFrame, toScreen } from "@/lib/geometry";
import { drawMarkers, type MarkerLabels, type SmoothPos } from "./DetectionOverlay";

export interface DigitalZoom {
  scale: number;
  /** transform origin in element CSS px */
  ox: number;
  oy: number;
}

interface Props {
  setVideo: (el: HTMLVideoElement | null) => void;
  video: HTMLVideoElement | null;
  mirror: boolean;
  fileUrl?: string | null;
  getTracks: () => TrackView[];
  getVerifyingId: () => number | null;
  mode: "lens" | "ir";
  debug: boolean;
  labels: MarkerLabels;
  digitalZoom: DigitalZoom | null;
  onTapTrack: (id: number) => void;
  onTapEmpty: (p: { nx: number; ny: number; sx: number; sy: number }) => void;
}

/**
 * Full-screen <video> (object-fit: cover) with an overlay canvas mapped
 * through the same cover transform. Markers are drawn every animation frame
 * and lerp toward the latest detections for smooth tracking.
 */
export function CameraStage({
  setVideo,
  video,
  mirror,
  fileUrl,
  getTracks,
  getVerifyingId,
  mode,
  debug,
  labels,
  digitalZoom,
  onTapTrack,
  onTapEmpty,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smooth = useRef(new Map<number, SmoothPos>());
  const labelsRef = useRef(labels);
  const optsRef = useRef({ mirror, mode, debug });

  useEffect(() => {
    labelsRef.current = labels;
    optsRef.current = { mirror, mode, debug };
  }, [labels, mirror, mode, debug]);

  // Resize canvas to the element size × devicePixelRatio.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  // Draw loop.
  useEffect(() => {
    let raf = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !wrap) return;
      const dpr = canvas.width / Math.max(1, wrap.clientWidth);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!video || !video.videoWidth) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { mirror: mir, mode: md, debug: dbg } = optsRef.current;
      const map = coverMap(video.videoWidth, video.videoHeight, wrap.clientWidth, wrap.clientHeight, mir);
      drawMarkers(ctx, map, getTracks(), smooth.current, {
        mode: md,
        debug: dbg,
        labels: labelsRef.current,
        now,
        reducedMotion: reduced,
        verifyingId: getVerifyingId(),
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [video, getTracks, getVerifyingId]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap || !video?.videoWidth) return;
    const rect = wrap.getBoundingClientRect();
    let sx = e.clientX - rect.left;
    let sy = e.clientY - rect.top;
    // Undo the digital zoom transform (scale around ox, oy).
    if (digitalZoom) {
      sx = digitalZoom.ox + (sx - digitalZoom.ox) / digitalZoom.scale;
      sy = digitalZoom.oy + (sy - digitalZoom.oy) / digitalZoom.scale;
    }
    const map = coverMap(video.videoWidth, video.videoHeight, wrap.clientWidth, wrap.clientHeight, mirror);
    let best: { id: number; d: number } | null = null;
    for (const t of getTracks()) {
      if (t.confidence === "none" || (t.confidence === "low" && !debug)) continue;
      const p = smooth.current.get(t.id) ?? toScreen(map, t.x, t.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < 64 && (!best || d < best.d)) best = { id: t.id, d };
    }
    if (best) onTapTrack(best.id);
    else {
      const f = toFrame(map, sx, sy);
      onTapEmpty({ nx: f.x, ny: f.y, sx, sy });
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" onClick={onClick}>
      <div
        ref={wrapRef}
        className="absolute inset-0 transition-transform duration-200"
        style={
          digitalZoom
            ? {
                transform: `scale(${digitalZoom.scale})`,
                transformOrigin: `${digitalZoom.ox}px ${digitalZoom.oy}px`,
              }
            : undefined
        }
      >
        <video
          ref={setVideo}
          playsInline
          muted
          autoPlay
          loop={!!fileUrl}
          src={fileUrl ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          style={mirror ? { transform: "scaleX(-1)" } : undefined}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      </div>
    </div>
  );
}
