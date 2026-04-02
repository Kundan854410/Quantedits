import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quantedits.app",
  appName: "Quantedits",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Camera: {
      // Use QuantneonCamera for reel recording with face detection
    },
  },
};

export default config;
