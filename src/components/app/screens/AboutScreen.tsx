"use client";

import * as React from "react";
import { Sprout, CheckCircle2, Lock } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAppFormat, ScreenHeader } from "@/components/app/ui";
import { getAppVersion } from "@/lib/app-version";

export default function AboutScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { back } = useAppStore();
  const [version, setVersion] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;
    getAppVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const features = [
    "feat.simple",
    "feat.secure",
    "feat.offline",
    "feat.reports",
    "feat.alerts",
    "feat.backup",
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("set.about")} onBack={back} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-4">
        {/* App identity card */}
        <div className="bg-card rounded-2xl p-5 card-soft flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-3xl app-gradient flex items-center justify-center shadow-lg shadow-primary/30">
            <Sprout className="w-8 h-8 text-white" />
          </div>
          <p className="font-extrabold text-[16px] text-foreground mt-1">{f.t("app.name")}</p>
          <p className="text-[12px] text-muted-foreground">
            {version ? f.t("app.version", { v: version }) : "\u200f"}
          </p>
          <p className="text-[13px] leading-6 text-foreground/70 mt-1">{f.t("set.aboutText")}</p>
        </div>

        {/* Features */}
        <div className="bg-card rounded-2xl p-4 card-soft flex flex-col gap-3">
          <p className="font-bold text-[14px] text-foreground">{f.t("set.features")}</p>
          <div className="flex flex-col gap-2.5">
            {features.map((key) => (
              <div key={key} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-primary shrink-0" />
                <span className="text-[13px] font-medium text-foreground/80">{f.t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground pb-2 pt-1">
          <Lock className="w-3.5 h-3.5" />
          <span>{f.t("set.secure")}</span>
        </div>
      </div>
    </div>
  );
}
