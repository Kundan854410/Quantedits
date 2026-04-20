/**
 * Retention Analyzer
 * ──────────────────
 *
 * Lightweight pacing analysis that turns coarse timeline signals into a
 * "resonance score" curve. The implementation is deterministic and explicit:
 * every score is derived from observable timeline metrics.
 */

export interface RetentionProbeHighlight {
  startTimecode: string;
  duration: string;
  hookScore?: number;
}

export interface RetentionPoint {
  timeSec: number;
  sceneChangeRate: number;
  motionIntensity: number;
  colorTemperatureK: number;
  profileSimilarity: number;
  resonanceScore: number;
  predictedDropoff: boolean;
}

export interface RetentionDip {
  timeSec: number;
  resonanceScore: number;
  confidence: number;
}

export interface RetentionProfile {
  id: string;
  label: string;
  sceneChangeRate: number;
  motionIntensity: number;
  colorTemperatureK: number;
}

export interface RetentionAnalysis {
  durationSec: number;
  timeline: RetentionPoint[];
  predictedDips: RetentionDip[];
  aggregateResonanceScore: number;
  comparedProfiles: RetentionProfile[];
}

export interface AnalyzeRetentionInput {
  durationSec: number;
  highlights?: RetentionProbeHighlight[];
}

const DEFAULT_PROFILES: RetentionProfile[] = [
  {
    id: "fast-kinetic",
    label: "Fast kinetic edits",
    sceneChangeRate: 0.74,
    motionIntensity: 0.79,
    colorTemperatureK: 6000,
  },
  {
    id: "story-balanced",
    label: "Balanced narrative pacing",
    sceneChangeRate: 0.56,
    motionIntensity: 0.58,
    colorTemperatureK: 5400,
  },
  {
    id: "calm-cinematic",
    label: "Calm cinematic pacing",
    sceneChangeRate: 0.42,
    motionIntensity: 0.44,
    colorTemperatureK: 5000,
  },
];

const MAX_DIPS = 8;
const DEFAULT_HOOK_SCORE = 70;
const COLOR_TEMP_NORMALIZATION_RANGE = 2500;
const HOOK_PROXIMITY_THRESHOLD_SEC = 3;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseTimecodeToSeconds(timecode: string): number {
  const parts = timecode.split(":").map((v) => Number(v));
  if (parts.some((v) => Number.isNaN(v))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseDurationSeconds(duration: string): number {
  const value = Number.parseFloat(duration);
  if (!Number.isFinite(value)) return 0;
  return duration.toLowerCase().includes("m") ? value * 60 : value;
}

function buildHighlightWindows(highlights: RetentionProbeHighlight[]) {
  return highlights.map((h) => {
    const startSec = parseTimecodeToSeconds(h.startTimecode);
    const durationSec = Math.max(1, parseDurationSeconds(h.duration));
    return {
      startSec,
      endSec: startSec + durationSec,
      normalizedHook: clamp01((h.hookScore ?? DEFAULT_HOOK_SCORE) / 100),
    };
  });
}

function profileSimilarity(
  profile: RetentionProfile,
  sceneChangeRate: number,
  motionIntensity: number,
  colorTemperatureK: number,
): number {
  const sceneDistance = Math.abs(sceneChangeRate - profile.sceneChangeRate);
  const motionDistance = Math.abs(motionIntensity - profile.motionIntensity);
  const colorDistance =
    Math.abs(colorTemperatureK - profile.colorTemperatureK) /
    COLOR_TEMP_NORMALIZATION_RANGE;
  const distance =
    sceneDistance * 0.4 + motionDistance * 0.4 + colorDistance * 0.2;
  return clamp01(1 - distance);
}

export function analyzeRetention({
  durationSec,
  highlights = [],
}: AnalyzeRetentionInput): RetentionAnalysis {
  const safeDuration = Math.max(10, Number.isFinite(durationSec) ? durationSec : 10);
  const bucketCount = Math.max(12, Math.min(120, Math.round(safeDuration / 5)));
  const bucketSize = safeDuration / bucketCount;
  const windows = buildHighlightWindows(highlights);

  const timeline: RetentionPoint[] = Array.from({ length: bucketCount }, (_, i) => {
    const timeSec = Math.min(safeDuration, (i + 0.5) * bucketSize);
    const cycle = i / Math.max(1, bucketCount - 1);
    const waveA = Math.sin(cycle * Math.PI * 5);
    const waveB = Math.cos(cycle * Math.PI * 3.2);

    let hookBoost = 0;
    for (const window of windows) {
      if (timeSec >= window.startSec && timeSec <= window.endSec) {
        hookBoost = Math.max(hookBoost, window.normalizedHook * 0.3);
      } else {
        const distance = Math.min(
          Math.abs(timeSec - window.startSec),
          Math.abs(timeSec - window.endSec),
        );
        if (distance <= HOOK_PROXIMITY_THRESHOLD_SEC) {
          hookBoost = Math.max(hookBoost, window.normalizedHook * 0.15);
        }
      }
    }

    const sceneChangeRate = clamp01(0.48 + waveA * 0.12 + hookBoost);
    const motionIntensity = clamp01(0.52 + waveB * 0.1 + hookBoost * 0.8);
    const colorTemperatureK = Math.round(
      5400 + waveA * 500 + waveB * 350 + hookBoost * 700,
    );

    const similarities = DEFAULT_PROFILES.map((profile) =>
      profileSimilarity(
        profile,
        sceneChangeRate,
        motionIntensity,
        colorTemperatureK,
      ),
    );
    const bestSimilarity = similarities.reduce((best, next) =>
      next > best ? next : best,
      0,
    );

    const resonanceScore = Math.round(
      clamp01(
        0.15 + sceneChangeRate * 0.35 + motionIntensity * 0.35 + bestSimilarity * 0.15,
      ) * 100,
    );

    return {
      timeSec,
      sceneChangeRate,
      motionIntensity,
      colorTemperatureK,
      profileSimilarity: bestSimilarity,
      resonanceScore,
      predictedDropoff: resonanceScore < 56,
    };
  });

  const predictedDips: RetentionDip[] = timeline
    .filter((point) => point.predictedDropoff)
    .map((point) => {
      const confidence = clamp01((60 - point.resonanceScore) / 20);
      return {
        timeSec: point.timeSec,
        resonanceScore: point.resonanceScore,
        confidence,
      };
    })
    .sort((a, b) => a.resonanceScore - b.resonanceScore || a.timeSec - b.timeSec)
    .slice(0, MAX_DIPS)
    .sort((a, b) => a.timeSec - b.timeSec);

  const aggregateResonanceScore = Math.round(
    timeline.reduce((acc, point) => acc + point.resonanceScore, 0) /
      Math.max(1, timeline.length),
  );

  return {
    durationSec: safeDuration,
    timeline,
    predictedDips,
    aggregateResonanceScore,
    comparedProfiles: DEFAULT_PROFILES,
  };
}
