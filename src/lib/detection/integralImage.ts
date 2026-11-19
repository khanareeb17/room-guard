/**
 * Summed-area table for O(1) box sums.
 * Layout: (w+1) × (h+1), row 0 and column 0 are zero.
 * Uint32 is enough: 640×480×255 ≈ 78M < 2³².
 */

export function buildIntegral(src: Uint8Array, w: number, h: number, out: Uint32Array): void {
  const W = w + 1;
  for (let x = 0; x <= w; x++) out[x] = 0;
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    const srcOff = (y - 1) * w;
    const outOff = y * W;
    const prevOff = (y - 1) * W;
    out[outOff] = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += src[srcOff + x - 1];
      out[outOff + x] = out[prevOff + x] + rowSum;
    }
  }
}

/** Sum over the inclusive pixel rectangle [x0..x1] × [y0..y1] (clamped). */
export function boxSum(
  integral: Uint32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { sum: number; count: number } {
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > w - 1) x1 = w - 1;
  if (y1 > h - 1) y1 = h - 1;
  if (x1 < x0 || y1 < y0) return { sum: 0, count: 0 };
  const W = w + 1;
  const a = integral[y0 * W + x0];
  const b = integral[y0 * W + x1 + 1];
  const c = integral[(y1 + 1) * W + x0];
  const d = integral[(y1 + 1) * W + x1 + 1];
  return { sum: d - b - c + a, count: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

/** Mean over the inclusive rectangle (clamped). Returns 0 for empty boxes. */
export function boxMean(
  integral: Uint32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const { sum, count } = boxSum(integral, w, h, x0, y0, x1, y1);
  return count > 0 ? sum / count : 0;
}
