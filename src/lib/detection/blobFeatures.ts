import { boxSum } from "./integralImage";
import { rgbToHueSat } from "./luminance";
import type { BlobFeatures, RawBlob } from "./types";

/**
 * Derives shape, colour and surround features for a raw blob.
 * Surround darkness = mean Y in a ring around the bbox (ring width scales
 * with blob size, min 2 px), computed from the integral image.
 */
export function computeFeatures(blob: RawBlob, integral: Uint32Array, w: number, h: number): BlobFeatures {
  const width = blob.maxX - blob.minX + 1;
  const height = blob.maxY - blob.minY + 1;
  const fill = blob.area / (width * height);
  const aspect = width / height;
  const { hue, sat } = rgbToHueSat(blob.meanR, blob.meanG, blob.meanB);

  const pad = Math.max(2, Math.ceil(Math.max(width, height) * 0.75));
  const outer = boxSum(integral, w, h, blob.minX - pad, blob.minY - pad, blob.maxX + pad, blob.maxY + pad);
  // Inner box includes a 1px halo so the blob's own blur doesn't brighten the ring.
  const inner = boxSum(integral, w, h, blob.minX - 1, blob.minY - 1, blob.maxX + 1, blob.maxY + 1);
  const ringCount = outer.count - inner.count;
  const surroundY = ringCount > 0 ? (outer.sum - inner.sum) / ringCount : blob.meanY;

  return {
    ...blob,
    width,
    height,
    fill,
    aspect,
    hue,
    sat,
    surroundY,
    contrast: blob.peakY - surroundY,
  };
}
