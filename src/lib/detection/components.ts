import type { RawBlob } from "./types";

/**
 * 8-connected component labelling with an explicit stack (no recursion).
 * `labels` and `stack` are caller-owned scratch buffers of length ≥ w*h.
 * Components larger than `maxArea` are still fully consumed (so they are
 * not re-seeded) but are reported so the caller can reject them.
 * Stops after `maxBlobs` components (very bright / noisy scenes).
 */
export function labelComponents(
  mask: Uint8Array,
  rgba: Uint8ClampedArray | Uint8Array,
  Y: Uint8Array,
  w: number,
  h: number,
  labels: Int32Array,
  stack: Int32Array,
  maxBlobs = 256,
): RawBlob[] {
  const n = w * h;
  labels.fill(0, 0, n);
  const blobs: RawBlob[] = [];
  let label = 0;
  for (let seed = 0; seed < n; seed++) {
    if (mask[seed] === 0 || labels[seed] !== 0) continue;
    if (blobs.length >= maxBlobs) break;
    label++;
    let sp = 0;
    stack[sp++] = seed;
    labels[seed] = label;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let sumW = 0;
    let sumWX = 0;
    let sumWY = 0;
    let sumY = 0;
    let peak = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i - x) / w;
      const v = Y[i];
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const wt = v + 1;
      sumW += wt;
      sumWX += wt * x;
      sumWY += wt * y;
      sumY += v;
      if (v > peak) peak = v;
      const p = i << 2;
      sumR += rgba[p];
      sumG += rgba[p + 1];
      sumB += rgba[p + 2];
      // 8 neighbours
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const rowOff = ny * w;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const j = rowOff + nx;
          if (mask[j] !== 0 && labels[j] === 0) {
            labels[j] = label;
            stack[sp++] = j;
          }
        }
      }
    }
    blobs.push({
      area,
      minX,
      minY,
      maxX,
      maxY,
      cx: sumWX / sumW,
      cy: sumWY / sumW,
      peakY: peak,
      meanY: sumY / area,
      meanR: sumR / area,
      meanG: sumG / area,
      meanB: sumB / area,
      touchesEdge: minX <= 1 || minY <= 1 || maxX >= w - 2 || maxY >= h - 2,
    });
  }
  return blobs;
}
