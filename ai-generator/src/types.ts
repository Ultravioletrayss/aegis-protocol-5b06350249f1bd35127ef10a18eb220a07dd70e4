// ─── Shared Types for AI Intent Generator ───

/** Supported intent actions */
export type IntentAction = "swap" | "transfer" | "dca" | "compound" | "rebalance" | "arbitrage";

/** A single AI-generated user intent (matches relayer POST /intent schema) */
export interface UserIntent {
  agentId: number;
  action: IntentAction;
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;   // wei string
  metadata: string;   // hex-encoded
}

/** An AI agent persona that generates intents */
export interface AgentPersona {
  id: number;
  name: string;
  strategy: string;
  riskProfile: "conservative" | "moderate" | "aggressive";
  description: string;
}

/** Strategy configuration */
export interface GeneratorConfig {
  mode: "random" | "llm" | "hybrid";
  intervalMs: number;
  batchBurst: number;
  strategy: "weighted" | "momentum" | "arbitrage" | "dca";
  relayerUrl: string;
}
