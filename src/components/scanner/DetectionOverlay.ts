import type { TrackView } from "@/lib/detection/types";
import { toScreen, type CoverMap } from "@/lib/geometry";
import { markerColour } from "@/lib/capture";

export interface MarkerLabels {
  possible: string;
  likely: string;
  light: string;
  ir: string;
  safe: string;
}

export interface SmoothPos {
  x: number;
  y: number;
  r: number;
  seen: number;
}

/** Text shown next to a marker, or null if the track shouldn't be drawn. */
export function markerLabel(t: TrackView, mode: "lens" | "ir", labels: MarkerLabels, debug = false): string | null {
  if (t.safe) return t.confidence === "possible" || t.confidence === "likely" ? labels.safe : null;
  if (mode === "lens" && t.verdict === "light" && t.confidence !== "none") return labels.light;
  if (mode === "ir" && (t.confidence === "possible" || t.confidence === "likely")) return labels.ir;
  if (t.confidence === "likely" || (t.verdict === "reflection" && t.confidence !== "none")) return labels.likely;
  if (t.confidence === "possible") return labels.possible;
  if (debug && t.confidence === "low") return "low";
  return null;
}

/**
 * Draws markers with shape + colour + text (accessible, not colour-only):
 *  - Possible: amber dashed ring
 *  - Likely:   red solid double ring, pulsing
 *  - Light:    blue rounded square
 *  - Safe:     small grey ring
 */
export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  map: CoverMap,
  tracks: TrackView[],
  smooth: Map<number, SmoothPos>,
  o: {
    mode: "lens" | "ir";
    debug: boolean;
    labels: MarkerLabels;
    now: number;
    reducedMotion: boolean;
    verifyingId: number | null;
  },
) {
  const alive = new Set<number>();
  for (const t of tracks) {
    const label = markerLabel(t, o.mode, o.labels, o.debug);
    if (!label) continue;
    alive.add(t.id);
    const target = toScreen(map, t.x, t.y);
    const tr = Math.max(18, t.r * map.dispW * 3.2);
    let s = smooth.get(t.id);
    if (!s) {
      s = { x: target.x, y: target.y, r: tr, seen: o.now };
      smooth.set(t.id, s);
    } else {
      s.x += (target.x - s.x) * 0.35;
      s.y += (target.y - s.y) * 0.35;
      s.r += (tr - s.r) * 0.2;
      s.seen = o.now;
    }
    const col = markerColour(t, o.mode);
    const isLight = o.mode === "lens" && t.verdict === "light";
    const isLikely = !t.safe && !isLight && (t.confidence === "likely" || t.verdict === "reflection");
    const r = t.safe ? 12 : s.r;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.strokeStyle = col;
    ctx.lineWidth = isLikely ? 3.5 : 2.5;
    if (isLight) {
      const side = r * 1.7;
      ctx.beginPath();
      ctx.roundRect(s.x - side / 2, s.y - side / 2, side, side, 6);
      ctx.stroke();
    } else if (isLikely) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      const phase = o.reducedMotion ? 0.5 : (Math.sin(o.now / 180) + 1) / 2;
      ctx.globalAlpha = 0.9 - phase * 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 6 + phase * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.setLineDash(t.safe ? [2, 3] : [7, 5]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Centre dot
    if (!t.safe) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Verifying spinner
    if (o.verifyingId === t.id) {
      const a = (o.now / 120) % (Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 14, a, a + Math.PI * 0.6);
      ctx.stroke();
    }
    // Label pill
    ctx.shadowBlur = 0;
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    const text = o.debug ? `${label} ${(t.value * 100).toFixed(0)}` : label;
    const tw = ctx.measureText(text).width;
    const px = s.x;
    const py = Math.max(14, s.y - r - 16);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(px - tw / 2 - 8, py - 11, tw + 16, 22, 11);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, px, py + 0.5);
    ctx.restore();
  }
  for (const [id, s] of smooth) if (!alive.has(id) && o.now - s.seen > 400) smooth.delete(id);
}
