"use client";

import * as React from "react";
import { ChevronRight, Sprout, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useRegister, useUpdateSettings } from "@/lib/hooks";
import { biometricRemove } from "@/lib/biometric";
import { BIO_EMAIL_KEY } from "@/lib/use-biometric-login";
import { useAppFormat, PillInput, GradientButton } from "@/components/app/ui";
import { Switch } from "@/components/ui/switch";

export default function SignupScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { back, push, setAuthed, popToRoot, setTab } = useAppStore();
  const updateSettings = useUpdateSettings();
  const register = useRegister();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      toast.error(f.t("common.required"));
      return;
    }
    if (password.length < 6) {
      toast.error(f.t("auth.passwordShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(f.t("auth.passwordMismatch"));
      return;
    }
    if (!terms) {
      toast.error(f.t("auth.mustAcceptTerms"));
      return;
    }
    setBusy(true);
    try {
      // a NEW account invalidates any previous fingerprint binding
      biometricRemove();
      try {
        localStorage.removeItem(BIO_EMAIL_KEY);
      } catch {
        /* ignore */
      }
      await register.mutateAsync({ name: name.trim(), email: email.trim() });
      setAuthed(true);
      setTab("home");
      popToRoot();
      await updateSettings.mutateAsync({ onboarded: true, biometricLock: false });
      toast.success(f.t("auth.welcomeBack"));
    } catch {
      toast.error(f.t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative">
      <button
        type="button"
        onClick={back}
        aria-label={f.t("common.back")}
        className="absolute top-3 start-4 z-20 w-9 h-9 rounded-full flex items-center justify-center text-foreground hover:bg-accent transition-colors"
      >
        <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
      </button>

      <div className="flex-1 overflow-y-auto app-screen-scroll px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 pt-12 pb-2">
          <div className="w-16 h-16 rounded-3xl bg-income-soft text-primary flex items-center justify-center">
            <Sprout className="w-8 h-8" />
          </div>
          <h1 className="font-extrabold text-[20px] text-foreground">{f.t("auth.signupTitle")}</h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3.5 w-full max-w-sm mx-auto"
        >
          <PillInput
            type="text"
            className="text-right"
            placeholder={f.t("auth.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <PillInput
            type="text"
            inputMode="email"
            dir="ltr"
            className="text-right"
            placeholder={f.t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <PillInput
            type="password"
            dir="ltr"
            className="text-right"
            placeholder={f.t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <PillInput
            type="password"
            dir="ltr"
            className="text-right"
            placeholder={f.t("auth.confirmPasswordPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />

          <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 card-soft mt-1">
            <span className="text-[13px] font-medium text-foreground/80">{f.t("auth.acceptTerms")}</span>
            <Switch checked={terms} onCheckedChange={setTerms} />
          </div>

          <GradientButton type="submit" disabled={busy} className="mt-1">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : f.t("auth.signup")}
          </GradientButton>
        </form>

        <p className="text-center text-[13px] text-muted-foreground mt-2">
          {f.t("auth.haveAccount")}{" "}
          <button type="button" onClick={() => push("login")} className="text-primary font-bold">
            {f.t("auth.login")}
          </button>
        </p>
      </div>
    </div>
  );
}
