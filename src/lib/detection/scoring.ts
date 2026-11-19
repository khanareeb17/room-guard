import type { BlobFeatures, Thresholds } from "./types";

export type RejectReason = "too-big" | "noise" | "shape" | "edge" | "low-contrast" | null;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Max blob area: 0.12 % of the frame at processing resolution, loosened with zoom. */
export function maxAreaFor(w: number, h: number, zoom = 1): number {
  const z = Math.max(1, Math.min(zoom, 4));
  return Math.max(12, w * h * 0.0012 * Math.min(z * z, 8));
}

/** Hard per-frame filters (§5.4). */
export function rejectBlob(b: BlobFeatures, w: number, h: number, zoom: number, t: Thresholds): RejectReason {
  if (b.area > maxAreaFor(w, h, zoom)) return "too-big";
  if (b.area <= 0 || (b.area === 1 && b.peakY < 245)) return "noise";
  if (b.touchesEdge) return "edge";
  // Shape tests need a few pixels to be meaningful.
  if (b.area >= 3) {
    if (b.aspect < 0.4 || b.aspect > 2.5) return "shape";
    if (b.fill < 0.35) return "shape";
  }
  if (b.contrast < t.contrast * 0.6) return "low-contrast";
  return null;
}

/**
 * Per-frame lens-likeness score 0–1: small & compact, very high peak, high
 * contrast vs a dark surround, near-circular, small tint bonus.
 */
export function scoreLensBlob(b: BlobFeatures, w: number, h: number, zoom = 1): number {
  const maxArea = maxAreaFor(w, h, zoom);
  // Small: ideal 2–40 px (at 480 px width), fading to 0 at maxArea.
  const ideal = Math.max(8, maxArea * 0.25);
  const size = b.area <= ideal ? 1 : clamp01(1 - (b.area - ideal) / (maxArea - ideal));
  const peak = clamp01((b.peakY - 190) / 60);
  const contrast = clamp01((b.contrast - 30) / 150);
  const dark = clamp01(1 - b.surroundY / 170);
  const a = b.aspect > 1 ? 1 / b.aspect : b.aspect;
  const round = b.area < 3 ? 0.85 : clamp01(0.5 * a + 0.5 * clamp01(b.fill / 0.785));
  const tint = b.sat > 0.12 && b.sat < 0.7 ? 0.05 : 0;
  return clamp01(0.15 * size + 0.2 * peak + 0.3 * contrast + 0.2 * round + 0.15 * dark + tint);
}
