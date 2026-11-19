"use client";
import { useState } from "react";
import { Lightbulb, MoveHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/AppProvider";

/** First-use coaching: 3 quick skippable cards. */
export function CoachOverlay({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const cards = [
    { icon: Lightbulb, title: t("coach1Title"), body: t("coach1Body") },
    { icon: MoveHorizontal, title: t("coach2Title"), body: t("coach2Body") },
    { icon: Target, title: t("coach3Title"), body: t("coach3Body") },
  ];
  const c = cards[i];
  const Icon = c.icon;
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={c.title}>
      <div className="safe-bottom w-full max-w-md animate-slide-up rounded-3xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Icon size={26} aria-hidden />
          </span>
          <h2 className="text-xl font-semibold">{c.title}</h2>
        </div>
        <p className="mb-5 text-muted">{c.body}</p>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {cards.map((_, k) => (
              <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-2 bg-surface-3"}`} />
            ))}
          </div>
          <Button variant="ghost" onClick={onDone}>
            {t("skip")}
          </Button>
          <Button variant="primary" onClick={() => (i < cards.length - 1 ? setI(i + 1) : onDone())}>
            {i < cards.length - 1 ? t("next") : t("done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
