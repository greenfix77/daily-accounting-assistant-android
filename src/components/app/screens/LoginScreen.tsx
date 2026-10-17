"use client";

import * as React from "react";
import { ChevronRight, Sprout, Eye, EyeOff, Loader2, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useLogin, useUpdateSettings } from "@/lib/hooks";
import { useAppFormat, PillInput, GradientButton } from "@/components/app/ui";
import { useBiometricLogin } from "@/lib/use-biometric-login";
import { Checkbox } from "@/components/ui/checkbox";

export default function LoginScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { back, push, setAuthed, popToRoot, setTab } = useAppStore();
  const updateSettings = useUpdateSettings();
  const login = useLogin();
  const bio = useBiometricLogin();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("remember-email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.error(f.t("common.required"));
      return;
    }
    setBusy(true);
    try {
      await login.mutateAsync(email.trim());
      if (remember) localStorage.setItem("remember-email", email.trim());
      else localStorage.removeItem("remember-email");
      setAuthed(true);
      setTab("home");
      popToRoot();
      await updateSettings.mutateAsync({ onboarded: true });
      toast.success(f.t("auth.welcomeBack"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) toast.error(f.t("auth.loginFailed"));
      else toast.error(f.t("common.error"));
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
        <div className="flex flex-col items-center gap-3 pt-14 pb-2">
          <div className="w-16 h-16 rounded-3xl bg-income-soft text-primary flex items-center justify-center">
            <Sprout className="w-8 h-8" />
          </div>
          <h1 className="font-extrabold text-[20px] text-foreground">{f.t("auth.loginTitle")}</h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4 w-full max-w-sm mx-auto"
        >
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
          <div className="relative">
            <PillInput
              type={showPw ? "text" : "password"}
              dir="ltr"
              placeholder={f.t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-11 text-right"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label="password"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] font-medium text-foreground/80 cursor-pointer select-none">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              {f.t("auth.rememberMe")}
            </label>
            <button
              type="button"
              onClick={() => toast.info(f.t("auth.forgotPassword"))}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {f.t("auth.forgotPassword")}
            </button>
          </div>

          <GradientButton type="submit" disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : f.t("auth.login")}
          </GradientButton>

          {bio.available && (
            <button
              type="button"
              onClick={bio.loginWithFingerprint}
              disabled={busy || bio.busy}
              className="h-12 rounded-2xl bg-secondary text-primary text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-accent active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {bio.busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Fingerprint className="w-5 h-5" />
              )}
              {f.t("auth.fingerprintLogin")}
            </button>
          )}
        </form>

        <p className="text-center text-[13px] text-muted-foreground mt-2">
          {f.t("auth.noAccount")}{" "}
          <button type="button" onClick={() => push("signup")} className="text-primary font-bold">
            {f.t("auth.signup")}
          </button>
        </p>
      </div>
    </div>
  );
}
