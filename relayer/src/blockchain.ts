// ─── Blockchain Layer — connects to AgentExecutor contract on local Hardhat ───

import { ethers } from "ethers";
import { UserIntent, BatchRecord } from "./types";

// AgentExecutor ABI (minimal — only what the relayer needs)
const AGENT_EXECUTOR_ABI = [
  "function batchCount() view returns (uint256)",
  "function batchExecute((uint256 agentId, string action, address user, address tokenIn, address tokenOut, uint256 amountIn, bytes metadata)[] calldata intents) external",
  "event BatchExecuted(uint256 indexed batchId, address indexed executor, uint256 numIntents, uint256 totalGasUsed, uint256 estimatedIndividualGas, uint256 gasSaved)",
  "event IntentProcessed(uint256 indexed batchId, uint256 indexed agentId, address indexed user, string action, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
];

export class BlockchainClient {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private batchHistory: BatchRecord[] = [];

  constructor(rpcUrl: string, privateKey: string, contractAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, AGENT_EXECUTOR_ABI, this.wallet);

    // Listen for BatchExecuted events
    this.contract.on(
      "BatchExecuted",
      (batchId: bigint, executor: string, numIntents: bigint, totalGasUsed: bigint, estimatedIndividualGas: bigint, gasSaved: bigint, event: any) => {
        const record: BatchRecord = {
          batchId: Number(batchId),
          numIntents: Number(numIntents),
          totalGasUsed: totalGasUsed.toString(),
          estimatedIndividualGas: estimatedIndividualGas.toString(),
          gasSaved: gasSaved.toString(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Date.now(),
        };
        this.batchHistory.push(record);
        console.log(
          `[OnChain] 📦 BatchExecuted #${record.batchId} | ` +
          `${record.numIntents} intents | gasSaved=${ethers.formatEther(gasSaved)} wei saved | ` +
          `tx=${record.txHash.slice(0, 10)}…`
        );
      }
    );

    this.contract.on(
      "IntentProcessed",
      (batchId: bigint, agentId: bigint, user: string, action: string, tokenIn: string, tokenOut: string, amountIn: bigint, amountOut: bigint) => {
        console.log(
          `[OnChain]   ↳ Intent #${batchId} — agent=${agentId} action=${action} user=${user.slice(0, 8)}… swap ${ethers.formatEther(amountIn)} → ${ethers.formatEther(amountOut)}`
        );
      }
    );

    console.log(`[Blockchain] Connected to ${rpcUrl}, contract=${contractAddress.slice(0, 10)}…`);
  }

  /** Submit a batch of user intents to the AgentExecutor contract */
  async submitBatch(intents: UserIntent[]): Promise<ethers.TransactionReceipt> {
    console.log(`[Blockchain] Submitting ${intents.length} intents to AgentExecutor…`);

    const tx = await this.contract.batchExecute(intents, {
      gasLimit: 5_000_000, // generous limit for batches up to 50
    });

    console.log(`[Blockchain] Tx sent: ${tx.hash.slice(0, 14)}… waiting for confirmation…`);
    const receipt = await tx.wait();
    console.log(`[Blockchain] ✅ Confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  /** Get current batch count from the contract */
  async getBatchCount(): Promise<number> {
    const count = await this.contract.batchCount();
    return Number(count);
  }

  /** Get batch history (from event listeners) */
  getBatchHistory(): BatchRecord[] {
    return this.batchHistory;
  }

  /** Get relayer wallet address */
  getAddress(): string {
    return this.wallet.address;
  }
}
