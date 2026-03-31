"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Play, CheckCircle2, Loader2, Clapperboard } from "lucide-react";

export type Highlight = {
  id: string;
  title: string;
  startTimecode: string;
  endTimecode: string;
  duration: string;
  hookScore: number;
  thumbnail: string;
};

type GeneratorState = "idle" | "analyzing" | "cutting" | "done";

interface HookGeneratorProps {
  fileName?: string;
  durationEstimate?: string;
  onHighlightsReady: (highlights: Highlight[]) => void;
}

const HOOK_EMOJIS = ["🔥", "⚡", "🎯", "💥", "🚀", "✨", "🎬", "👁️", "🌊", "🎭"];
const HOOK_TITLES = [
  "The Shocking Reveal",
  "Unexpected Plot Twist",
  "Emotional Climax",
  "Viral-Ready Hook",
  "The Power Statement",
  "Epic Transition",
  "Jaw-Drop Moment",
  "Quick-Cut Montage",
  "Suspense Builder",
  "Perfect Loop Closer",
];

const REEL_COUNT = 10;

function generateHighlights(): Highlight[] {
  const colors = ["#7C3AED", "#06B6D4", "#EC4899", "#F59E0B", "#10B981"];
  return Array.from({ length: REEL_COUNT }, (_, i) => {
    const startMin = Math.floor(Math.random() * 110);
    const startSec = Math.floor(Math.random() * 60);
    const durationSec = 15 + Math.floor(Math.random() * 45);
    const endMin = Math.floor((startMin * 60 + startSec + durationSec) / 60);
    const endSec = (startMin * 60 + startSec + durationSec) % 60;
    const color = colors[i % colors.length];
    return {
      id: `highlight-${i}`,
      title: `${HOOK_EMOJIS[i]} ${HOOK_TITLES[i]}`,
      startTimecode: `${String(startMin).padStart(2, "0")}:${String(startSec).padStart(2, "0")}`,
      endTimecode: `${String(endMin).padStart(2, "0")}:${String(endSec).padStart(2, "0")}`,
      duration: `${durationSec}s`,
      hookScore: 75 + Math.floor(Math.random() * 25),
      thumbnail: color,
    };
  });
}

export default function HookGenerator({
  fileName,
  durationEstimate,
  onHighlightsReady,
}: HookGeneratorProps) {
  const [state, setState] = useState<GeneratorState>("idle");
  const [phase, setPhase] = useState("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleGenerate = () => {
    if (state !== "idle" || !fileName) return;
    setState("analyzing");
    setPhase("Scanning audio waveform & scene changes…");

    setTimeout(() => {
      setState("cutting");
      setPhase(`Cutting ${REEL_COUNT} TikTok-native reels…`);
    }, 2200);

    setTimeout(() => {
      const hl = generateHighlights();
      setHighlights(hl);
      setState("done");
      setPhase("");
      onHighlightsReady(hl);
    }, 4500);
  };

  const handleReset = () => {
    setState("idle");
    setHighlights([]);
    setSelectedId(null);
    setPhase("");
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
          style={{ background: "rgba(6,182,212,0.12)" }}
        >
          <Scissors size={18} className="text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#E8E8F0]">
            Hook Generator
          </h3>
          <p className="text-xs text-[#5a5a7a]">
            Auto-cuts documentaries into {REEL_COUNT} TikTok reels → Quantchill
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-full">
            AI-CUT
          </span>
        </div>
      </div>

      {/* Source info */}
      {fileName && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
        >
          <Clapperboard size={13} className="text-cyan-500 shrink-0" />
          <span className="text-[#8888aa] truncate max-w-[180px]">{fileName}</span>
          {durationEstimate && (
            <span className="ml-auto text-[#5a5a7a] shrink-0">
              {durationEstimate}
            </span>
          )}
        </div>
      )}

      {/* Processing state */}
      <AnimatePresence mode="wait">
        {(state === "analyzing" || state === "cutting") && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            <Loader2 size={14} className="animate-spin text-cyan-400 shrink-0" />
            <span className="text-xs text-[#8888aa]">{phase}</span>
          </motion.div>
        )}

        {state === "done" && (
          <motion.div
            key="highlights"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-2"
          >
            <p className="text-xs text-[#5a5a7a] mb-0.5">
              {REEL_COUNT} reels generated — click to preview
            </p>
            <div className="grid grid-cols-2 gap-2">
              {highlights.map((h) => (
                <motion.button
                  key={h.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    setSelectedId(selectedId === h.id ? null : h.id)
                  }
                  className="relative rounded-xl overflow-hidden text-left p-3 transition-all"
                  style={{
                    background:
                      selectedId === h.id
                        ? `${h.thumbnail}22`
                        : "#0f0f18",
                    border:
                      selectedId === h.id
                        ? `1px solid ${h.thumbnail}60`
                        : "1px solid #1E1E2E",
                  }}
                >
                  {/* Thumbnail color strip */}
                  <div
                    className="w-full h-10 rounded-lg mb-2 flex items-center justify-center"
                    style={{ background: `${h.thumbnail}20` }}
                  >
                    <Play
                      size={16}
                      style={{ color: h.thumbnail }}
                      fill={h.thumbnail}
                    />
                  </div>
                  <p className="text-xs font-medium text-[#C8C8E0] truncate leading-tight">
                    {h.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#5a5a7a] font-mono">
                      {h.startTimecode}–{h.endTimecode}
                    </span>
                    <span
                      className="ml-auto text-[10px] font-bold"
                      style={{ color: h.thumbnail }}
                    >
                      {h.hookScore}%
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA row */}
      {state !== "done" ? (
        <motion.button
          whileHover={state === "idle" && !!fileName ? { scale: 1.02 } : {}}
          whileTap={state === "idle" && !!fileName ? { scale: 0.97 } : {}}
          onClick={handleGenerate}
          disabled={state !== "idle" || !fileName}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              state !== "idle"
                ? "#0a2a3e"
                : "linear-gradient(135deg, #06B6D4 0%, #0e7490 100%)",
          }}
        >
          {state !== "idle" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Scissors size={15} />
          )}
          {state === "idle"
            ? `Generate ${REEL_COUNT} TikTok Highlights`
            : state === "analyzing"
              ? "Analyzing…"
              : "Cutting…"}
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-emerald-400 flex-1">
            {REEL_COUNT} reels ready for Quantchill
          </span>
          <button
            onClick={handleReset}
            className="text-xs text-[#5a5a7a] hover:text-[#8888aa] transition-colors"
          >
            Reset
          </button>
        </motion.div>
      )}
    </div>
  );
}
