"use client";

import type { AutoHookSuggestion } from "@/services/AutoHook";
import type { RetentionAnalysis } from "@/services/RetentionAnalyzer";

export interface CreatorDashboardProps {
  analysis: RetentionAnalysis | null;
  suggestions: AutoHookSuggestion[];
}

const MIN_BAR_HEIGHT = 8;
const RESONANCE_HEIGHT_SCALE = 0.9;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const min = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function toneClass(severity: AutoHookSuggestion["severity"]): string {
  if (severity === "aggressive") {
    return "border-rose-400/40 bg-rose-500/10 text-rose-200";
  }
  if (severity === "moderate") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan-400/40 bg-cyan-500/10 text-cyan-200";
}

export default function CreatorDashboard({
  analysis,
  suggestions,
}: CreatorDashboardProps) {
  return (
    <section
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: "#1E1E2E", background: "#13131A" }}
    >
      <header className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
        <h3 className="text-sm font-semibold text-[#E8E8F0]">
          Creator Dashboard — Resonance Timeline
        </h3>
        {analysis && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/30 bg-cyan-500/10">
            score {analysis.aggregateResonanceScore}
          </span>
        )}
      </header>

      {!analysis ? (
        <p className="text-xs text-[#6f6f95]">
          Drop a file and run Hook Generator to project pacing resonance and
          retention dips.
        </p>
      ) : (
        <>
          <div className="grid gap-2 rounded-xl border border-[#232338] bg-[#0f0f18] p-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#5a5a7a]">
              <span>Physiological impact overlay</span>
              <span>{analysis.timeline.length} samples</span>
            </div>
            <div className="h-24 w-full rounded-lg border border-[#1E1E2E] bg-[#0b0b13] p-1 flex items-end gap-[2px]">
              {analysis.timeline.map((point) => {
                const height = Math.max(
                  MIN_BAR_HEIGHT,
                  Math.round(point.resonanceScore * RESONANCE_HEIGHT_SCALE),
                );
                const dip = point.predictedDropoff;
                return (
                  <div
                    key={`${point.timeSec}-${point.resonanceScore}`}
                    title={`${formatTime(point.timeSec)} • Resonance ${point.resonanceScore}`}
                    className="relative flex-1 rounded-[2px]"
                    style={{
                      height: `${height}%`,
                      background: dip
                        ? "linear-gradient(180deg,#fb7185,#be123c)"
                        : "linear-gradient(180deg,#67e8f9,#0e7490)",
                      opacity: dip ? 0.95 : 0.82,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#5a5a7a]">
              <span>00:00</span>
              <span>{formatTime(analysis.durationSec)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] text-[#9b9bc0]">
            <div className="rounded-lg border border-[#1E1E2E] bg-[#0f0f18] px-2 py-1.5">
              <div className="text-[#5a5a7a] uppercase tracking-wider text-[10px]">
                Predicted dips
              </div>
              <div className="text-[#fda4af] font-semibold">
                {analysis.predictedDips.length}
              </div>
            </div>
            <div className="rounded-lg border border-[#1E1E2E] bg-[#0f0f18] px-2 py-1.5">
              <div className="text-[#5a5a7a] uppercase tracking-wider text-[10px]">
                Avg. profile match
              </div>
              <div className="text-[#a5f3fc] font-semibold">
                {Math.round(
                  analysis.timeline.reduce(
                    (acc, point) => acc + point.profileSimilarity,
                    0,
                  ) *
                    (100 / Math.max(1, analysis.timeline.length)),
                )}
                %
              </div>
            </div>
            <div className="rounded-lg border border-[#1E1E2E] bg-[#0f0f18] px-2 py-1.5">
              <div className="text-[#5a5a7a] uppercase tracking-wider text-[10px]">
                Hook interventions
              </div>
              <div className="text-[#86efac] font-semibold">{suggestions.length}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {suggestions.length === 0 ? (
              <p className="text-xs text-[#6f6f95]">
                No auto-hooks required right now. Pacing appears stable across
                the analyzed timeline.
              </p>
            ) : (
              suggestions.map((suggestion) => (
                <article
                  key={suggestion.id}
                  className={`rounded-xl border px-3 py-2 text-xs ${toneClass(suggestion.severity)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {formatTime(suggestion.targetTimeSec)}
                    </span>
                    <span className="uppercase tracking-widest text-[10px] opacity-80">
                      {suggestion.severity}
                    </span>
                    <span className="ml-auto text-[10px] opacity-90">
                      +{suggestion.expectedLift} resonance
                    </span>
                  </div>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                    {suggestion.adjustments.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
