"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Gauge,
  Radar,
  Rocket,
  Scissors,
  Timer,
} from "lucide-react";
import type { PredictiveAssemblyPlan } from "@/services/AutoAssembler";
import type { PredictiveOptimizationReport } from "@/services/AlgoOptimizer";

interface PredictiveAssemblyPanelProps {
  plan: PredictiveAssemblyPlan | null;
  report: PredictiveOptimizationReport | null;
  sourceLabel?: string;
}

function renderMetricCard(
  label: string,
  value: string,
  accent: string,
  Icon: ComponentType<{ size?: number; className?: string }>,
) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon size={15} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#5a5a7a]">
            {label}
          </p>
          <p className="text-sm font-semibold text-[#E8E8F0]">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function PredictiveAssemblyPanel({
  plan,
  report,
  sourceLabel,
}: PredictiveAssemblyPanelProps) {
  if (!plan || !report) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.12)" }}
          >
            <Rocket size={18} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#E8E8F0]">
              Predictive Assembly Engine
            </h3>
            <p className="text-xs text-[#5a5a7a]">
              Upload footage to generate an autonomous first-pass edit.
            </p>
          </div>
        </div>
        <div
          className="rounded-xl px-4 py-5 text-sm text-[#8888aa]"
          style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
        >
          The engine will assemble a retention-focused cut, add hook overlays,
          and stage a ready-to-export preset as soon as source media is loaded.
        </div>
      </div>
    );
  }

  const exportRecommendation = report.exportRecommendation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(124,58,237,0.12)" }}
        >
          <Rocket size={18} className="text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#E8E8F0]">
            Predictive Assembly Engine
          </h3>
          <p className="text-xs text-[#5a5a7a]">
            {sourceLabel ? `${sourceLabel} · ` : ""}
            {report.readinessLabel}
          </p>
        </div>
        <span className="ml-auto text-[10px] font-mono text-violet-300 bg-violet-950/40 px-2 py-0.5 rounded-full">
          AUTO-PASS
        </span>
      </div>

      <div
        className="rounded-xl p-4"
        style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
      >
        <p className="text-sm text-[#C8C8E0] leading-6">{plan.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {renderMetricCard(
          "Retention score",
          `${report.retentionScore}%`,
          "#7C3AED",
          Gauge,
        )}
        {renderMetricCard(
          "Target runtime",
          `${plan.targetDurationSec}s`,
          "#06B6D4",
          Timer,
        )}
        {renderMetricCard(
          "Hook coverage",
          `${report.hookCoverageScore}%`,
          "#EC4899",
          Radar,
        )}
        {renderMetricCard(
          "Cut density",
          `${plan.jumpCutCadenceSec.toFixed(1)}s`,
          "#F59E0B",
          Scissors,
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <div
          className="rounded-xl p-4"
          style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-cyan-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5a5a7a]">
              Predicted checkpoints
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {report.checkpoints.map((checkpoint) => (
              <div key={checkpoint.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#E8E8F0]">
                    {checkpoint.label}
                  </p>
                  <span className="text-[11px] text-cyan-300">
                    {checkpoint.confidence}%
                  </span>
                </div>
                <p className="text-xs text-[#8888aa] leading-5">
                  {checkpoint.action}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: "#0f0f18", border: "1px solid #1E1E2E" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={14} className="text-emerald-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5a5a7a]">
              Zero-click export
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-[#C8C8E0]">
            <div className="flex items-center justify-between">
              <span>Preset</span>
              <span className="font-medium text-[#E8E8F0]">
                {String(exportRecommendation.resolution).toUpperCase()} ·{" "}
                {exportRecommendation.fps}fps
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Format</span>
              <span className="font-medium text-[#E8E8F0]">
                {exportRecommendation.format.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated size</span>
              <span className="font-medium text-[#E8E8F0]">
                {exportRecommendation.estimatedFileSizeMB.toFixed(1)} MB
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated export</span>
              <span className="font-medium text-[#E8E8F0]">
                {Math.ceil(exportRecommendation.estimatedExportTimeSec)}s
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#8888aa] leading-5">
            {exportRecommendation.note}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
