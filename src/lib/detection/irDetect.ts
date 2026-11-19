import { maxAreaFor } from "./scoring";
import type { BlobFeatures, Thresholds } from "./types";

/**
 * IR night-vision LED detection (§7). Phone cameras usually render 850 nm
 * IR LEDs as white, purple or magenta dots. Ordinary indicator LEDs
 * (green, amber, saturated blue) are de-prioritised but not ignored.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Frame is dark enough for a meaningful IR scan. */
export function isDarkEnoughForIr(frameMean: number): boolean {
  return frameMean < 70;
}

/** 0–1: how IR-like the blob colour is. 0 = clearly a normal coloured LED. */
export function irColourScore(b: Pick<BlobFeatures, "hue" | "sat" | "meanR" | "meanG" | "meanB">): number {
  const { hue, sat } = b;
  if (sat < 0.18) return 0.65; // white / near-white (IR often clips to white)
  if (hue >= 250 && hue <= 340) return 1; // purple / magenta
  if (hue > 340 || hue < 15) return 0.55; // reddish-pink
  if (hue >= 200 && hue < 250) return 0.35; // bluish – could be either
  if (sat > 0.35 && hue >= 40 && hue < 200) return 0; // green / yellow / cyan LED
  return 0.25;
}

export type IrRejectReason = "too-big" | "noise" | "shape" | "edge" | "low-contrast" | "colour" | null;

export function rejectIrBlob(b: BlobFeatures, w: number, h: number, t: Thresholds): IrRejectReason {
  if (b.area > maxAreaFor(w, h, 1) * 1.5) return "too-big";
  if (b.area <= 0 || (b.area === 1 && b.peakY < 200)) return "noise";
  if (b.touchesEdge) return "edge";
  if (b.area >= 3 && (b.aspect < 0.4 || b.aspect > 2.5 || b.fill < 0.35)) return "shape";
  if (b.contrast < t.contrast * 0.6) return "low-contrast";
  if (irColourScore(b) === 0) return "colour";
  return null;
}

export function scoreIrBlob(b: BlobFeatures, w: number, h: number): number {
  const maxArea = maxAreaFor(w, h, 1) * 1.5;
  const size = b.area <= maxArea * 0.3 ? 1 : clamp01(1 - (b.area - maxArea * 0.3) / (maxArea * 0.7));
  const peak = clamp01((b.peakY - 110) / 110);
  const contrast = clamp01((b.contrast - 25) / 120);
  const dark = clamp01(1 - b.surroundY / 110);
  const a = b.aspect > 1 ? 1 / b.aspect : b.aspect;
  const round = b.area < 3 ? 0.85 : clamp01(0.5 * a + 0.5 * clamp01(b.fill / 0.785));
  const colour = irColourScore(b);
  return clamp01(0.1 * size + 0.15 * peak + 0.2 * contrast + 0.1 * round + 0.15 * dark + 0.3 * colour);
}
