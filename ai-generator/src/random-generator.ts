// ─── Deterministic Random Intent Generator ───
// No API key needed — produces varied swap intents for offline demo.

import { UserIntent, IntentAction } from "./types";

// Hardcoded addresses (matching local Hardhat deployment)
const TOKEN_A = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TOKEN_B = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const USER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** Simulated market conditions that influence intent generation */
interface MarketState {
  tokenAPrice: number;       // USD
  tokenBPrice: number;       // USD
  volatility: number;        // 0-1
  trend: "up" | "down" | "sideways";
  imbalance: number;         // -1 to 1 (negative = TokenA heavy, positive = TokenB heavy)
}

export class RandomGenerator {
  private marketState: MarketState;
  private intentCount = 0;

  constructor() {
    this.marketState = {
      tokenAPrice: 1.0 + Math.random() * 0.5,
      tokenBPrice: 1.0 + Math.random() * 0.5,
      volatility: 0.2,
      trend: "sideways",
      imbalance: 0,
    };
  }

  /** Simulate market evolution (random walk) */
  private tickMarket(): void {
    const drift = (Math.random() - 0.5) * this.marketState.volatility * 0.1;
    this.marketState.tokenAPrice = Math.max(0.1, this.marketState.tokenAPrice + drift);

    // Trend shifts periodically
    if (Math.random() < 0.1) {
      const trends: ("up" | "down" | "sideways")[] = ["up", "down", "sideways"];
      this.marketState.trend = trends[Math.floor(Math.random() * 3)];
    }

    // Volatility spikes occasionally
    if (Math.random() < 0.05) {
      this.marketState.volatility = Math.min(1, this.marketState.volatility + Math.random() * 0.5);
    } else {
      this.marketState.volatility = Math.max(0.05, this.marketState.volatility * 0.95);
    }

    this.marketState.imbalance = (Math.random() - 0.5) * 2;
  }

  /** Generate a single intent based on the current strategy */
  generate(strategy: string): UserIntent {
    this.tickMarket();
    this.intentCount++;

    const amount = this.generateAmount();

    switch (strategy) {
      case "momentum":
        return this.momentumIntent(amount);
      case "arbitrage":
        return this.arbitrageIntent(amount);
      case "dca":
        return this.dcaIntent(amount);
      case "weighted":
      default:
        return this.weightedIntent(amount);
    }
  }

  /** Generate a batch of N intents */
  generateBatch(count: number, strategy: string): UserIntent[] {
    return Array.from({ length: count }, () => this.generate(strategy));
  }

  // ── Strategy Implementations ────────────────────────────

  /** Weighted random: mixes all strategies with configurable probabilities */
  private weightedIntent(amount: string): UserIntent {
    const roll = Math.random();
    let action: IntentAction = "swap";

    if (roll < 0.55) action = "swap";
    else if (roll < 0.70) action = "dca";
    else if (roll < 0.85) action = "rebalance";
    else if (roll < 0.95) action = "compound";
    else action = "arbitrage";

    return this.buildIntent(action, amount);
  }

  /** Momentum: follows the trend aggressively */
  private momentumIntent(amount: string): UserIntent {
    const { trend } = this.marketState;
    // If trend is up, buy TokenB (swap A→B). If down, sell (B→A).
    const buyAggressive = trend === "up";
    return this.buildIntent(
      "swap",
      amount,
      buyAggressive ? TOKEN_A : TOKEN_B,
      buyAggressive ? TOKEN_B : TOKEN_A
    );
  }

  /** Arbitrage: exploits price differences between tokens */
  private arbitrageIntent(amount: string): UserIntent {
    const ratio = this.marketState.tokenAPrice / Math.max(0.01, this.marketState.tokenBPrice);
    // If ratio deviates from 1.0 by > 5%, arbitrage
    const arbAmount = String(BigInt(amount) * 3n); // arbitrage uses 3x size
    if (ratio > 1.05) {
      return this.buildIntent("arbitrage", arbAmount, TOKEN_A, TOKEN_B);
    } else if (ratio < 0.95) {
      return this.buildIntent("arbitrage", arbAmount, TOKEN_B, TOKEN_A);
    }
    return this.buildIntent("swap", amount); // no arb opportunity, just swap
  }

  /** DCA: steady small buys regardless of market */
  private dcaIntent(_amount: string): UserIntent {
    // DCA amounts are always small (0.01 - 0.5 tokens)
    const dcaAmount = String(BigInt(Math.floor(Math.random() * 50) + 1) * 10n ** 16n);
    // Alternate direction to simulate periodic buying
    const direction = this.intentCount % 3 === 0 ? TOKEN_B : TOKEN_A;
    const opposite = direction === TOKEN_A ? TOKEN_B : TOKEN_A;
    return this.buildIntent("dca", dcaAmount, direction, opposite);
  }

  // ── Helpers ─────────────────────────────────────────────

  private buildIntent(
    action: IntentAction,
    amount: string,
    tokenIn = TOKEN_A,
    tokenOut = TOKEN_B
  ): UserIntent {
    return {
      agentId: 0,
      action,
      user: USER,
      tokenIn,
      tokenOut,
      amountIn: amount,
      metadata: "0x",
    };
  }

  private generateAmount(): string {
    // Random amount between 0.01 and 50 tokens (in wei)
    const tokens = Math.random() * 50 + 0.01;
    return String(BigInt(Math.floor(tokens * 1e18)));
  }

  /** Get current market snapshot (for console logging / front-end) */
  getMarketState(): MarketState {
    return { ...this.marketState };
  }
}
