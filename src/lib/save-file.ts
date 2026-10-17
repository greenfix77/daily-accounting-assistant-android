"use client";

/**
 * Saves generated text content as a user-visible file — dual adapter.
 *
 * - Web (browser preview / PWA): classic `<a download>` blob download →
 *   the file lands in the browser's Downloads folder.
 * - Android / iOS (Capacitor): the WebView has NO DownloadListener, so
 *   `<a download>` is a silent no-op inside the APK. Instead the content is
 *   written to the app cache via @capacitor/filesystem and the native
 *   share sheet is opened via @capacitor/share — the user can then save it
 *   to Downloads / Google Drive, send it via Telegram/WhatsApp/email, etc.
 *   (The app manifest already declares a FileProvider covering cache-path.)
 */

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type SaveResult = "downloaded" | "shared";

export async function saveTextFile(
  content: string,
  fileName: string,
  mime: string,
): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    // 1) write into the app cache (no storage permission needed)
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    // 2) hand the file to the system share sheet (save / send / upload)
    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: fileName,
    });
    return "shared";
  }

  // ── Web path: browser download ──
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
