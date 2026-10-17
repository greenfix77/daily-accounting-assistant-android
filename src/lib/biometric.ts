/**
 * Local biometric unlock (fingerprint / device biometry) — dual adapter.
 *
 * - APK / native (Capacitor): uses @capgo/capacitor-native-biometric, i.e. the
 *   Android system BiometricPrompt backed by the device's secure hardware.
 *   A random secret is anchored in the Android Keystore via setCredentials()
 *   as a local "registration" marker.
 * - Web (browser preview / PWA): WebAuthn platform authenticator — works in
 *   Android Chrome, iOS Safari, Windows Hello.
 *
 * Both paths live behind the same 5 functions; no server involvement and no
 * data ever leaves the device (offline-first privacy model).
 */

import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

const STORAGE_KEY = "bio-cred-id";
const BIO_SERVER = "hesabyar-reyra";

// ── base64url helpers (ArrayBuffer ⇄ string) ─────────────────
function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ── capability detection ─────────────────────────────────────
/** Basic platform support (sync): native Capacitor or WebAuthn-capable web. */
export function biometricSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return true;
  if (!window.isSecureContext) return false;
  const pk = (window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: unknown } })
    .PublicKeyCredential;
  return !!pk && typeof pk.isUserVerifyingPlatformAuthenticatorAvailable === "function";
}

/** Deep availability probe (async): hardware/biometry actually present? */
export async function biometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable({ useFallback: false });
      return !!res.isAvailable;
    } catch {
      return false;
    }
  }
  if (!biometricSupported()) return false;
  try {
    return await (window.PublicKeyCredential as {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean>;
    }).isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function biometricRegistered(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

// ── register / authenticate / remove ─────────────────────────
/**
 * Registers the device biometry as the app-lock method.
 * Native: one confirmation BiometricPrompt, then anchors a random secret in
 * the Android Keystore. Web: creates a user-verified platform credential.
 */
export async function biometricRegister(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable({ useFallback: false });
      if (!res.isAvailable) return false;
      // Confirm identity once so enabling the feature requires the biometry
      await NativeBiometric.verifyIdentity({
        title: "ورود با اثر انگشت",
        subtitle: "حساب یار ری را",
        reason: "برای فعال‌سازی قفل اثر انگشت، هویت خود را تأیید کنید",
        negativeButtonText: "لغو",
        useFallback: false,
        maxAttempts: 3,
      });
      // Anchor a device-local secret in secure storage (Keystore-backed)
      const secret = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer);
      await NativeBiometric.setCredentials({
        username: "reyra-unlock",
        password: secret,
        server: BIO_SERVER,
      });
      window.localStorage.setItem(STORAGE_KEY, "native-keystore");
      return true;
    } catch {
      return false;
    }
  }

  // ── Web path (WebAuthn) ──
  if (!biometricSupported()) return false;
  // fail fast when no platform authenticator exists — otherwise the
  // credentials.create() request may hang until its timeout
  if (!(await biometricAvailable())) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "حساب یار ری را" },
      user: { id: userId, name: "local-unlock", displayName: "App unlock" },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred || !cred.rawId) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, b64urlEncode(cred.rawId));
  } catch {
    return false;
  }
  return true;
}

/** Prompts the device biometry; resolves true on a user-verified unlock. */
export async function biometricAuthenticate(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!biometricRegistered()) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable({ useFallback: false });
      if (!res.isAvailable) return false;
      await NativeBiometric.verifyIdentity({
        title: "باز کردن قفل برنامه",
        subtitle: "حساب یار ری را",
        reason: "اثر انگشت خود را برای ورود قرار دهید",
        negativeButtonText: "لغو",
        useFallback: false,
        maxAttempts: 3,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Web path (WebAuthn) ──
  if (!biometricSupported()) return false;
  const idB64 = window.localStorage.getItem(STORAGE_KEY);
  if (!idB64) return false;
  // fail fast when no platform authenticator exists — otherwise the
  // credentials.get() request may hang until its timeout
  if (!(await biometricAvailable())) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: b64urlDecode(idB64), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  return !!assertion;
}

export function biometricRemove(): void {
  if (typeof window === "undefined") return;
  if (Capacitor.isNativePlatform()) {
    NativeBiometric.deleteCredentials({ server: BIO_SERVER }).catch(() => {
      /* best-effort */
    });
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
