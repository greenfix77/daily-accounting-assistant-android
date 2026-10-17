"use client";

import * as React from "react";
import {
  Languages,
  SunMoon,
  Coins,
  CalendarDays,
  Lock,
  Fingerprint,
  Bell,
  BellRing,
  FileDown,
  UserRound,
  Info,
  LogOut,
  Check,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toEnDigits } from "@/lib/jalali";
import {
  biometricAvailable,
  biometricRegistered,
  biometricRegister,
  biometricRemove,
} from "@/lib/biometric";
import { BIO_EMAIL_KEY } from "@/lib/use-biometric-login";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CalType, CurrencyCode, Lang, ThemeMode } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useSettings, useUpdateSettings } from "@/lib/hooks";
import { useAppFormat, ScreenHeader, PillInput, GradientButton, ConfirmDialog } from "@/components/app/ui";

// ── local building blocks ────────────────────────────────────
function Row({
  icon: Icon,
  title,
  sub,
  value,
  end,
  destructive,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  value?: string;
  end?: React.ReactNode;
  destructive?: boolean;
  onClick?: () => void;
}) {
  const color = destructive ? "#E5757A" : "#4E9B72";
  const inner = (
    <>
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block font-semibold text-[14px] truncate",
            destructive ? "text-expense" : "text-foreground"
          )}
        >
          {title}
        </span>
        {(sub || value) && (
          <span className="block text-[12px] text-muted-foreground truncate mt-0.5">
            {value ?? sub}
          </span>
        )}
      </span>
      {end ?? (onClick ? <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" /> : null)}
    </>
  );
  const cls = cn(
    "bg-card rounded-2xl px-4 py-3.5 card-soft flex items-center gap-3 w-full text-start",
    onClick && "hover:bg-accent/40 active:scale-[0.99] transition-all cursor-pointer"
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

function OptionDialog<T extends string>({
  open,
  onOpenChange,
  title,
  options,
  value,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] rounded-3xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-[15px] text-start">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 mt-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onSelect(o.value);
                onOpenChange(false);
              }}
              className="flex items-center justify-between px-3.5 py-3 rounded-2xl hover:bg-secondary transition-colors text-start"
            >
              <span
                className={cn(
                  "text-[14px]",
                  value === o.value ? "text-primary font-bold" : "text-foreground"
                )}
              >
                {o.label}
              </span>
              {value === o.value && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsScreen({ params }: { params?: Record<string, unknown> }) {
  void params;
  const f = useAppFormat();
  const { push, setAuthed, popToRoot, setTab } = useAppStore();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [langOpen, setLangOpen] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const [calOpen, setCalOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [bioSupported, setBioSupported] = React.useState<boolean | null>(null);
  const [bioRegistered, setBioRegistered] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    biometricAvailable().then((ok) => {
      if (alive) setBioSupported(ok);
    });
    setBioRegistered(biometricRegistered());
    return () => {
      alive = false;
    };
  }, [settings?.biometricLock]);

  const themeLabel = (t: ThemeMode) =>
    t === "light" ? f.t("set.themeLight") : t === "dark" ? f.t("set.themeDark") : f.t("set.themeSystem");
  const currencyLabel = (c: CurrencyCode) => (c === "IRT" ? f.t("common.toman") : c);

  const onAppLockChange = (v: boolean) => {
    if (v) {
      if (settings?.pin) {
        updateSettings.mutate({ appLock: true });
      } else {
        setPin("");
        setPin2("");
        setPinOpen(true);
      }
    } else {
      biometricRemove();
      try {
        localStorage.removeItem(BIO_EMAIL_KEY);
      } catch {
        /* ignore */
      }
      updateSettings.mutate({ appLock: false, pin: null, biometricLock: false });
    }
  };

  const onBiometricChange = async (v: boolean) => {
    if (v) {
      if (!settings?.appLock) {
        toast.error(f.t("set.biometricNeedLock"));
        return;
      }
      try {
        const ok = await biometricRegister();
        if (ok) {
          // bind the current account so entry screens can offer fingerprint login
          try {
            localStorage.setItem("bio-email", settings?.email ?? "");
          } catch {
            /* ignore */
          }
          await updateSettings.mutateAsync({ biometricLock: true });
          toast.success(f.t("set.biometricOn"));
        } else {
          toast.error(f.t("set.biometricFailed"));
        }
      } catch {
        toast.error(f.t("set.biometricFailed"));
      }
    } else {
      biometricRemove();
      updateSettings.mutate({ biometricLock: false });
      toast.success(f.t("set.biometricOff"));
    }
  };

  const savePin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error(f.t("set.enterPin"));
      return;
    }
    if (pin !== pin2) {
      toast.error(f.t("set.pinMismatch"));
      return;
    }
    await updateSettings.mutateAsync({ appLock: true, pin });
    toast.success(f.t("set.pinSet"));
    setPinOpen(false);
  };

  const doLogout = async () => {
    // Keep the security configuration (app lock, PIN, fingerprint) and the
    // biometric binding — the entry screens offer fingerprint login after
    // logout. They are only cleared when the user disables them explicitly.
    await updateSettings.mutateAsync({ onboarded: false });
    setAuthed(false);
    popToRoot();
    toast.success(f.t("auth.logoutSuccess"));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <ScreenHeader title={f.t("set.title")} onBack={() => setTab("home")} />

      <div className="flex-1 overflow-y-auto app-screen-scroll px-4 pb-8 pt-2 flex flex-col gap-4">
        {/* Preferences */}
        <div className="flex flex-col gap-2.5">
          <Row
            icon={Languages}
            title={f.t("set.language")}
            value={f.lang === "fa" ? f.t("set.farsi") : f.t("set.english")}
            onClick={() => setLangOpen(true)}
          />
          <Row
            icon={SunMoon}
            title={f.t("set.theme")}
            value={themeLabel(settings?.theme ?? "system")}
            onClick={() => setThemeOpen(true)}
          />
          <Row
            icon={Coins}
            title={f.t("set.currency")}
            value={currencyLabel(settings?.currency ?? "IRT")}
            onClick={() => setCurrencyOpen(true)}
          />
          <Row
            icon={CalendarDays}
            title={f.t("set.calendar")}
            value={settings?.calendar === "gregorian" ? f.t("set.gregorian") : f.t("set.jalali")}
            onClick={() => setCalOpen(true)}
          />
        </div>

        {/* Security */}
        <div className="flex flex-col gap-2.5">
          <Row
            icon={Lock}
            title={f.t("set.appLock")}
            sub={f.t("set.appLockDesc")}
            end={
              <Switch
                checked={!!settings?.appLock}
                onCheckedChange={onAppLockChange}
              />
            }
          />
          <Row
            icon={Fingerprint}
            title={f.t("set.biometric")}
            sub={
              bioSupported === false
                ? f.t("set.biometricUnsupported")
                : !settings?.appLock
                  ? f.t("set.biometricNeedLock")
                  : f.t("set.biometricDesc")
            }
            end={
              <Switch
                checked={!!settings?.biometricLock && bioRegistered}
                disabled={bioSupported === false || !settings?.appLock}
                onCheckedChange={onBiometricChange}
              />
            }
          />
          <Row
            icon={Bell}
            title={f.t("set.notifications")}
            sub={f.t("set.notificationsDesc")}
            end={
              <Switch
                checked={!!settings?.notificationsEnabled}
                onCheckedChange={(v) => updateSettings.mutate({ notificationsEnabled: v })}
              />
            }
          />
        </div>

        {/* More */}
        <div className="flex flex-col gap-2.5">
          <Row
            icon={BellRing}
            title={f.t("set.remindersRow")}
            sub={f.t("set.remindersRowDesc")}
            onClick={() => push("reminders")}
          />
          <Row
            icon={FileDown}
            title={f.t("set.exportRow")}
            sub={f.t("set.exportRowDesc")}
            onClick={() => push("export")}
          />
          <Row
            icon={UserRound}
            title={f.t("set.profileRow")}
            sub={f.t("set.profileRowDesc")}
            onClick={() => push("profile")}
          />
          <Row
            icon={Info}
            title={f.t("set.about")}
            sub={f.t("set.aboutDesc")}
            onClick={() => push("about")}
          />
        </div>

        {/* Logout */}
        <Row
          icon={LogOut}
          title={f.t("auth.logout")}
          destructive
          onClick={() => setLogoutOpen(true)}
        />
      </div>

      {/* Language */}
      <OptionDialog<Lang>
        open={langOpen}
        onOpenChange={setLangOpen}
        title={f.t("set.language")}
        value={f.lang}
        options={[
          { value: "fa", label: "فارسی" },
          { value: "en", label: "English" },
        ]}
        onSelect={(v) => updateSettings.mutate({ language: v })}
      />

      {/* Theme */}
      <OptionDialog<ThemeMode>
        open={themeOpen}
        onOpenChange={setThemeOpen}
        title={f.t("set.theme")}
        value={settings?.theme ?? "system"}
        options={[
          { value: "light", label: f.t("set.themeLight") },
          { value: "dark", label: f.t("set.themeDark") },
          { value: "system", label: f.t("set.themeSystem") },
        ]}
        onSelect={(v) => updateSettings.mutate({ theme: v })}
      />

      {/* Currency */}
      <OptionDialog<CurrencyCode>
        open={currencyOpen}
        onOpenChange={setCurrencyOpen}
        title={f.t("set.currency")}
        value={settings?.currency ?? "IRT"}
        options={[
          { value: "IRT", label: currencyLabel("IRT") },
          { value: "IRR", label: currencyLabel("IRR") },
          { value: "USD", label: currencyLabel("USD") },
        ]}
        onSelect={(v) => updateSettings.mutate({ currency: v })}
      />

      {/* Calendar */}
      <OptionDialog<CalType>
        open={calOpen}
        onOpenChange={setCalOpen}
        title={f.t("set.calendar")}
        value={settings?.calendar ?? "jalali"}
        options={[
          { value: "jalali", label: f.t("set.jalali") },
          { value: "gregorian", label: f.t("set.gregorian") },
        ]}
        onSelect={(v) => updateSettings.mutate({ calendar: v })}
      />

      {/* PIN setup */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="max-w-[320px] rounded-3xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-[15px] text-start">{f.t("set.appLock")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            <PillInput
              type="password"
              inputMode="numeric"
              dir="ltr"
              maxLength={4}
              placeholder={f.t("set.enterPin")}
              value={pin}
              onChange={(e) => setPin(toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 4))}
              className="text-center tracking-[0.5em]"
            />
            <PillInput
              type="password"
              inputMode="numeric"
              dir="ltr"
              maxLength={4}
              placeholder={f.t("set.confirmPin")}
              value={pin2}
              onChange={(e) => setPin2(toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 4))}
              className="text-center tracking-[0.5em]"
            />
            <GradientButton onClick={savePin}>{f.t("common.save")}</GradientButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout confirm */}
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={doLogout}
        title={f.t("auth.logoutConfirm")}
        confirmLabel={f.t("auth.logout")}
      />
    </div>
  );
}
