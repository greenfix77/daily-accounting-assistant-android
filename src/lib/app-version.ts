"use client";

/**
 * Single source of truth for the version shown in «درباره برنامه» (About).
 *
 * - Android APK: reads versionName from android/app/build.gradle via the
 *   official @capacitor/app plugin → the About screen always shows the real
 *   installed release version automatically after every new release.
 * - Web preview / PWA: falls back to package.json "version"
 *   (both are bumped together on every release).
 */

import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import pkg from "../../package.json";

let cached: string | null = null;

export async function getAppVersion(): Promise<string> {
  if (cached) return cached;

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await CapApp.getInfo();
      if (info?.version) {
        cached = info.version;
        return cached;
      }
    } catch {
      /* fall through to package.json */
    }
  }

  cached = pkg.version;
  return cached;
}
