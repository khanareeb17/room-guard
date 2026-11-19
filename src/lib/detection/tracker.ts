import type { Confidence, DetectMode, ScoredBlob, TrackView, Verdict } from "./types";

/** Number of recent frames considered for presence / stability. */
export const WINDOW = 12;
const WINDOW_MASK = (1 << WINDOW) - 1;
const DROP_AFTER_MS = 500;
const BASE_RADIUS = 0.06; // in frame-width units
const MAX_TRACKS = 48;
const SAFE_ZONE_RADIUS = 0.035;
const SAFE_ZONE_TTL_MS = 30_000;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function popcount(v: number): number {
  let c = 0;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
}

export interface Motion {
  /** Scene motion since the previous frame, in frame-width units. */
  dx: number;
  dy: number;
  /** True when it came from a confident image-based estimate. */
  reliable: boolean;
}

interface Track {
  id: number;
  /** Position in frame-width units (x/w, y/w). */
  x: number;
  y: number;
  r: number;
  hitMask: number;
  frames: number;
  energy: Float32Array;
  area: Float32Array;
  ring: number;
  samples: number;
  blobScore: number;
  drift: number;
  collapse: number;
  bornAt: number;
  lastSeen: number;
  level: Confidence;
  value: number;
  verdict: Verdict;
  safe: boolean;
  peakY: number;
  hue: number;
  sat: number;
  cv: number;
  driftFactor: number;
  stability: number;
}

interface SafeZone {
  sx: number;
  sy: number;
  expires: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

function stats(arr: Float32Array, count: number): { mean: number; cv: number; med: number } {
  if (count === 0) return { mean: 0, cv: 0, med: 0 };
  let s = 0;
  const vals: number[] = [];
  for (let i = 0; i < count; i++) {
    s += arr[i];
    vals.push(arr[i]);
  }
  const mean = s / count;
  let v = 0;
  for (let i = 0; i < count; i++) v += (arr[i] - mean) ** 2;
  const std = Math.sqrt(v / count);
  return { mean, cv: mean > 1e-6 ? std / mean : 0, med: median(vals) };
}

export class Tracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private lastMotion: Motion = { dx: 0, dy: 0, reliable: false };
  private cumX = 0;
  private cumY = 0;
  private safeZones: SafeZone[] = [];
  mode: DetectMode = "lens";

  reset(): void {
    this.tracks = [];
    this.lastMotion = { dx: 0, dy: 0, reliable: false };
    this.cumX = 0;
    this.cumY = 0;
    this.safeZones = [];
  }

  /** Clears tracks but keeps safe zones (e.g. after a pause). */
  clearTracks(): void {
    this.tracks = [];
    this.lastMotion = { dx: 0, dy: 0, reliable: false };
  }

  getTrack(id: number): { x: number; y: number; r: number } | null {
    const t = this.tracks.find((tr) => tr.id === id);
    return t ? { x: t.x, y: t.y, r: t.r } : null;
  }

  /**
   * Move every track by the scene motion without matching (used while torch
   * verification blanks the scene) and keep them alive.
   */
  hold(motion: Motion, now: number): void {
    this.cumX += motion.dx;
    this.cumY += motion.dy;
    for (const t of this.tracks) {
      t.x += motion.dx;
      t.y += motion.dy;
      t.lastSeen = now;
    }
  }

  setVerdict(id: number, verdict: Verdict): void {
    const t = this.tracks.find((tr) => tr.id === id);
    if (!t) return;
    t.verdict = verdict;
    if (verdict === "reflection" && this.mode === "lens") t.level = "likely";
  }

  markSafe(id: number, now: number): void {
    const t = this.tracks.find((tr) => tr.id === id);
    if (!t) return;
    t.safe = true;
    this.safeZones.push({ sx: t.x - this.cumX, sy: t.y - this.cumY, expires: now + SAFE_ZONE_TTL_MS });
  }

  update(blobs: ScoredBlob[], w: number, h: number, now: number, imageMotion: Motion): TrackView[] {
    const inv = 1 / w;
    const n = blobs.length;
    const bx = new Float32Array(n);
    const by = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      bx[i] = blobs[i].cx * inv;
      by[i] = blobs[i].cy * inv;
    }

    // Predict with the image-based motion when reliable, else last frame's.
    const pred = imageMotion.reliable ? imageMotion : this.lastMotion;
    const speed = Math.hypot(pred.dx, pred.dy);
    const radius = BASE_RADIUS + Math.min(0.08, speed * 1.5);

    // Greedy nearest-neighbour assignment.
    const pairs: { t: number; b: number; d: number }[] = [];
    for (let ti = 0; ti < this.tracks.length; ti++) {
      const tr = this.tracks[ti];
      const px = tr.x + pred.dx;
      const py = tr.y + pred.dy;
      for (let bi = 0; bi < n; bi++) {
        const d = Math.hypot(bx[bi] - px, by[bi] - py);
        if (d <= radius) pairs.push({ t: ti, b: bi, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    const trackTaken = new Int32Array(this.tracks.length).fill(-1);
    const blobTaken = new Uint8Array(n);
    const dxs: number[] = [];
    const dys: number[] = [];
    for (const p of pairs) {
      if (trackTaken[p.t] !== -1 || blobTaken[p.b]) continue;
      trackTaken[p.t] = p.b;
      blobTaken[p.b] = 1;
      dxs.push(bx[p.b] - this.tracks[p.t].x);
      dys.push(by[p.b] - this.tracks[p.t].y);
    }

    // Scene motion for this frame.
    let scene: Motion;
    if (imageMotion.reliable) scene = imageMotion;
    else if (dxs.length > 0) scene = { dx: median(dxs), dy: median(dys), reliable: false };
    else scene = { dx: this.lastMotion.dx * 0.5, dy: this.lastMotion.dy * 0.5, reliable: false };
    this.lastMotion = scene;
    this.cumX += scene.dx;
    this.cumY += scene.dy;

    // Update tracks.
    for (let ti = 0; ti < this.tracks.length; ti++) {
      const tr = this.tracks[ti];
      const bi = trackTaken[ti];
      tr.frames++;
      tr.hitMask = ((tr.hitMask << 1) | (bi >= 0 ? 1 : 0)) & WINDOW_MASK;
      if (bi >= 0) {
        const b = blobs[bi];
        const resX = bx[bi] - tr.x - scene.dx;
        const resY = by[bi] - tr.y - scene.dy;
        const res = Math.hypot(resX, resY);
        tr.drift = tr.frames <= 1 ? res : 0.7 * tr.drift + 0.3 * res;
        tr.x = bx[bi];
        tr.y = by[bi];
        const r = Math.sqrt(b.area / Math.PI) * inv;
        tr.r = tr.r === 0 ? r : 0.7 * tr.r + 0.3 * r;
        const energy = b.area * Math.max(1, b.meanY - b.surroundY);
        const prev = stats(tr.energy, Math.min(tr.samples, WINDOW));
        tr.collapse =
          tr.samples >= 3 && energy < 0.35 * prev.med ? Math.min(1, tr.collapse + 0.4) : tr.collapse * 0.8;
        tr.energy[tr.ring] = energy;
        tr.area[tr.ring] = b.area;
        tr.ring = (tr.ring + 1) % WINDOW;
        tr.samples++;
        tr.blobScore = tr.samples === 1 ? b.score : 0.6 * tr.blobScore + 0.4 * b.score;
        tr.lastSeen = now;
        tr.peakY = b.peakY;
        tr.hue = b.hue;
        tr.sat = b.sat;
      } else {
        // Missing: follow the scene, decay the score slightly.
        tr.x += scene.dx;
        tr.y += scene.dy;
        tr.blobScore *= 0.92;
      }
      this.evaluate(tr);
    }

    // Drop stale tracks.
    this.tracks = this.tracks.filter((t) => now - t.lastSeen <= DROP_AFTER_MS && t.x > -0.1 && t.x < 1.1);

    // Refresh / expire safe zones.
    for (const t of this.tracks) {
      if (!t.safe) continue;
      const sx = t.x - this.cumX;
      const sy = t.y - this.cumY;
      for (const z of this.safeZones) {
        if (Math.hypot(z.sx - sx, z.sy - sy) < SAFE_ZONE_RADIUS * 2) {
          z.sx = sx;
          z.sy = sy;
          z.expires = now + SAFE_ZONE_TTL_MS;
        }
      }
    }
    this.safeZones = this.safeZones.filter((z) => z.expires > now);

    // New tracks for unmatched blobs.
    for (let bi = 0; bi < n && this.tracks.length < MAX_TRACKS; bi++) {
      if (blobTaken[bi]) continue;
      const b = blobs[bi];
      if (b.score < 0.25) continue;
      const x = bx[bi];
      const y = by[bi];
      const safe = this.safeZones.some(
        (z) => Math.hypot(z.sx - (x - this.cumX), z.sy - (y - this.cumY)) < SAFE_ZONE_RADIUS,
      );
      const tr: Track = {
        id: this.nextId++,
        x,
        y,
        r: Math.sqrt(b.area / Math.PI) * inv,
        hitMask: 1,
        frames: 1,
        energy: new Float32Array(WINDOW),
        area: new Float32Array(WINDOW),
        ring: 1,
        samples: 1,
        blobScore: b.score,
        drift: 0,
        collapse: 0,
        bornAt: now,
        lastSeen: now,
        level: "none",
        value: 0,
        verdict: "unverified",
        safe,
        peakY: b.peakY,
        hue: b.hue,
        sat: b.sat,
        cv: 0,
        driftFactor: 1,
        stability: 1,
      };
      tr.energy[0] = b.area * Math.max(1, b.meanY - b.surroundY);
      tr.area[0] = b.area;
      this.evaluate(tr);
      this.tracks.push(tr);
    }

    const aspect = h / w;
    return this.tracks.map((t) => this.view(t, now, aspect));
  }

  /** Current track views without advancing time (used while verifying). */
  snapshot(w: number, h: number, now: number): TrackView[] {
    const aspect = h / w;
    return this.tracks.map((t) => this.view(t, now, aspect));
  }

  /** Recomputes lens-likeness and the hysteresis-filtered confidence level. */
  private evaluate(t: Track): void {
    const hits = popcount(t.hitMask);
    const windowFrames = Math.min(t.frames, WINDOW);
    const presence = hits / Math.max(3, windowFrames);
    const count = Math.min(t.samples, WINDOW);
    const e = stats(t.energy, count);
    const a = stats(t.area, count);
    t.cv = e.cv;
    const ir = this.mode === "ir";
    // IR LEDs may flicker regularly, so brightness stability is not required.
    const brightStable = ir ? 1 : count >= 3 ? clamp01(1 - (e.cv - 0.35) / 0.6) : 0.9;
    const sizeStable = count >= 3 ? clamp01(1 - (a.cv - 0.45) / 0.7) : 0.9;
    t.stability = brightStable * (0.5 + 0.5 * sizeStable);
    t.driftFactor = clamp01(1 - (t.drift - 0.003) / 0.008);
    const collapsePenalty = ir ? 1 : 1 - 0.6 * t.collapse;
    t.value = clamp01(t.blobScore * clamp01(presence * 1.15) * t.stability * t.driftFactor * collapsePenalty);

    const v = t.value;
    const prev = t.level;
    let level: Confidence = "none";
    const likelyHits = ir ? 7 : 8;
    const possibleHits = ir ? 4 : 3;
    if (prev === "likely" && hits >= 5 && v >= 0.4) level = "likely";
    else if (hits >= likelyHits && v >= 0.55 && t.stability >= 0.55 && t.driftFactor >= 0.5) level = "likely";
    else if ((prev === "possible" || prev === "likely") && hits >= 2 && v >= 0.26) level = "possible";
    else if (hits >= possibleHits && v >= 0.38) level = "possible";
    else if (hits >= 2 && v >= 0.18) level = "low";
    if (t.verdict === "reflection" && !ir && hits >= 2) level = "likely";
    t.level = level;
  }

  private view(t: Track, now: number, aspect: number): TrackView {
    return {
      id: t.id,
      x: t.x,
      y: t.y / aspect,
      r: t.r,
      confidence: t.level,
      value: t.value,
      verdict: t.verdict,
      safe: t.safe,
      hits: popcount(t.hitMask),
      ageMs: now - t.bornAt,
      peakY: t.peakY,
      hue: t.hue,
      sat: t.sat,
      blobScore: t.blobScore,
      brightnessCv: t.cv,
      drift: t.drift,
    };
  }
}
