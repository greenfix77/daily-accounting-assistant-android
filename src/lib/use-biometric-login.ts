"use client";

/**
 * Fingerprint login from the entry screens (Welcome / Login).
 *
 * Flow: enable fingerprint in Settings (Settings → App lock → Fingerprint login)
 * → the binding (device biometry + the account email) survives logout →
 * the entry screens offer «ورود با اثر انگشت» which authenticates via the
 * device biometry and logs the stored account back in — no email/password.
 */

import * as React from "react";
import { toast } from "sonner";
import { biometricAuthenticate, biometricRegistered } from "@/lib/biometric";
import { useLogin, useSettings, useUpdateSettings } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { makeT } from "@/lib/i18n";

export const BIO_EMAIL_KEY = "bio-email";

export function biometricEmailStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(BIO_EMAIL_KEY);
  } catch {
    return false;
  }
}

export function useBiometricLogin() {
  const { data: settings } = useSettings();
  const lang = settings?.language ?? "fa";
  const t = React.useMemo(() => makeT(lang), [lang]);
  const login = useLogin();
  const updateSettings = useUpdateSettings();
  const setAuthed = useAppStore((s) => s.setAuthed);
  const setTab = useAppStore((s) => s.setTab);
  const popToRoot = useAppStore((s) => s.popToRoot);
  const [busy, setBusy] = React.useState(false);

  /** fingerprint login offered on entry screens only when enabled in Settings */
  const available =
    !!settings?.biometricLock && biometricRegistered() && biometricEmailStored();

  const loginWithFingerprint = React.useCallback(async (): Promise<boolean> => {
    let email: string | null = null;
    try {
      email = window.localStorage.getItem(BIO_EMAIL_KEY);
    } catch {
      email = null;
    }
    if (!email || !biometricRegistered()) return false;
    setBusy(true);
    try {
      const ok = await biometricAuthenticate();
      if (!ok) {
        toast.error(t("lock.biometricFailed"));
        return false;
      }
      await login.mutateAsync(email);
      // treat the biometric auth as the app-lock unlock for this session
      // (avoids an immediate second lock right after fingerprint login)
      try {
        sessionStorage.setItem("app-unlocked", "1");
      } catch {
        /* ignore */
      }
      setAuthed(true);
      setTab("home");
      popToRoot();
      await updateSettings.mutateAsync({ onboarded: true });
      toast.success(t("auth.welcomeBack"));
      return true;
    } catch {
      toast.error(t("common.error"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [login, setAuthed, setTab, popToRoot, updateSettings, t]);

  return { available, busy, loginWithFingerprint };
}
