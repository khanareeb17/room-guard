"use client";
import { Check, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import type { I18nKey } from "@/lib/i18n";

const CAN: I18nKey[] = ["can1", "can2", "can3", "can4"];
const CANT: I18nKey[] = ["cant1", "cant2", "cant3", "cant4", "cant5"];

export function LimitsView() {
  const { t } = useApp();
  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <ViewHeader title={t("limits")} />
      <p className="mb-4 text-lg">{t("limitsIntro")}</p>
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-semibold text-accent">{t("canTitle")}</h2>
        <ul className="space-y-3">
          {CAN.map((k) => (
            <li key={k} className="flex gap-3">
              <Check size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-red-300">{t("cantTitle")}</h2>
        <ul className="space-y-3">
          {CANT.map((k) => (
            <li key={k} className="flex gap-3">
              <X size={22} className="mt-0.5 shrink-0 text-red-300" aria-hidden />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="mt-4">
        <h2 className="mb-1 font-semibold">{t("networkTipTitle")}</h2>
        <p className="text-sm text-muted">{t("networkTipBody")}</p>
      </Card>
    </main>
  );
}
