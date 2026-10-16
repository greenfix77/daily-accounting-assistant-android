"use client";

import * as React from "react";
import { Sparkles, ShieldCheck, WifiOff, type LucideIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAppFormat, GradientButton } from "@/components/app/ui";

export default function WelcomeScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { push } = useAppStore();

  const feats: { icon: LucideIcon; key: string }[] = [
    { icon: Sparkles, key: "feat.simple" },
    { icon: ShieldCheck, key: "feat.secure" },
    { icon: WifiOff, key: "feat.offline" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative overflow-hidden">
      {/* decorative background blobs */}
      <div className="absolute -top-24 -start-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -end-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 start-1/4 w-72 h-72 rounded-full bg-income-soft/60 blur-3xl pointer-events-none" />

      <div className="relative flex-1 overflow-y-auto app-screen-scroll px-6 pb-4 pt-8 flex flex-col items-center justify-center gap-3">
        <img
          src="/images/welcome.png"
          alt={f.t("app.name")}
          className="w-44 h-44 object-cover rounded-[28px] shadow-md shadow-primary/10 ring-1 ring-black/5"
        />
        <h1 className="text-[22px] font-extrabold text-foreground mt-1">{f.t("app.name")}</h1>
        <p className="text-muted-foreground text-[13px] text-center">{f.t("app.tagline")}</p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {feats.map(({ icon: Icon, key }) => (
            <span
              key={key}
              className="flex items-center gap-1.5 bg-card card-soft rounded-full px-3 py-1.5 text-[11px] font-semibold text-foreground/80"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              {f.t(key)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative px-6 pb-8 pt-2 flex flex-col gap-2 w-full max-w-sm mx-auto">
        <GradientButton onClick={() => push("signup")}>{f.t("auth.start")}</GradientButton>
        <button
          type="button"
          onClick={() => push("login")}
          className="text-primary font-bold text-[14px] py-2 text-center"
        >
          {f.t("auth.login")}
        </button>
      </div>
    </div>
  );
}
