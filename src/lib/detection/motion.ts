/**
 * Cheap global camera-motion estimate from 1-D projection profiles
 * (mean luminance per column / per row). We find the shift that best aligns
 * the current profile with the previous one (mean-removed SAD), with a
 * parabolic sub-pixel refinement. Works for pans/tilts; reports low
 * confidence for flat or noisy scenes so the caller can fall back to the
 * median motion of tracked blobs.
 */

export interface ShiftEstimate {
  /** Content moved by +shift pixels (cur[i] ≈ prev[i - shift]). */
  shift: number;
  confidence: number;
}

function meanStd(p: Float32Array, n: number): { mean: number; std: number } {
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    s += p[i];
    s2 += p[i] * p[i];
  }
  const mean = s / n;
  return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
}

export function estimateShift(
  prev: Float32Array,
  cur: Float32Array,
  n: number,
  maxShift: number,
  costs?: Float32Array,
): ShiftEstimate {
  const a = meanStd(prev, n);
  const b = meanStd(cur, n);
  if (a.std < 1.5 || b.std < 1.5 || n < 16) return { shift: 0, confidence: 0 };
  const S = Math.min(maxShift, Math.floor(n / 4));
  const c = costs && costs.length >= 2 * S + 1 ? costs : new Float32Array(2 * S + 1);
  let best = 0;
  let bestCost = Infinity;
  let total = 0;
  for (let s = -S; s <= S; s++) {
    const lo = Math.max(0, s);
    const hi = Math.min(n, n + s);
    let cost = 0;
    for (let i = lo; i < hi; i++) {
      const d = cur[i] - b.mean - (prev[i - s] - a.mean);
      cost += d < 0 ? -d : d;
    }
    cost /= hi - lo;
    c[s + S] = cost;
    total += cost;
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
    }
  }
  const meanCost = total / (2 * S + 1);
  let shift = best;
  if (best > -S && best < S) {
    const l = c[best - 1 + S];
    const r = c[best + 1 + S];
    const denom = l - 2 * bestCost + r;
    if (denom > 1e-6) shift = best + (0.5 * (l - r)) / denom;
  }
  const confidence = meanCost > 1e-6 ? Math.max(0, Math.min(1, (meanCost - bestCost) / meanCost)) : 0;
  return { shift, confidence };
}
