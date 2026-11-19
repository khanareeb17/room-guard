/** Synthetic frame helpers for detection tests. */

export const W = 480;
export const H = 270;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Frame = Uint8ClampedArray;

/** Grey frame from a background function plus uniform noise of ±noise. */
export function makeFrame(
  bg: (x: number, y: number) => number,
  random: () => number,
  noise = 8,
  w = W,
  h = H,
): Frame {
  const f = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = bg(x, y) + (random() * 2 - 1) * noise;
      const p = (y * w + x) * 4;
      f[p] = f[p + 1] = f[p + 2] = v;
      f[p + 3] = 255;
    }
  }
  return f;
}

/** Soft round dot (anti-aliased edge), blended over the frame. */
export function drawDot(
  f: Frame,
  cx: number,
  cy: number,
  r: number,
  rgb: [number, number, number] = [255, 255, 255],
  w = W,
): void {
  const R = Math.ceil(r + 1);
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const d = Math.hypot(x - cx, y - cy);
      const a = Math.max(0, Math.min(1, r + 0.5 - d));
      if (a <= 0) continue;
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) f[p + c] = f[p + c] * (1 - a) + rgb[c] * a;
    }
  }
}

export function fillRect(f: Frame, x0: number, y0: number, rw: number, rh: number, v: number, w = W): void {
  for (let y = y0; y < y0 + rh; y++)
    for (let x = x0; x < x0 + rw; x++) {
      const p = (y * w + x) * 4;
      f[p] = f[p + 1] = f[p + 2] = v;
    }
}

export const darkBg = () => 30;

/** Smooth, non-periodic-ish texture so projection-based motion estimation works. */
export function texture(ox: number, oy: number) {
  return (x: number, y: number) => {
    const X = x - ox;
    const Y = y - oy;
    return (
      45 +
      14 * Math.sin(0.05 * X) +
      9 * Math.sin(0.131 * X + 1) +
      6 * Math.sin(0.0213 * X + 2) +
      12 * Math.sin(0.043 * Y) +
      8 * Math.sin(0.117 * Y + 2) +
      5 * Math.sin(0.029 * Y + 0.5)
    );
  };
}
