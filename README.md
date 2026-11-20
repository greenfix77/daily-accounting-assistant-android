# HesabYar ReyRa 💰 — ReyRa Daily Accounting Assistant

**English** | [فارسی](README.fa.md)

A personal finance / daily accounting app for mobile (Persian & RTL by default, with full English support), featuring a pastel mint-green theme, the Jalali (Shamsi) calendar, and complete tablet support.
**Fully offline** — all data lives on the device itself, and it ships as an installable **Android APK**.

> 🌍 **Developers welcome!** This project is actively looking for contributors. Whether you want to fix a bug, add a feature, improve the UI, translate the app to a new language, or write documentation — you are more than welcome. See [🤝 Contributing](#-contributing--help-this-project-grow) below.

## ✨ Features

- 📊 **Dashboard** — total balance, today's/monthly income & expense, 7-day chart, recent transactions, upcoming events
- 💳 **Transactions** — income / expense / transfer, search, filters, edit & delete, and per-transaction **time** (entered manually or auto-recorded at the moment of entry)
- 🏦 **Accounts** — bank / cash / savings with opening balance and automatic reconciliation, plus a **statement view** per account (last 10/20/50 movements, filtered by Jalali date range)
- 🏷️ **Categories** — icon & color, split income/expense
- 🎯 **Budgeting** — monthly overall budget + per-category budgets with over-limit warnings
- 🤝 **Debts & Credits** — manage debts with partial payments and settlement
- 🔁 **Installments & Recurring** — monthly recurring transactions with paid-installment counters
- 🐷 **Savings Goals** — progress percentage, deposits & withdrawals
- 📈 **Reports** — 4 ranges (daily/weekly/monthly/yearly) with charts and per-category breakdown
- ⏰ **Reminders** — bills, installments, savings with monthly/yearly repeat
- 📤 **Export & Backup** — CSV / Excel / JSON + restore
- ⚙️ **Settings** — Persian/English, light/dark theme, Jalali/Gregorian calendar, currency, app lock with PIN and web fingerprint unlock
- 📴 **100% Offline** — no servers, no network calls; the database lives on your device (IndexedDB)

## 🛠 Tech Stack

| Layer | Technology |
|------|----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide + Framer Motion |
| Database | **Dexie (IndexedDB)** on-device — offline |
| Android | **Capacitor 7** → APK |
| State | TanStack Query + Zustand |
| Calendar | Jalali (hand-rolled conversion, zero external deps) |
| Font | Vazirmatn (local) |

## 🚀 Run Locally (Web)

```bash
bun install
bun run dev
```

> 🔒 The app ships with an **empty database**; all data (profile, accounts, transactions, …) is entered by the user.
> Data is stored in the browser's IndexedDB.

## 📱 Install the Android APK — Download from Releases

**Quickest way:** open the repo → the **Releases** section (right side) → latest release → download **`HesabYar-ReyRa-<version>.apk`** → install it on your phone/tablet (Android will ask for "install from unknown sources" the first time — allow it). Done!

## 🏗 Build the APK (fully offline) — one click on GitHub

The project ships with a ready-made **GitHub Actions workflow** that builds the static web app inside a Capacitor shell in GitHub's cloud and produces an installable APK — no tooling required on your machine:

1. Open the repo → **Actions** tab → pick **“Build Android APK”** from the left list.
2. Hit **“Run workflow”** → **Run workflow** (on the `main` branch).
3. Wait ~4–6 minutes → click the finished run → under **Artifacts** download **`HesabYar-ReyRa-APK`**.
4. Unzip it → send `HesabYar-ReyRa-<version>.apk` to your phone/tablet and install
   (Android will ask for "install from unknown sources" the first time — allow it).

> 🏷 Instead of Run workflow you can push a `v*` tag (e.g. `git tag v1.0.0 && git push origin v1.0.0`) — the APK then lands in a **GitHub Release** too.
> 🔐 Data is stored only on your device (app storage); no network requests are made.
> 🔢 This build is a **debug** APK with a **stable signature**, perfectly fine for personal use; Play Store publishing requires a release signature.
> 🗓 Table creation and setup are fully automatic — install, open, sign up, done!

### ↩️ Downgrade / Roll back to an older version

Android system-wide refuses to install a build with a **lower versionCode** over an installed one (`INSTALL_FAILED_VERSION_DOWNGRADE` — on some phones, e.g. Samsung, it shows the misleading message “App not installed as package appears to be invalid”). This is an Android limitation, not an APK defect. Two ways to roll back:

**Option 1 — rollback build (no computer; installs right from the UI):**
1. In the **Actions** tab → “Build Android APK” → **Run workflow** (or just ask me):
   - **`build_ref`** = the tag of the target version (e.g. `v1.0.23-android`)
   - **`version_code_override`** = a number **greater than the installed versionCode** (e.g. `26` when the installed versionCode is `25`)
2. An APK named `HesabYar-ReyRa-<version>-rc<code>.apk` is produced and also attached to that tag's Release; it installs like a regular update over the current build — **without uninstalling and without data loss**.

**Option 2 — adb (with a computer):**

```bash
adb install -r -d HesabYar-ReyRa-1.0.23.apk
```

The `-d` flag allows version downgrade and `-r` keeps your data (requires USB debugging).

> ⚠️ If you install a rollback build, rolling forward again requires a version with a higher versionCode (all new official builds are stamped above rollback builds) or uninstalling the app.
> 🔢 **versionCode scheme (from recent versions onward):** `major×10000 + minor×100 + patch` (e.g. 1.0.25 → `10025`) so there is always headroom for rollback builds.

### Android build notes
- 🔐 **Stable signature** — `android/app/debug.keystore` is committed to the repo and all CI builds are signed with the same key; new versions install over the previous one without uninstalling (and without data loss). Straight downgrades, however, are blocked by Android itself — see the “↩️ Downgrade” section.
- 🔒 **PIN app lock** works fully (web-style fingerprint unlock is not supported inside the WebView; adding native biometric is on the roadmap).
- ↩️ The Android hardware **Back** button navigates correctly between app screens.
- 🖼 The app icon and splash are generated from `assets/` (`bunx @capacitor/assets generate --android`).

### Manual build (optional, on your own machine)

```bash
bun install
rm -rf src/app/api          # the APK is client-only
bun run build:apk           # static output → out/
bunx cap sync android
cd android && ./gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

## ☁️ Host the Web App (optional)

The web version can be hosted too; but the database is client-side and the app needs no server — any static or Node host will do. Guides for Railway (Docker + volume) and Vercel are available in the commit history and in `Dockerfile` / `railway.toml`.

## 🗺 Roadmap

- [x] Migrate the data layer to on-device storage (Dexie/IndexedDB)
- [x] Static export + Capacitor shell
- [x] Automated APK builds with GitHub Actions
- [x] Transaction time — manual entry with automatic fallback to the entry moment
- [ ] Native fingerprint unlock in the APK (@capacitor-community/native-biometric)
- [ ] Release signing for Play Store publishing

## 🤝 Contributing — Help This Project Grow

**This project is an open invitation to developers!** HesabYar ReyRa is a free, open-source (MIT) personal finance app, and it will only get better with your help. If you are a developer — junior or senior — this is a friendly, real-world codebase where your contribution genuinely ships: every merged PR ends up in the next Android APK release.

**Why contribute here?**
- 🎯 Real impact — the app is actively used and released; your work reaches users fast.
- 🧹 Modern stack — Next.js 16, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Zustand, Dexie, Capacitor.
- 📦 Small & readable — a compact codebase you can fully understand in an afternoon.
- 🌱 Great first issues — i18n, new report charts, widgets, validation, accessibility, docs.

**How you can help:**
- 🐞 Fix bugs or report issues (with steps to reproduce)
- ✨ Build features from the roadmap, or propose your own
- 🌍 Add a new language (the dictionary lives in `src/lib/i18n.ts`)
- 🎨 Improve UI/UX, accessibility and dark mode
- 📝 Improve docs (English, Persian, or a new language)
- 🧪 Add tests, CI improvements, or release tooling

**Getting started is easy:**

```bash
# 1. Fork & clone
git clone https://github.com/greenfix77/daily-accounting-assistant-android.git
# 2. Install & run
bun install && bun run dev
# 3. Create a branch, make your change, and open a Pull Request
git checkout -b feat/my-feature
```

Pull Requests are welcome at any size — a one-line fix is just as appreciated as a big feature. If you are unsure where to start, open an issue and say hello; we will help you find a task that fits.

> 💡 Ideas that would make a real difference: native biometric unlock for the APK, i18n for a third language, CSV import, recurring-transfer automation, richer report charts, and unit tests for the Jalali calendar utilities.

## 📄 License

MIT
