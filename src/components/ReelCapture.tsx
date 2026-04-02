"use client";

/**
 * ReelCapture component
 *
 * Provides a UI for recording Reels with the QuantneonCamera plugin.
 * Displays real-time facial expression analysis, Quantneon aura status,
 * and Quantmail VIP Reward notifications.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  StopCircle,
  Sparkles,
  Gift,
  AlertCircle,
  Smile,
  Frown,
  Moon,
  Zap,
  Meh,
} from "lucide-react";
import { useReelCapture } from "@/hooks/useReelCapture";
import type { FacialExpression } from "@/plugins/quantneon-camera/definitions";

/** Map expression to icon + label. */
const EXPRESSION_META: Record<
  FacialExpression,
  { icon: typeof Smile; label: string; color: string }
> = {
  happy: { icon: Smile, label: "Happy", color: "#10B981" },
  sad: { icon: Frown, label: "Sad", color: "#6366F1" },
  tired: { icon: Moon, label: "Tired", color: "#8B5CF6" },
  surprised: { icon: Zap, label: "Surprised", color: "#F59E0B" },
  neutral: { icon: Meh, label: "Neutral", color: "#6B7280" },
  angry: { icon: AlertCircle, label: "Angry", color: "#EF4444" },
};

export default function ReelCapture() {
  const [state, actions] = useReelCapture();
  const {
    isRecording,
    currentExpression,
    auraState,
    rewards,
    lastResult,
    error,
  } = state;

  const exprMeta = currentExpression
    ? EXPRESSION_META[currentExpression.expression]
    : null;
  const ExprIcon = exprMeta?.icon ?? Meh;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid #1E1E2E" }}
      >
        <Camera size={14} className="text-[#7C3AED]" />
        <span className="text-xs font-semibold text-[#E8E8F0] uppercase tracking-wider">
          Reel Capture
        </span>
        <span className="text-[10px] text-[#5a5a7a] ml-auto">
          Quantneon + Quantmail
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Recording controls */}
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={() =>
                actions.startRecording({ facing: "front", maxDurationSec: 60 })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
                color: "#fff",
              }}
            >
              <Camera size={14} />
              Record Reel
            </button>
          ) : (
            <button
              onClick={() => actions.stopRecording()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "#EF4444",
                color: "#fff",
              }}
            >
              <StopCircle size={14} />
              Stop Recording
            </button>
          )}

          {isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-red-400 font-mono">REC</span>
            </motion.div>
          )}
        </div>

        {/* Real-time expression display */}
        <AnimatePresence>
          {currentExpression && isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{
                background: "#0D0D11",
                border: `1px solid ${exprMeta?.color ?? "#1E1E2E"}33`,
              }}
            >
              <ExprIcon size={16} style={{ color: exprMeta?.color }} />
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: exprMeta?.color }}
                >
                  {exprMeta?.label}
                </p>
                <p className="text-[10px] text-[#5a5a7a]">
                  Confidence:{" "}
                  {(currentExpression.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quantneon Aura status */}
        <AnimatePresence>
          {auraState.active && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: `${auraState.glowColor}15`,
                border: `1px solid ${auraState.glowColor}40`,
              }}
            >
              <Sparkles size={14} style={{ color: auraState.glowColor }} />
              <span
                className="text-xs font-semibold"
                style={{ color: auraState.glowColor }}
              >
                Quantneon Aura Active
              </span>
              <span className="text-[10px] text-[#5a5a7a] ml-auto">
                Triggered by {auraState.triggeredBy}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* VIP Reward notifications */}
        <AnimatePresence>
          {rewards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-1.5"
            >
              {rewards.slice(-3).map((reward) => (
                <div
                  key={reward.tokenId}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: "#F59E0B10",
                    border: "1px solid #F59E0B30",
                  }}
                >
                  <Gift size={14} className="text-amber-400" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-amber-300">
                      VIP Reward: +{reward.points} pts
                    </p>
                    <p className="text-[10px] text-[#5a5a7a]">
                      {reward.message}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last result summary */}
        {lastResult && !isRecording && (
          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: "#0D0D11",
              border: "1px solid #1E1E2E",
            }}
          >
            <p className="text-xs font-semibold text-[#E8E8F0] mb-1">
              Recording Complete
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[#5a5a7a]">
              <span>Duration: {lastResult.durationSec.toFixed(1)}s</span>
              <span>
                Expressions: {lastResult.expressionSnapshots.length} frames
              </span>
              <span>
                Aura: {lastResult.auraApplied ? "✅ Applied" : "—"}
              </span>
              <span>
                Reward: {lastResult.rewardDispatched ? "✅ Sent" : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: "#EF444415",
              border: "1px solid #EF444440",
            }}
          >
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-[11px] text-red-300">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
