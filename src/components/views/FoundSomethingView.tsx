"use client";
import { Camera, ExternalLink, FileText } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { I18nKey } from "@/lib/i18n";

const STEPS: { title: I18nKey; body: I18nKey }[] = [
  { title: "found1Title", body: "found1Body" },
  { title: "found2Title", body: "found2Body" },
  { title: "found3Title", body: "found3Body" },
  { title: "found4Title", body: "found4Body" },
  { title: "found5Title", body: "found5Body" },
  { title: "found6Title", body: "found6Body" },
];

export function FoundSomethingView() {
  const { t, navigate } = useApp();
  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <ViewHeader title={t("foundSomething")} />
      <p className="mb-4 text-lg">{t("foundIntro")}</p>
      <ol className="grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/15 font-bold text-amber">{i + 1}</span>
              <div className="flex-1">
                <h2 className="font-semibold">{t(s.title)}</h2>
                <p className="mt-1 text-sm text-muted">{t(s.body)}</p>
                {i === 1 && (
                  <Button size="sm" className="mt-3" icon={<Camera size={16} />} onClick={() => navigate("scan")}>
                    {t("capture")}
                  </Button>
                )}
                {i === 4 && (
                  <a
                    href="https://www.airbnb.com/help"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-accent hover:bg-white/5"
                  >
                    <ExternalLink size={16} aria-hidden /> {t("found5Link")}
                  </a>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" block className="mt-6" icon={<FileText size={22} />} onClick={() => navigate("report")}>
        {t("generateReport")}
      </Button>
    </main>
  );
}
