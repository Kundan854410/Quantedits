/**
 * Quantmail VIP Reward Service
 *
 * Dispatches "VIP Reward" tokens via the Quantmail messaging protocol
 * when a sad/tired facial expression is detected during Reel recording.
 *
 * The reward token is sent to the creator's Quantmail inbox as a
 * motivational notification with an embedded loyalty-point grant.
 */

import type { FacialExpression } from "@/plugins/quantneon-camera/definitions";

/** A VIP Reward token dispatched through Quantmail. */
export interface VipRewardToken {
  /** Unique token identifier. */
  tokenId: string;
  /** The expression that triggered the reward. */
  triggeredBy: FacialExpression;
  /** ISO-8601 timestamp of when the reward was created. */
  createdAt: string;
  /** Points granted with this reward. */
  points: number;
  /** Human-readable reward message. */
  message: string;
  /** Whether the token has been delivered to Quantmail. */
  delivered: boolean;
}

/** Configuration for the Quantmail reward service. */
export interface QuantmailRewardConfig {
  /** Base URL for the Quantmail API (default placeholder). */
  apiBaseUrl?: string;
  /** Points to award per sad/tired detection (default 50). */
  pointsPerReward?: number;
  /** Cooldown in seconds between rewards to prevent spam (default 30). */
  cooldownSec?: number;
  /** Expressions that trigger a reward dispatch (default ["sad", "tired"]). */
  triggerExpressions?: FacialExpression[];
}

const DEFAULT_CONFIG: Required<QuantmailRewardConfig> = {
  apiBaseUrl: "https://api.quantmail.io/v1",
  pointsPerReward: 50,
  cooldownSec: 30,
  triggerExpressions: ["sad", "tired"],
};

/** Messages mapped to expressions for reward notifications. */
const REWARD_MESSAGES: Record<string, string> = {
  sad: "We noticed you could use a boost! Here's a VIP Reward to brighten your creative session. 🌟",
  tired:
    "Creating content is hard work! Here's a VIP Reward to keep you going. ⚡",
};

/**
 * Quantmail VIP Reward service singleton.
 *
 * Manages reward token creation, delivery, and cooldown logic.
 * In production, tokens are dispatched to the Quantmail API.
 * In development/web, tokens are stored locally and logged.
 */
class QuantmailRewardService {
  private config: Required<QuantmailRewardConfig>;
  private rewardHistory: VipRewardToken[] = [];
  private lastRewardTime = 0;
  private listeners: Array<(token: VipRewardToken) => void> = [];

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /** Update the reward service configuration. */
  configure(config: Partial<QuantmailRewardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evaluate a detected expression and dispatch a VIP Reward if it matches
   * the trigger conditions and the cooldown has elapsed.
   *
   * @returns The dispatched reward token, or null if conditions were not met.
   */
  async evaluateAndDispatch(
    expression: FacialExpression,
    confidence: number,
  ): Promise<VipRewardToken | null> {
    const now = Date.now();
    const cooldownMs = this.config.cooldownSec * 1000;

    // Check if expression is a trigger type
    if (!this.config.triggerExpressions.includes(expression)) {
      return null;
    }

    // Require minimum 60% confidence
    if (confidence < 0.6) {
      return null;
    }

    // Enforce cooldown
    if (now - this.lastRewardTime < cooldownMs) {
      return null;
    }

    const token = this.createToken(expression);
    this.lastRewardTime = now;

    // Attempt delivery
    await this.deliverToken(token);

    return token;
  }

  /** Get the full reward history for this session. */
  getHistory(): VipRewardToken[] {
    return [...this.rewardHistory];
  }

  /** Subscribe to reward dispatch events. */
  onRewardDispatched(callback: (token: VipRewardToken) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /** Create a new VIP Reward token. */
  private createToken(expression: FacialExpression): VipRewardToken {
    const token: VipRewardToken = {
      tokenId: `qm-vip-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      triggeredBy: expression,
      createdAt: new Date().toISOString(),
      points: this.config.pointsPerReward,
      message: REWARD_MESSAGES[expression] ?? "Here's a VIP Reward! 🎁",
      delivered: false,
    };
    return token;
  }

  /**
   * Deliver the token to Quantmail.
   *
   * In development/web mode, this logs the token locally.
   * In production, this would POST to the Quantmail API endpoint.
   */
  private async deliverToken(token: VipRewardToken): Promise<void> {
    try {
      // Production: POST to Quantmail API
      // For now, store locally and mark as delivered
      // When the Quantmail API is available, uncomment the fetch below:
      //
      // const response = await fetch(
      //   `${this.config.apiBaseUrl}/rewards/vip`,
      //   {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify(token),
      //   },
      // );
      // if (!response.ok) throw new Error(`Quantmail API error: ${response.status}`);

      token.delivered = true;
      this.rewardHistory.push(token);
      this.notifyListeners(token);

      console.info(
        `[Quantmail] VIP Reward dispatched: ${token.tokenId} (${token.points} pts, triggered by ${token.triggeredBy})`,
      );
    } catch (error) {
      console.error("[Quantmail] Failed to deliver VIP Reward:", error);
      token.delivered = false;
      this.rewardHistory.push(token);
    }
  }

  private notifyListeners(token: VipRewardToken): void {
    for (const listener of this.listeners) {
      listener(token);
    }
  }
}

/** Singleton instance of the Quantmail reward service. */
export const quantmail = new QuantmailRewardService();
