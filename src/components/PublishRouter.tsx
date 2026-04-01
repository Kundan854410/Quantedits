"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  CheckCircle2,
  Loader2,
  Tv2,
  Wind,
  Megaphone,
  AlertCircle,
} from "lucide-react";
import type { Highlight } from "./HookGenerator";

type PlatformState = "idle" | "uploading" | "done" | "error";

interface Platform {
  id: "quanttube" | "quantchill" | "quantads";
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  format: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "quanttube",
    name: "Quanttube",
    subtitle: "Long-form · 4K HDR",
    icon: <Tv2 size={16} />,
    color: "#EF4444",
    format: "16:9 · H.264",
  },
  {
    id: "quantchill",
    name: "Quantchill",
    subtitle: "Short-form loop · Reels",
    icon: <Wind size={16} />,
    color: "#06B6D4",
    format: "9:16 · TikTok",
  },
  {
    id: "quantads",
    name: "Quantads",
    subtitle: "Promotional library",
    icon: <Megaphone size={16} />,
    color: "#F59E0B",
    format: "1:1 · 15s / 30s",
  },
];

interface PublishRouterProps {
  fileName?: string;
  highlights: Highlight[];
}

export default function PublishRouter({
  fileName,
  highlights,
}: PublishRouterProps) {
  const [platformStates, setPlatformStates] = useState<
    Record<string, PlatformState>
  >({ quanttube: "idle", quantchill: "idle", quantads: "idle" });
  const [publishAll, setPublishAll] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [progress, setProgress] = useState<Record<string, number>>({
    quanttube: 0,
    quantchill: 0,
    quantads: 0,
  });

  const hasContent = !!fileName;

  const simulateUpload = (
    platformId: string,
    delayMs: number,
    onComplete: () => void
  ) => {
    setTimeout(() => {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 15 + 5;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
          setPlatformStates((prev) => ({ ...prev, [platformId]: "done" }));
          onComplete();
        }
        setProgress((prev) => ({ ...prev, [platformId]: Math.min(p, 100) }));
      }, 200);
    }, delayMs);
  };

  const handlePublishAll = () => {
    if (!hasContent || publishAll !== "idle") return;
    setPublishAll("running");
    setPlatformStates({ quanttube: "uploading", quantchill: "uploading", quantads: "uploading" });
    setProgress({ quanttube: 0, quantchill: 0, quantads: 0 });

    // Track completions directly — no polling needed
    let completedCount = 0;
    const onComplete = () => {
      completedCount += 1;
      if (completedCount === PLATFORMS.length) {
        setPublishAll("done");
      }
    };

    simulateUpload("quanttube", 0, onComplete);
    simulateUpload("quantchill", 300, onComplete);
    simulateUpload("quantads", 600, onComplete);
  };

  const handleReset = () => {
    setPublishAll("idle");
    setPlatformStates({ quanttube: "idle", quantchill: "idle", quantads: "idle" });
    setProgress({ quanttube: 0, quantchill: 0, quantads: 0 });
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(236,72,153,0.12)" }}
        >
          <Send size={18} className="text-pink-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#E8E8F0]">
            Publish Router
          </h3>
          <p className="text-xs text-[#5a5a7a]">
            One-click publish to all platforms simultaneously
          </p>
        </div>
        {highlights.length > 0 && (
          <div className="ml-auto">
            <span className="text-xs font-mono text-pink-400 bg-pink-950/40 px-2 py-0.5 rounded-full">
              {highlights.length} clips
            </span>
          </div>
        )}
      </div>

      {/* Platform tiles */}
      <div className="flex flex-col gap-2.5">
        {PLATFORMS.map((platform) => {
          const pState = platformStates[platform.id];
          const pProgress = progress[platform.id] ?? 0;
          return (
            <motion.div
              key={platform.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background:
                  pState === "done"
                    ? `${platform.color}0f`
                    : "#0f0f18",
                border:
                  pState === "done"
                    ? `1px solid ${platform.color}30`
                    : "1px solid #1E1E2E",
              }}
              animate={{ opacity: 1 }}
            >
              {/* Platform icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${platform.color}15`,
                  color: platform.color,
                }}
              >
                {platform.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#E8E8F0]">
                    {platform.name}
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: `${platform.color}15`,
                      color: platform.color,
                    }}
                  >
                    {platform.format}
                  </span>
                </div>
                <p className="text-[11px] text-[#5a5a7a]">{platform.subtitle}</p>

                {/* Progress bar */}
                <AnimatePresence>
                  {pState === "uploading" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-1.5 overflow-hidden"
                    >
                      <div className="w-full h-1 rounded-full bg-[#1a1a2e] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: platform.color,
                            width: `${pProgress}%`,
                          }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status indicator */}
              <div className="shrink-0 flex items-center">
                {pState === "idle" && (
                  <span className="w-2 h-2 rounded-full bg-[#2a2a3e]" />
                )}
                {pState === "uploading" && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                    style={{ color: platform.color }}
                  />
                )}
                {pState === "done" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </motion.div>
                )}
                {pState === "error" && (
                  <AlertCircle size={16} className="text-red-400" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Publish CTA */}
      <AnimatePresence mode="wait">
        {publishAll === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-emerald-400 flex-1">
              Published to all 3 platforms!
            </span>
            <button
              onClick={handleReset}
              className="text-xs text-[#5a5a7a] hover:text-[#8888aa] transition-colors"
            >
              Reset
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="cta"
            whileHover={hasContent && publishAll === "idle" ? { scale: 1.02 } : {}}
            whileTap={hasContent && publishAll === "idle" ? { scale: 0.97 } : {}}
            onClick={handlePublishAll}
            disabled={!hasContent || publishAll === "running"}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                publishAll === "running"
                  ? "#2a0a2e"
                  : "linear-gradient(135deg, #EC4899 0%, #7C3AED 50%, #06B6D4 100%)",
            }}
          >
            {publishAll === "running" ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Send size={15} />
                Publish to All Platforms
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
