/**
 * Quantneon Aura Service
 *
 * Manages the glowing Quantneon aura effect applied to video frames when
 * a sad/tired facial expression is detected during Reel recording.
 */

import type { FacialExpression } from "@/plugins/quantneon-camera/definitions";

/** Aura effect state returned from the service. */
export interface AuraEffectState {
  active: boolean;
  glowColor: string;
  intensity: number;
  pulseHz: number;
  triggeredBy: FacialExpression | null;
  activatedAt: string | null;
}

/** Configuration for the Quantneon aura overlay. */
export interface QuantneonAuraConfig {
  glowColor?: string;
  intensity?: number;
  pulseHz?: number;
  /** Minimum confidence threshold to activate the aura (default 0.6). */
  confidenceThreshold?: number;
  /** Expressions that trigger the aura (default ["sad", "tired"]). */
  triggerExpressions?: FacialExpression[];
}

const DEFAULT_CONFIG: Required<QuantneonAuraConfig> = {
  glowColor: "#7C3AED",
  intensity: 0.8,
  pulseHz: 1.2,
  confidenceThreshold: 0.6,
  triggerExpressions: ["sad", "tired"],
};

/**
 * Quantneon aura service singleton.
 *
 * In native builds the actual glow shader is applied by the Swift/Kotlin
 * camera preview layer. This service coordinates the activation logic and
 * exposes state for the React UI overlay.
 */
class QuantneonService {
  private config: Required<QuantneonAuraConfig>;
  private state: AuraEffectState;
  private listeners: Array<(state: AuraEffectState) => void> = [];

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.state = {
      active: false,
      glowColor: this.config.glowColor,
      intensity: this.config.intensity,
      pulseHz: this.config.pulseHz,
      triggeredBy: null,
      activatedAt: null,
    };
  }

  /** Update the aura configuration. */
  configure(config: Partial<QuantneonAuraConfig>): void {
    this.config = { ...this.config, ...config };
    if (!this.state.active) {
      this.state.glowColor = this.config.glowColor;
      this.state.intensity = this.config.intensity;
      this.state.pulseHz = this.config.pulseHz;
    }
  }

  /**
   * Evaluate a detected expression and activate the aura if it matches
   * the trigger conditions.
   */
  evaluateExpression(
    expression: FacialExpression,
    confidence: number,
  ): boolean {
    const shouldActivate =
      this.config.triggerExpressions.includes(expression) &&
      confidence >= this.config.confidenceThreshold;

    if (shouldActivate && !this.state.active) {
      this.state = {
        active: true,
        glowColor: this.config.glowColor,
        intensity: this.config.intensity,
        pulseHz: this.config.pulseHz,
        triggeredBy: expression,
        activatedAt: new Date().toISOString(),
      };
      this.notifyListeners();
    }

    return shouldActivate;
  }

  /** Deactivate the aura effect. */
  deactivate(): void {
    this.state = {
      ...this.state,
      active: false,
      triggeredBy: null,
      activatedAt: null,
    };
    this.notifyListeners();
  }

  /** Get current aura state. */
  getState(): AuraEffectState {
    return { ...this.state };
  }

  /** Subscribe to aura state changes. */
  onStateChange(callback: (state: AuraEffectState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

/** Singleton instance of the Quantneon aura service. */
export const quantneon = new QuantneonService();
