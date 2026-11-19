"use client";
import { useState } from "react";
import { AlertTriangle, Sun } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { I18nKey } from "@/lib/i18n";

/** Simple SVG illustrations for each step. */
function Illustration({ step }: { step: number }) {
  const common = { width: 96, height: 80, viewBox: "0 0 96 80", "aria-hidden": true } as const;
  switch (step) {
    case 1:
      return (
        <svg {...common}>
          <rect x="30" y="8" width="36" height="56" rx="6" fill="#18233b" stroke="#2a3856" strokeWidth="2" />
          <circle cx="48" cy="28" r="8" fill="none" stroke="#6b7a96" strokeWidth="2" />
          <path d="M44 40h8M45 45h6" stroke="#6b7a96" strokeWidth="2" />
          <path d="M20 14 76 70" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <rect x="8" y="6" width="56" height="68" rx="4" fill="#9fb6d9" opacity="0.35" stroke="#9fb6d9" strokeWidth="2" />
          <rect x="44" y="26" width="18" height="32" rx="4" fill="#111a2e" stroke="#2dd4bf" strokeWidth="2" />
          <path d="M44 34 18 22v34l26-12" fill="#fde68a" opacity="0.45" />
          <circle cx="53" cy="30" r="2.5" fill="#fde68a" />
        </svg>
      );
    case 3:
      return (
        <svg {...common}>
          <rect x="6" y="6" width="54" height="68" rx="4" fill="#9fb6d9" opacity="0.35" stroke="#9fb6d9" strokeWidth="2" />
          <path d="M62 30c8-6 18-6 24 2v20c-6 8-16 8-24 2" fill="#e8c4a0" stroke="#c49a74" strokeWidth="2" />
          <circle cx="66" cy="42" r="3" fill="#0a1020" />
        </svg>
      );
    case 4:
      return (
        <svg {...common}>
          <rect x="6" y="6" width="54" height="68" rx="4" fill="#9fb6d9" opacity="0.35" stroke="#9fb6d9" strokeWidth="2" />
          <path d="M66 34h16a6 6 0 0 1 0 12H66z" fill="#e8c4a0" stroke="#c49a74" strokeWidth="2" />
          <path d="M70 22c4 2 6 6 6 10M74 16c6 3 9 9 9 15" stroke="#2dd4bf" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

const STEPS: { title: I18nKey; body: I18nKey }[] = [
  { title: "mirrorStep1Title", body: "mirrorStep1Body" },
  { title: "mirrorStep2Title", body: "mirrorStep2Body" },
  { title: "mirrorStep3Title", body: "mirrorStep3Body" },
  { title: "mirrorStep4Title", body: "mirrorStep4Body" },
];

export function MirrorTestView() {
  const { t, navigate } = useApp();
  const [bright, setBright] = useState(false);
  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <ViewHeader title={t("mirrorTest")} />
      <p className="mb-4 text-muted">{t("mirrorIntro")}</p>
      <ol className="grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card className="flex gap-4">
              <div className="flex flex-col items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent">{i + 1}</span>
                <Illustration step={i + 1} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{t(s.title)}</h2>
                <p className="mt-1 text-sm text-muted">{t(s.body)}</p>
                {i === 1 && (
                  <Button size="sm" className="mt-3" icon={<Sun size={16} />} onClick={() => setBright(true)}>
                    {t("mirrorLightScreen")}
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <Card className="mt-4 border-amber/30 bg-amber/5">
        <h2 className="flex items-center gap-2 font-semibold text-amber-200">
          <AlertTriangle size={18} aria-hidden /> {t("mirrorFingernailTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink/85">{t("mirrorFingernailBody")}</p>
      </Card>
      <Button variant="danger" block size="lg" className="mt-6" onClick={() => navigate("found")}>
        {t("mirrorSuspicious")}
      </Button>
      {bright && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-end justify-center bg-white pb-10 text-sm text-neutral-500"
          onClick={() => setBright(false)}
          aria-label={t("close")}
        >
          {t("mirrorLightScreenHint")}
        </button>
      )}
    </main>
  );
}
