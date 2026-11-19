"use client";
import { useState } from "react";
import { ScanEye, ShieldCheck, Moon } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { LANG_LABELS, type Lang } from "@/lib/i18n";

/** First-run onboarding: 3 short, skippable screens. */
export function Onboarding() {
  const { t, settings, updateSettings } = useApp();
  const [i, setI] = useState(0);
  const screens = [
    { icon: ScanEye, title: t("onb1Title"), body: t("onb1Body") },
    { icon: ShieldCheck, title: t("onb2Title"), body: t("onb2Body") },
    { icon: Moon, title: t("onb3Title"), body: t("onb3Body") },
  ];
  const s = screens[i];
  const Icon = s.icon;
  const finish = () => updateSettings({ onboarded: true });
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-bg px-6 safe-top safe-bottom" role="dialog" aria-modal="true" aria-label={s.title}>
      <div className="flex items-center justify-between py-2">
        <div className="w-48">
          <Segmented<Lang>
            label={t("language")}
            value={settings.lang}
            onChange={(v) => updateSettings({ lang: v })}
            options={(Object.keys(LANG_LABELS) as Lang[]).map((l) => ({ value: l, label: l === "en" ? "EN" : "Urdu" }))}
          />
        </div>
        <Button variant="ghost" onClick={finish}>
          {t("skip")}
        </Button>
      </div>
      <div key={i} className="flex flex-1 animate-fade-in flex-col items-center justify-center text-center">
        <span className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Icon size={56} aria-hidden />
        </span>
        <h1 className="text-3xl font-bold">{s.title}</h1>
        <p className="mt-4 max-w-sm text-lg text-muted">{s.body}</p>
      </div>
      <div className="flex items-center gap-4 pb-4">
        <div className="flex flex-1 gap-2" aria-hidden>
          {screens.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-8 bg-accent" : "w-2 bg-surface-3"}`} />
          ))}
        </div>
        <Button variant="primary" size="lg" onClick={() => (i < screens.length - 1 ? setI(i + 1) : finish())}>
          {i < screens.length - 1 ? t("next") : t("getStarted")}
        </Button>
      </div>
    </div>
  );
}
