"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Mic, CheckCircle2, Loader2, Languages } from "lucide-react";

const LANGUAGE_SAMPLES = [
  "🇺🇸 English",
  "🇪🇸 Spanish",
  "🇫🇷 French",
  "🇩🇪 German",
  "🇯🇵 Japanese",
  "🇰🇷 Korean",
  "🇧🇷 Portuguese",
  "🇷🇺 Russian",
  "🇨🇳 Chinese",
  "🇮🇳 Hindi",
  "🇸🇦 Arabic",
  "🇮🇹 Italian",
  "🇳🇱 Dutch",
  "🇹🇷 Turkish",
  "🇵🇱 Polish",
];

type DubState = "idle" | "processing" | "done";

interface DeepDubProps {
  fileName?: string;
}

export default function DeepDub({ fileName }: DeepDubProps) {
  const [dubState, setDubState] = useState<DubState>("idle");
  const [progress, setProgress] = useState(0);
  const [completedLangs, setCompletedLangs] = useState<number>(0);
  const TOTAL_LANGS = 150;

  const handleDub = () => {
    if (dubState !== "idle") return;
    setDubState("processing");
    setProgress(0);
    setCompletedLangs(0);

    // Simulate progressive dubbing
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 8 + 3;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setDubState("done");
        setCompletedLangs(TOTAL_LANGS);
      } else {
        setCompletedLangs(Math.floor((current / 100) * TOTAL_LANGS));
      }
      setProgress(Math.min(current, 100));
    }, 180);
  };

  const handleReset = () => {
    setDubState("idle");
    setProgress(0);
    setCompletedLangs(0);
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
          style={{ background: "rgba(124,58,237,0.15)" }}
        >
          <Languages size={18} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#E8E8F0]">Deep-Dub</h3>
          <p className="text-xs text-[#5a5a7a]">
            1-click audio translation into 150 languages
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded-full">
            AI-SYNC
          </span>
        </div>
      </div>

      {/* Language grid preview */}
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGE_SAMPLES.map((lang, i) => (
          <motion.span
            key={lang}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            className="text-xs px-2 py-1 rounded-md"
            style={{
              background:
                dubState === "done" &&
                i < Math.floor((completedLangs / TOTAL_LANGS) * LANGUAGE_SAMPLES.length)
                  ? "rgba(124,58,237,0.25)"
                  : "#1a1a2e",
              color:
                dubState === "done" &&
                i < Math.floor((completedLangs / TOTAL_LANGS) * LANGUAGE_SAMPLES.length)
                  ? "#a78bfa"
                  : "#5a5a7a",
              border:
                dubState === "done" &&
                i < Math.floor((completedLangs / TOTAL_LANGS) * LANGUAGE_SAMPLES.length)
                  ? "1px solid rgba(124,58,237,0.4)"
                  : "1px solid #1E1E2E",
            }}
          >
            {lang}
          </motion.span>
        ))}
        <span className="text-xs px-2 py-1 rounded-md text-[#3a3a5a] bg-[#1a1a2e] border border-[#1E1E2E]">
          +135 more
        </span>
      </div>

      {/* Progress bar */}
      <AnimatePresence>
        {dubState === "processing" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs text-[#8888aa]">
                <Loader2 size={12} className="animate-spin text-purple-400" />
                <span>
                  Dubbing {completedLangs}/{TOTAL_LANGS} languages…
                </span>
              </div>
              <span className="text-xs font-mono text-purple-400">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)",
                  width: `${progress}%`,
                }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action row */}
      <div className="flex items-center gap-3 mt-1">
        {dubState === "done" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 flex-1"
          >
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-emerald-400">
              {TOTAL_LANGS} language dubs ready
            </span>
            <button
              onClick={handleReset}
              className="ml-auto text-xs text-[#5a5a7a] hover:text-[#8888aa] transition-colors"
            >
              Reset
            </button>
          </motion.div>
        ) : (
          <>
            <motion.button
              whileHover={dubState === "idle" ? { scale: 1.02 } : {}}
              whileTap={dubState === "idle" ? { scale: 0.97 } : {}}
              onClick={handleDub}
              disabled={dubState === "processing" || !fileName}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background:
                  dubState === "processing"
                    ? "#2a1a4e"
                    : "linear-gradient(135deg, #7C3AED 0%, #4c1d95 100%)",
              }}
            >
              {dubState === "processing" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Mic size={15} />
              )}
              {dubState === "processing" ? "Dubbing…" : "Deep-Dub 150 Languages"}
            </motion.button>

            <div className="flex items-center gap-1.5 text-xs text-[#5a5a7a]">
              <Globe size={12} />
              <span>
                {fileName ? (
                  <span className="text-[#8888aa] max-w-[100px] truncate block">
                    {fileName}
                  </span>
                ) : (
                  "No file loaded"
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
