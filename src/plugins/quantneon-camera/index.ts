/**
 * QuantneonCamera Capacitor Plugin
 *
 * Custom Capacitor plugin that records Reels with the device camera,
 * runs on-device MLKit face-expression analysis, and triggers Quantneon
 * aura effects + Quantmail VIP Reward tokens when a sad/tired expression
 * is detected.
 */

import { registerPlugin } from "@capacitor/core";
import type { QuantneonCameraPlugin } from "./definitions";

const QuantneonCamera = registerPlugin<QuantneonCameraPlugin>(
  "QuantneonCamera",
  {
    web: () => import("./web").then((m) => new m.QuantneonCameraWeb()),
  },
);

export * from "./definitions";
export { QuantneonCamera };
