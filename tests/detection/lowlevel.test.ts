import { describe, expect, it } from "vitest";
import { buildIntegral, boxMean } from "@/lib/detection/integralImage";
import { computeLuminance, rgbToHueSat } from "@/lib/detection/luminance";
import { labelComponents } from "@/lib/detection/components";
import { estimateShift } from "@/lib/detection/motion";
import { H, W, darkBg, drawDot, makeFrame, rng, texture } from "./helpers";

describe("integral image", () => {
  it("computes box means", () => {
    const w = 5;
    const h = 4;
    const src = new Uint8Array(w * h).map((_, i) => i);
    const ii = new Uint32Array((w + 1) * (h + 1));
    buildIntegral(src, w, h, ii);
    // rows 1..2, cols 1..3 → values 6,7,8,11,12,13 → mean 9.5
    expect(boxMean(ii, w, h, 1, 1, 3, 2)).toBeCloseTo(9.5);
    expect(boxMean(ii, w, h, -5, -5, 100, 100)).toBeCloseTo(9.5);
  });
});

describe("luminance", () => {
  it("matches the Rec.601 weights", () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const out = new Uint8Array(4);
    computeLuminance(px, 4, 1, out);
    expect(out[0]).toBeCloseTo(76, -1);
    expect(out[1]).toBeCloseTo(149, -1);
    expect(out[2]).toBeCloseTo(29, -1);
    expect(out[3]).toBeGreaterThanOrEqual(254);
  });
  it("hue/sat", () => {
    expect(rgbToHueSat(200, 100, 255).hue).toBeGreaterThan(260);
    expect(rgbToHueSat(200, 200, 200).sat).toBe(0);
  });
});

describe("connected components", () => {
  it("labels 8-connected blobs without recursion", () => {
    const w = 6;
    const h = 5;
    const mask = new Uint8Array(w * h);
    // diagonal pair (8-connected) + separate single pixel
    mask[1 * w + 1] = 1;
    mask[2 * w + 2] = 1;
    mask[3 * w + 4] = 1;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
    const Y = new Uint8Array(w * h).fill(255);
    const blobs = labelComponents(mask, rgba, Y, w, h, new Int32Array(w * h), new Int32Array(w * h));
    expect(blobs.length).toBe(2);
    expect(blobs[0].area).toBe(2);
    expect(blobs[1].area).toBe(1);
  });
  it("handles a huge component without stack overflow", () => {
    const w = 400;
    const h = 300;
    const mask = new Uint8Array(w * h).fill(1);
    const rgba = new Uint8ClampedArray(w * h * 4);
    const Y = new Uint8Array(w * h);
    const blobs = labelComponents(mask, rgba, Y, w, h, new Int32Array(w * h), new Int32Array(w * h));
    expect(blobs.length).toBe(1);
    expect(blobs[0].area).toBe(w * h);
  });
});

describe("global motion", () => {
  it("recovers a horizontal pan from column profiles", () => {
    const r = rng(1);
    const Y = new Uint8Array(W * H);
    const col0 = new Float32Array(W);
    const col1 = new Float32Array(W);
    computeLuminance(makeFrame(texture(0, 0), r, 3), W, H, Y, col0);
    computeLuminance(makeFrame(texture(5, 0), r, 3), W, H, Y, col1);
    const est = estimateShift(col0, col1, W, 30);
    expect(est.shift).toBeCloseTo(5, 0);
    expect(est.confidence).toBeGreaterThan(0.3);
  });
  it("reports low confidence on a flat noisy frame", () => {
    const r = rng(2);
    const Y = new Uint8Array(W * H);
    const col0 = new Float32Array(W);
    const col1 = new Float32Array(W);
    const f0 = makeFrame(darkBg, r);
    drawDot(f0, 100, 100, 2);
    computeLuminance(f0, W, H, Y, col0);
    computeLuminance(makeFrame(darkBg, r), W, H, Y, col1);
    expect(estimateShift(col0, col1, W, 30).confidence).toBe(0);
  });
});
