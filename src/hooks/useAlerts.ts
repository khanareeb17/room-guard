"use client";
import { useEffect, useState } from "react";
import type { Confidence } from "@/lib/detection/types";

/**
 * Geiger-style audio + haptics. The AudioContext is created/resumed from the
 * user's start tap (required on iOS). Clicks get faster as the best
 * candidate's confidence rises; a distinct two-tone alert plays on "Likely".
 */
export class AlertEngine {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private level: Confidence = "none";
  private value = 0;
  private running = false;
  sound = true;
  vibration = true;

  unlock() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      // Silent blip to fully unlock on iOS.
      this.tone(1, 0.001, 0.0001);
    } catch {
      this.ctx = null;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  configure(o: { sound: boolean; vibration: boolean }) {
    this.sound = o.sound;
    this.vibration = o.vibration;
  }

  setLevel(level: Confidence, value: number) {
    this.level = level;
    this.value = value;
  }

  private interval(): number | null {
    switch (this.level) {
      case "likely":
        return 110;
      case "possible":
        return 650 - 400 * Math.min(1, Math.max(0, (this.value - 0.3) / 0.4));
      case "low":
        return 1100;
      default:
        return null;
    }
  }

  private loop = () => {
    if (!this.running) return;
    const iv = this.interval();
    if (iv !== null && this.sound) this.click();
    this.timer = setTimeout(this.loop, iv ?? 200);
  };

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = "sine", at = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  click() {
    this.tone(this.level === "likely" ? 1800 : 1200, 0.02, 0.12, "square");
  }

  alert(kind: "possible" | "likely" | "reflection" | "light") {
    if (this.sound) {
      if (kind === "likely" || kind === "reflection") {
        this.tone(880, 0.12, 0.25, "triangle");
        this.tone(1320, 0.16, 0.25, "triangle", 0.14);
        if (kind === "reflection") this.tone(1760, 0.2, 0.22, "triangle", 0.3);
      } else if (kind === "light") {
        this.tone(660, 0.15, 0.2, "sine");
      } else {
        this.tone(990, 0.08, 0.15, "sine");
      }
    }
    if (this.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        if (kind === "possible") navigator.vibrate(40);
        else if (kind === "light") navigator.vibrate(60);
        else navigator.vibrate(kind === "reflection" ? [90, 60, 90, 60, 90] : [80, 60, 80]);
      } catch {
        /* unsupported (iOS) */
      }
    }
  }
}

export function useAlerts(opts: { sound: boolean; vibration: boolean; active: boolean }) {
  const [engine] = useState(() => new AlertEngine());
  useEffect(() => {
    engine.configure({ sound: opts.sound, vibration: opts.vibration });
  }, [engine, opts.sound, opts.vibration]);
  useEffect(() => {
    if (!opts.active) return;
    engine.start();
    return () => engine.stop();
  }, [engine, opts.active]);
  useEffect(() => () => engine.dispose(), [engine]);
  return engine;
}
