import type { RetentionAnalysis, RetentionDip } from "./RetentionAnalyzer";

export interface AutoHookSuggestion {
  id: string;
  targetTimeSec: number;
  dipTimeSec: number;
  severity: "gentle" | "moderate" | "aggressive";
  expectedLift: number;
  adjustments: string[];
  rationale: string;
}

function classifyDip(dip: RetentionDip): AutoHookSuggestion["severity"] {
  if (dip.resonanceScore < 45 || dip.confidence > 0.85) return "aggressive";
  if (dip.resonanceScore < 52 || dip.confidence > 0.65) return "moderate";
  return "gentle";
}

function adjustmentsForSeverity(
  severity: AutoHookSuggestion["severity"],
): string[] {
  if (severity === "aggressive") {
    return [
      "Punch-in zoom for 8–12 frames",
      "Transient impact sound effect",
      "High-contrast color shift for 0.4s",
    ];
  }
  if (severity === "moderate") {
    return [
      "Subtle 103% zoom ramp",
      "Accent riser or whoosh",
      "Warm-to-cool tint shift on cut",
    ];
  }
  return [
    "Micro zoom keyframe (101–102%)",
    "Soft audio accent on transition",
    "Saturation pulse on focal subject",
  ];
}

function rationaleForSeverity(
  severity: AutoHookSuggestion["severity"],
  dip: RetentionDip,
): string {
  if (severity === "aggressive") {
    return `Predicted strong dip (${dip.resonanceScore}/100). Layering motion, sound and color changes immediately before this point is likely to recover attention quickly.`;
  }
  if (severity === "moderate") {
    return `Predicted medium dip (${dip.resonanceScore}/100). A coordinated visual + audio accent should improve continuity and reduce viewer drop-off.`;
  }
  return `Predicted light dip (${dip.resonanceScore}/100). A small micro-adjustment can smooth pacing without over-editing the sequence.`;
}

export function generateAutoHooks(
  analysis: RetentionAnalysis,
): AutoHookSuggestion[] {
  return analysis.predictedDips.map((dip, index) => {
    const severity = classifyDip(dip);
    const expectedLift =
      severity === "aggressive" ? 12 : severity === "moderate" ? 8 : 5;
    return {
      id: `auto-hook-${index + 1}`,
      targetTimeSec: Math.max(0, dip.timeSec - 2),
      dipTimeSec: dip.timeSec,
      severity,
      expectedLift,
      adjustments: adjustmentsForSeverity(severity),
      rationale: rationaleForSeverity(severity, dip),
    };
  });
}
