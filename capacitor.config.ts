import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.reyra.hesabyar",
  appName: "حساب یار ری را",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  server: {
    // Serve the exported SPA from the https scheme so IndexedDB persists reliably
    androidScheme: "https",
  },
};

export default config;
