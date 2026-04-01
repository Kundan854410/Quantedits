"use client";

import { motion } from "framer-motion";
import type { Highlight } from "./HookGenerator";

interface TimelineProps {
  highlights: Highlight[];
  fileName?: string;
}

const TRACK_COLORS = ["#7C3AED", "#06B6D4", "#EC4899", "#F59E0B", "#10B981"];

export default function Timeline({ highlights, fileName }: TimelineProps) {
  if (!fileName) {
    return (
      <div
        className="h-full flex flex-col"
        style={{ background: "#0D0D11" }}
      >
        {/* Track labels */}
        <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: "#1E1E2E" }}>
          <span className="text-xs text-[#3a3a5a] font-mono">TIMELINE</span>
          <span className="text-xs text-[#2a2a4a] ml-auto">No sequence loaded</span>
        </div>
        {/* Empty tracks */}
        <div className="flex-1 flex flex-col gap-px p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <span className="text-[10px] text-[#2a2a4a] font-mono w-12 shrink-0 text-right">
                V{i}
              </span>
              <div
                className="flex-1 h-6 rounded"
                style={{ background: "#0f0f18", border: "1px solid #1a1a2e" }}
              />
            </div>
          ))}
        </div>
        {/* Timecode ruler */}
        <div
          className="h-6 flex items-center px-16 gap-0 border-t"
          style={{ borderColor: "#1E1E2E" }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="flex-1 border-l flex items-end pb-1"
              style={{ borderColor: "#1E1E2E" }}
            >
              <span className="text-[9px] text-[#2a2a4a] font-mono pl-0.5">
                {String(i * 10).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "#0D0D11" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "#1E1E2E" }}
      >
        <span className="text-xs text-[#5a5a7a] font-mono">TIMELINE</span>
        {highlights.length > 0 && (
          <span className="text-xs text-cyan-500">
            {highlights.length} hooks detected
          </span>
        )}
        <span className="ml-auto text-[10px] text-[#3a3a5a] font-mono truncate max-w-[200px]">
          {fileName}
        </span>
      </div>

      {/* Tracks */}
      <div className="flex-1 flex flex-col gap-px p-3 overflow-hidden">
        {/* Source video track */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#5a5a7a] font-mono w-12 shrink-0 text-right">
            SRC
          </span>
          <div
            className="flex-1 h-8 rounded flex items-center px-3"
            style={{
              background: "linear-gradient(90deg, #7C3AED22 0%, #7C3AED11 100%)",
              border: "1px solid #7C3AED30",
            }}
          >
            <span className="text-[10px] text-purple-400 font-mono truncate">
              {fileName}
            </span>
          </div>
        </div>

        {/* Hook tracks */}
        {highlights.length > 0 ? (
          <div className="flex-1 relative overflow-hidden">
            {/* Background ruler grid */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: "repeat(12, 1fr)",
                backgroundImage:
                  "linear-gradient(to right, #1a1a2e 1px, transparent 1px)",
                backgroundSize: "8.33% 100%",
              }}
            />
            {/* Highlight clips */}
            <div className="relative h-full flex flex-col gap-1 py-1">
              {highlights.slice(0, 5).map((h, i) => {
                // Parse timecodes to get position percentages (assume 120min total)
                const parts = h.startTimecode.split(":");
                const sm = parts.length === 2 ? Number(parts[0]) : 0;
                const ss = parts.length === 2 ? Number(parts[1]) : 0;
                const startSec = (isNaN(sm) ? 0 : sm) * 60 + (isNaN(ss) ? 0 : ss);
                const durSec = parseInt(h.duration);
                const totalSec = 120 * 60;
                const left = (startSec / totalSec) * 100;
                const width = Math.max((durSec / totalSec) * 100, 1.5);
                const color = TRACK_COLORS[i % TRACK_COLORS.length];
                return (
                  <div key={h.id} className="flex items-center gap-2 flex-1">
                    <span className="text-[10px] text-[#3a3a5a] font-mono w-12 shrink-0 text-right">
                      T{i + 1}
                    </span>
                    <div className="flex-1 relative h-6">
                      <motion.div
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: i * 0.12, duration: 0.4 }}
                        style={{
                          position: "absolute",
                          left: `${left}%`,
                          width: `${width}%`,
                          height: "100%",
                          background: `${color}30`,
                          border: `1px solid ${color}60`,
                          borderRadius: "4px",
                          transformOrigin: "left",
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-1 rounded-l"
                          style={{ background: color }}
                        />
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-[#2a2a4a]">
              Run Hook Generator to populate tracks
            </span>
          </div>
        )}
      </div>

      {/* Timecode ruler */}
      <div
        className="h-6 flex items-center px-16 border-t shrink-0"
        style={{ borderColor: "#1E1E2E" }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex-1 border-l flex items-end pb-1"
            style={{ borderColor: "#1E1E2E" }}
          >
            <span className="text-[9px] text-[#2a2a4a] font-mono pl-0.5">
              {String(i * 10).padStart(2, "0")}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
