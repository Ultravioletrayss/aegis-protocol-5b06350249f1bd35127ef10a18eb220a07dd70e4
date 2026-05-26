// ─── Shared Types for Aegis Relayer ───

/** Supported intent actions */
export type IntentAction = "swap" | "transfer" | "dca" | "compound" | "rebalance" | "arbitrage";

/** A single AI-generated user intent (mirrors AgentExecutor.UserIntent) */
export interface UserIntent {
  /** Agent ID from AgentRegistry (0 = unregistered) */
  agentId: number;
  /** Action type */
  action: IntentAction;
  /** Address of the intent owner */
  user: string;
  /** Token address to swap FROM */
  tokenIn: string;
  /** Token address to swap TO (or recipient for transfer) */
  tokenOut: string;
  /** Amount of tokenIn (in wei) */
  amountIn: string;
  /** Extensible metadata (hex-encoded) */
  metadata: string;
}

/** A batch that has been submitted on-chain */
export interface BatchRecord {
  /** On-chain batch ID from AgentExecutor */
  batchId: number;
  /** Number of intents in this batch */
  numIntents: number;
  /** Actual gas used */
  totalGasUsed: string;
  /** Estimated gas if individual txs */
  estimatedIndividualGas: string;
  /** Gas saved */
  gasSaved: string;
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp */
  timestamp: number;
}
