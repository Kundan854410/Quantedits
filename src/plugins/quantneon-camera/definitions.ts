/**
 * Type definitions for the QuantneonCamera Capacitor plugin.
 *
 * These types are consumed by the TypeScript web layer, the native iOS
 * (Swift) bridge, and the native Android (Kotlin) bridge.
 */

/** Facial expression categories detected by MLKit. */
export type FacialExpression =
  | "happy"
  | "sad"
  | "tired"
  | "surprised"
  | "neutral"
  | "angry";

/** Result returned after face-expression analysis completes on a frame. */
export interface ExpressionAnalysisResult {
  /** Dominant detected expression. */
  expression: FacialExpression;
  /** Confidence score 0-1. */
  confidence: number;
  /** ISO-8601 timestamp of the analysis. */
  timestamp: string;
}

/** Options for starting a reel recording session. */
export interface StartRecordingOptions {
  /** Maximum duration in seconds (default 60). */
  maxDurationSec?: number;
  /** Camera facing direction (default "front"). */
  facing?: "front" | "back";
  /** Whether to enable real-time expression analysis (default true). */
  enableExpressionAnalysis?: boolean;
}

/** Result returned when recording stops. */
export interface RecordingResult {
  /** Local file URI of the recorded reel. */
  videoUri: string;
  /** Duration in seconds. */
  durationSec: number;
  /** All expression snapshots captured during recording. */
  expressionSnapshots: ExpressionAnalysisResult[];
  /** Whether a Quantneon aura was applied. */
  auraApplied: boolean;
  /** Whether a Quantmail VIP Reward was dispatched. */
  rewardDispatched: boolean;
}

/** Quantneon aura configuration. */
export interface AuraConfig {
  /** Glow colour hex (default "#7C3AED" – brand purple). */
  glowColor?: string;
  /** Glow intensity 0-1 (default 0.8). */
  intensity?: number;
  /** Pulsation speed in Hz (default 1.2). */
  pulseHz?: number;
}

/** Plugin interface exposed to the web layer. */
export interface QuantneonCameraPlugin {
  /**
   * Start recording a Reel with the native camera.
   * Expression analysis runs in real-time on-device via MLKit.
   */
  startRecording(options?: StartRecordingOptions): Promise<void>;

  /**
   * Stop the current recording and return results including expression
   * snapshots and whether aura/reward were triggered.
   */
  stopRecording(): Promise<RecordingResult>;

  /**
   * Configure the Quantneon aura visual effect that is overlaid when a
   * sad/tired expression is detected.
   */
  configureAura(config: AuraConfig): Promise<void>;

  /**
   * Manually trigger expression analysis on a single captured frame.
   * Used primarily for testing/debug.
   */
  analyzeExpression(): Promise<ExpressionAnalysisResult>;

  /**
   * Register a listener for real-time expression changes during recording.
   */
  addListener(
    eventName: "expressionChanged",
    callback: (result: ExpressionAnalysisResult) => void,
  ): Promise<{ remove: () => void }>;

  /**
   * Register a listener for when a Quantneon aura is applied.
   */
  addListener(
    eventName: "auraApplied",
    callback: (data: { expression: FacialExpression }) => void,
  ): Promise<{ remove: () => void }>;

  /**
   * Register a listener for when a Quantmail VIP Reward is dispatched.
   */
  addListener(
    eventName: "rewardDispatched",
    callback: (data: { tokenId: string; expression: FacialExpression }) => void,
  ): Promise<{ remove: () => void }>;
}
