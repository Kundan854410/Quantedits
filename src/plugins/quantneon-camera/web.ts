/**
 * Web fallback implementation of the QuantneonCamera plugin.
 *
 * On web, we use the MediaDevices API for camera access and a placeholder
 * for expression analysis (MLKit is native-only). This allows the app to
 * degrade gracefully in a browser.
 */

import { WebPlugin } from "@capacitor/core";
import type {
  QuantneonCameraPlugin,
  StartRecordingOptions,
  RecordingResult,
  AuraConfig,
  ExpressionAnalysisResult,
  FacialExpression,
} from "./definitions";

export class QuantneonCameraWeb
  extends WebPlugin
  implements QuantneonCameraPlugin
{
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recordingStartTime = 0;
  private expressionSnapshots: ExpressionAnalysisResult[] = [];
  private auraConfig: AuraConfig = {
    glowColor: "#7C3AED",
    intensity: 0.8,
    pulseHz: 1.2,
  };

  async startRecording(options?: StartRecordingOptions): Promise<void> {
    const facing = options?.facing ?? "front";
    const facingMode = facing === "front" ? "user" : "environment";

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: true,
    });

    this.recordedChunks = [];
    this.expressionSnapshots = [];
    this.recordingStartTime = Date.now();

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // collect data every second

    // Simulate periodic expression analysis on web (placeholder)
    if (options?.enableExpressionAnalysis !== false) {
      this.simulateExpressionAnalysis();
    }
  }

  async stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error("No active recording session");
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: "video/webm" });
        const videoUri = URL.createObjectURL(blob);
        const durationSec = (Date.now() - this.recordingStartTime) / 1000;

        // Check if any sad/tired expressions were detected
        const sadOrTired = this.expressionSnapshots.some(
          (s) =>
            (s.expression === "sad" || s.expression === "tired") &&
            s.confidence > 0.6,
        );

        // Clean up the media stream
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;

        resolve({
          videoUri,
          durationSec,
          expressionSnapshots: this.expressionSnapshots,
          auraApplied: sadOrTired,
          rewardDispatched: sadOrTired,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  async configureAura(config: AuraConfig): Promise<void> {
    this.auraConfig = { ...this.auraConfig, ...config };
  }

  async analyzeExpression(): Promise<ExpressionAnalysisResult> {
    // Web fallback: return a neutral expression since MLKit isn't available
    console.warn(
      "[QuantneonCamera] Expression analysis requires native MLKit. " +
        "Returning placeholder result on web.",
    );
    return {
      expression: "neutral",
      confidence: 0.5,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulates expression analysis on web for development/testing.
   * In production native builds, MLKit handles this on-device.
   */
  private simulateExpressionAnalysis(): void {
    const expressions: FacialExpression[] = [
      "happy",
      "sad",
      "tired",
      "surprised",
      "neutral",
      "angry",
    ];

    const interval = setInterval(() => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
        clearInterval(interval);
        return;
      }

      const expression =
        expressions[Math.floor(Math.random() * expressions.length)];
      const result: ExpressionAnalysisResult = {
        expression,
        confidence: 0.5 + Math.random() * 0.5,
        timestamp: new Date().toISOString(),
      };

      this.expressionSnapshots.push(result);
      this.notifyListeners("expressionChanged", result);

      // Trigger aura + reward for sad/tired on web (simulation)
      if (
        (expression === "sad" || expression === "tired") &&
        result.confidence > 0.6
      ) {
        this.notifyListeners("auraApplied", { expression });
        this.notifyListeners("rewardDispatched", {
          tokenId: `web-sim-${Date.now()}`,
          expression,
        });
      }
    }, 2000);
  }
}
