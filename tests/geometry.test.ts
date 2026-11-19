import { describe, expect, it } from "vitest";
import { coverMap, toFrame, toScreen, visibleFrameRect } from "@/lib/geometry";

describe("object-fit: cover mapping", () => {
  it("maps the frame centre to the element centre", () => {
    const m = coverMap(1280, 720, 390, 844);
    const p = toScreen(m, 0.5, 0.5);
    expect(p.x).toBeCloseTo(195);
    expect(p.y).toBeCloseTo(422);
  });
  it("round-trips screen ↔ frame, including mirroring", () => {
    for (const mirror of [false, true]) {
      const m = coverMap(1920, 1080, 390, 844, mirror);
      const s = toScreen(m, 0.47, 0.61);
      const f = toFrame(m, s.x, s.y);
      expect(f.x).toBeCloseTo(0.47);
      expect(f.y).toBeCloseTo(0.61);
    }
  });
  it("mirrors horizontally for the front camera", () => {
    const a = toScreen(coverMap(1280, 720, 390, 844, false), 0.45, 0.5);
    const b = toScreen(coverMap(1280, 720, 390, 844, true), 0.45, 0.5);
    expect(a.x + b.x).toBeCloseTo(390);
  });
  it("reports the visible (cropped) part of a landscape frame on a portrait screen", () => {
    const r = visibleFrameRect(coverMap(1280, 720, 390, 844));
    expect(r.y0).toBe(0);
    expect(r.y1).toBe(1);
    expect(r.x0).toBeGreaterThan(0.3);
    expect(r.x1).toBeLessThan(0.7);
  });
});
