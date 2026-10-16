import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reyra.hesabyar",
  appName: "حساب یار ری را",
  webDir: "out",
  android: {
    allowMixedContent: false,
    // Keep the WebView below the status bar and above the navigation bar
    // (Android 15+ enforces edge-to-edge; "force" applies system-bar insets
    // as WebView margins on every Android version — no-op where not needed).
    adjustMarginsForEdgeToEdge: "force",
  },
  server: {
    // Serve the exported SPA from the https scheme so IndexedDB persists reliably
    androidScheme: "https",
  },
};

export default config;
