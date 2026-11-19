import type { VerifyOutcome, VerifySample } from "./types";

/**
 * Torch verification (§5.6).
 *
 * The controller pulses the torch off/on a few times while the pipeline
 * records the local contrast at the candidate's position each frame.
 * Real devices have unpredictable torch latency, so we don't trust the
 * requested state blindly: we infer the *actual* torch state from the
 * whole-frame brightness (2-means clustering). If the frame brightness does
 * not visibly change we fall back to the requested state, skipping the
 * first frames after each toggle.
 */

const median = (v: number[]) => {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
};

/** 1-D two-means on frame brightness. Returns per-sample "torch on" or null if not separable. */
export function measuredTorchStates(samples: VerifySample[]): boolean[] | null {
  if (samples.length < 4) return null;
  const vals = samples.map((s) => s.frameMean);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 3) return null;
  for (let iter = 0; iter < 12; iter++) {
    const mid = (lo + hi) / 2;
    const a = vals.filter((v) => v < mid);
    const b = vals.filter((v) => v >= mid);
    if (a.length === 0 || b.length === 0) return null;
    lo = a.reduce((x, y) => x + y, 0) / a.length;
    hi = b.reduce((x, y) => x + y, 0) / b.length;
  }
  const mid = (lo + hi) / 2;
  const states = vals.map((v) => v >= mid);
  const onCount = states.filter(Boolean).length;
  const sep = hi - lo;
  if (onCount < 2 || states.length - onCount < 2) return null;
  if (sep < Math.max(3, 0.08 * hi)) return null;
  // The measured "on" frames should mostly agree with what was requested,
  // otherwise the brightness change is from something else (auto-exposure).
  let agree = 0;
  for (let i = 0; i < samples.length; i++) if (states[i] === samples[i].requested) agree++;
  if (agree / samples.length < 0.55) return null;
  return states;
}

/** Requested state with latency compensation: drop the first `skip` frames after each change. */
function requestedStates(samples: VerifySample[], skip = 2): (boolean | null)[] {
  const out: (boolean | null)[] = [];
  let since = 0;
  for (let i = 0; i < samples.length; i++) {
    if (i > 0 && samples[i].requested !== samples[i - 1].requested) since = 0;
    out.push(since >= skip ? samples[i].requested : null);
    since++;
  }
  return out;
}

export function analyzeVerification(samples: VerifySample[]): VerifyOutcome {
  const measured = measuredTorchStates(samples);
  const states: (boolean | null)[] = measured ?? requestedStates(samples);
  const on: number[] = [];
  const off: number[] = [];
  samples.forEach((s, i) => {
    const st = states[i];
    if (st === true) on.push(s.contrast);
    else if (st === false) off.push(s.contrast);
  });
  const onContrast = median(on);
  const offContrast = median(off);
  const ratio = onContrast > 1e-6 ? offContrast / onContrast : 1;
  const base = { onContrast, offContrast, ratio, usedMeasuredState: measured !== null };
  if (on.length < 2 || off.length < 2) return { verdict: "inconclusive", ...base };
  if (onContrast < 25 && offContrast < 25) return { verdict: "inconclusive", ...base };
  // Spot much brighter with the torch off than on can't be a reflection.
  if (ratio <= 0.45 && onContrast >= 25) return { verdict: "reflection", ...base };
  if (ratio >= 0.7 && offContrast >= 30) {
    // Without a measurable torch change we can't be sure the torch ever went off.
    return { verdict: measured ? "light" : "inconclusive", ...base };
  }
  return { verdict: "inconclusive", ...base };
}

/**
 * Local peak / contrast at a point (pixel coords) in a luminance image.
 * Contrast = peak − mean of a ring around the search window.
 */
export function measureSpot(
  Y: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
): { peak: number; contrast: number } {
  const r = Math.max(3, Math.round(radius));
  const x0 = Math.max(0, Math.round(cx) - r);
  const x1 = Math.min(w - 1, Math.round(cx) + r);
  const y0 = Math.max(0, Math.round(cy) - r);
  const y1 = Math.min(h - 1, Math.round(cy) + r);
  let peak = 0;
  for (let y = y0; y <= y1; y++) {
    const off = y * w;
    for (let x = x0; x <= x1; x++) if (Y[off + x] > peak) peak = Y[off + x];
  }
  // Ring: 3 px band outside the window.
  const R = r + 3;
  let sum = 0;
  let cnt = 0;
  for (let y = Math.max(0, Math.round(cy) - R); y <= Math.min(h - 1, Math.round(cy) + R); y++) {
    const off = y * w;
    for (let x = Math.max(0, Math.round(cx) - R); x <= Math.min(w - 1, Math.round(cx) + R); x++) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      sum += Y[off + x];
      cnt++;
    }
  }
  const ring = cnt > 0 ? sum / cnt : 0;
  return { peak, contrast: Math.max(0, peak - ring) };
}
