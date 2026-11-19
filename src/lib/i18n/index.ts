import en, { type I18nKey } from "./en";
import urRoman from "./ur-roman";

export type Lang = "en" | "ur";
export type { I18nKey };

export const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, ur: urRoman };

export const LANG_LABELS: Record<Lang, string> = { en: "English", ur: "Roman Urdu" };

export function translate(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  let s = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
