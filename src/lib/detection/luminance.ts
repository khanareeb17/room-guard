/**
 * Luminance conversion: Y = 0.299R + 0.587G + 0.114B, using a fixed-point
 * approximation (77, 150, 29) / 256 to stay in integer math.
 */

export interface LuminanceStats {
  mean: number;
  std: number;
  brightFraction: number;
}

/**
 * Fills `out` (length ≥ w*h) with luminance values and optional column / row
 * profiles (mean Y per column / row, used for cheap global-motion estimation).
 */
export function computeLuminance(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  out: Uint8Array,
  colProfile?: Float32Array,
  rowProfile?: Float32Array,
): LuminanceStats {
  const n = w * h;
  let sum = 0;
  let sumSq = 0;
  let bright = 0;
  if (colProfile) colProfile.fill(0, 0, w);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const i = rowOff + x;
      const p = i << 2;
      const v = (77 * rgba[p] + 150 * rgba[p + 1] + 29 * rgba[p + 2]) >> 8;
      out[i] = v;
      rowSum += v;
      sumSq += v * v;
      if (v >= 245) bright++;
      if (colProfile) colProfile[x] += v;
    }
    sum += rowSum;
    if (rowProfile) rowProfile[y] = rowSum / w;
  }
  if (colProfile) for (let x = 0; x < w; x++) colProfile[x] /= h;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean, std: Math.sqrt(variance), brightFraction: bright / n };
}

/** RGB (0–255) → hue (deg) and saturation (0–1), HSV model. */
export function rgbToHueSat(r: number, g: number, b: number): { hue: number; sat: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, sat };
}
