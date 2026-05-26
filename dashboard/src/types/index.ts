// ─── Dashboard Types ───

export interface BatchRecord {
  batchId: number;
  numIntents: number;
  totalGasUsed: string;
  estimatedIndividualGas: string;
  gasSaved: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface QueueSnapshot {
  currentSize: number;
  batchSize: number;
  progress: string;
  intents: QueuedIntent[];
}

export interface QueuedIntent {
  index: number;
  user: string;
  tokenIn: string;
  amountIn: string;
  action?: string;
  agentId?: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  relayerAddress: string;
  contractAddress: string;
  batchSize: number;
  uptime: number;
}

export interface GasDataPoint {
  time: string;
  batchGas: number;
  individualGas: number;
  gasSaved: number;
  batchId: number;
}

export interface IntentLog {
  id: number;
  action: string;
  amount: string;
  timestamp: number;
  agentId?: number;
}
