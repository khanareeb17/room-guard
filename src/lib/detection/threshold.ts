import type { DetectMode, Sensitivity, Thresholds } from "./types";

const LENS: Record<Sensitivity, Thresholds> = {
  low: { abs: 240, contrast: 80, k: 4 },
  normal: { abs: 225, contrast: 60, k: 3 },
  high: { abs: 205, contrast: 42, k: 2.5 },
};

// IR LEDs seen through a phone camera in a dark room are often not saturated.
const IR: Record<Sensitivity, Thresholds> = {
  low: { abs: 190, contrast: 70, k: 4 },
  normal: { abs: 160, contrast: 50, k: 3 },
  high: { abs: 130, contrast: 35, k: 2.5 },
};

export function thresholdsFor(sensitivity: Sensitivity, mode: DetectMode = "lens"): Thresholds {
  return (mode === "ir" ? IR : LENS)[sensitivity];
}

/** Box radius for the local background mean: 7 px (15×15) at 480 px width. */
export function localRadiusFor(width: number): number {
  return Math.max(4, Math.round((7 * width) / 480));
}

/**
 * Builds the candidate mask. Cheap tests first (absolute + global), the
 * O(1) box mean only for survivors. Returns the number of candidate pixels.
 * Edge pixels are kept; blobs touching the frame edge are rejected later.
 */
export function buildMask(
  Y: Uint8Array,
  integral: Uint32Array,
  w: number,
  h: number,
  radius: number,
  t: Thresholds,
  frameMean: number,
  frameStd: number,
  mask: Uint8Array,
): number {
  const globalFloor = frameMean + t.k * frameStd;
  const floor = Math.max(t.abs, Math.min(254, globalFloor));
  const W = w + 1;
  let count = 0;
  mask.fill(0, 0, w * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    let y0 = y - radius;
    let y1 = y + radius;
    if (y0 < 0) y0 = 0;
    if (y1 > h - 1) y1 = h - 1;
    const top = y0 * W;
    const bot = (y1 + 1) * W;
    const rows = y1 - y0 + 1;
    for (let x = 0; x < w; x++) {
      const v = Y[rowOff + x];
      if (v < floor) continue;
      let x0 = x - radius;
      let x1 = x + radius;
      if (x0 < 0) x0 = 0;
      if (x1 > w - 1) x1 = w - 1;
      const sum = integral[bot + x1 + 1] - integral[top + x1 + 1] - integral[bot + x0] + integral[top + x0];
      const localMean = sum / ((x1 - x0 + 1) * rows);
      if (v - localMean >= t.contrast) {
        mask[rowOff + x] = 1;
        count++;
      }
    }
  }
  return count;
}
