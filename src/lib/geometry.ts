/**
 * Mapping between normalised frame coordinates (0–1 of the video frame) and
 * element pixels for a <video> displayed with `object-fit: cover`.
 */
export interface CoverMap {
  scale: number;
  offX: number;
  offY: number;
  dispW: number;
  dispH: number;
  mirror: boolean;
  cw: number;
  ch: number;
}

export function coverMap(vw: number, vh: number, cw: number, ch: number, mirror = false): CoverMap {
  const scale = vw > 0 && vh > 0 ? Math.max(cw / vw, ch / vh) : 1;
  const dispW = vw * scale;
  const dispH = vh * scale;
  return { scale, offX: (cw - dispW) / 2, offY: (ch - dispH) / 2, dispW, dispH, mirror, cw, ch };
}

/** Normalised frame point → element CSS pixels. Handles front-camera mirroring. */
export function toScreen(m: CoverMap, nx: number, ny: number): { x: number; y: number } {
  const x = m.offX + nx * m.dispW;
  return { x: m.mirror ? m.cw - x : x, y: m.offY + ny * m.dispH };
}

/** Element CSS pixels → normalised frame point (inverse of toScreen). */
export function toFrame(m: CoverMap, sx: number, sy: number): { x: number; y: number } {
  const x = m.mirror ? m.cw - sx : sx;
  return { x: (x - m.offX) / m.dispW, y: (sy - m.offY) / m.dispH };
}

/** Part of the frame (normalised) that is actually visible on screen. */
export function visibleFrameRect(m: CoverMap): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.max(0, -m.offX / m.dispW),
    y0: Math.max(0, -m.offY / m.dispH),
    x1: Math.min(1, (m.cw - m.offX) / m.dispW),
    y1: Math.min(1, (m.ch - m.offY) / m.dispH),
  };
}
