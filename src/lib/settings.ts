import type { Sensitivity } from "./detection/types";
import type { Lang } from "./i18n";

export interface Settings {
  sensitivity: Sensitivity;
  glintBoost: boolean;
  autoVerify: boolean;
  sound: boolean;
  vibration: boolean;
  lang: Lang;
  debug: boolean;
  onboarded: boolean;
  coached: boolean;
  /** Which cameras showed IR in the self-test (null = not tested). */
  irFront: boolean | null;
  irRear: boolean | null;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: "normal",
  glintBoost: true,
  autoVerify: true,
  sound: true,
  vibration: true,
  lang: "en",
  debug: false,
  onboarded: false,
  coached: false,
  irFront: null,
  irRear: null,
};

const KEY = "rg.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked – settings just won't persist */
  }
}
