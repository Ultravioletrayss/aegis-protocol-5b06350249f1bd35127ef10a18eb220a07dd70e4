// ═══════════════════════════════════════════════════════════
//  Aegis Protocol — Off-chain Relayer (Express Server)
//  Receives AI intents → queues → batches → submits on-chain
// ═══════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import cors from "cors";
import { IntentQueue } from "./queue";
import { BlockchainClient } from "./blockchain";
import { UserIntent } from "./types";

// ─── Config ───────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3001", 10);
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACT_ADDR = process.env.AGENT_EXECUTOR_ADDRESS || "";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);

// ─── Blockchain Client ────────────────────────────────────
const blockchain = new BlockchainClient(RPC_URL, PRIVATE_KEY, CONTRACT_ADDR);

// ─── Intent Queue ─────────────────────────────────────────
const queue = new IntentQueue(BATCH_SIZE, async (batch: UserIntent[]) => {
  await blockchain.submitBatch(batch);
});

// ─── Express App ──────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ---- Health Check ----------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "aegis-relayer",
    relayerAddress: blockchain.getAddress(),
    contractAddress: CONTRACT_ADDR,
    batchSize: BATCH_SIZE,
    uptime: process.uptime(),
  });
});

// ---- Submit Intent (called by AI generator or front-end) --
app.post("/intent", (req, res) => {
  try {
    const { agentId, action, user, tokenIn, tokenOut, amountIn, metadata } = req.body;

    if (!user || !tokenIn || !amountIn || !action) {
      return res.status(400).json({
        error: "Missing required fields: action, user, tokenIn, amountIn",
      });
    }

    const intent: UserIntent = {
      agentId: agentId || 0,
      action: action || "swap",
      user,
      tokenIn,
      tokenOut: tokenOut || "0x0000000000000000000000000000000000000000",
      amountIn,
      metadata: metadata || "0x",
    };
    const position = queue.enqueue(intent);

    return res.status(202).json({
      status: "accepted",
      message: `Intent queued at position ${position}/${BATCH_SIZE}`,
      position,
      batchSize: BATCH_SIZE,
    });
  } catch (err: any) {
    console.error("[API] Error processing intent:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---- View Queue ------------------------------------------
app.get("/queue", (_req, res) => {
  res.json(queue.getSnapshot());
});

// ---- Force Flush (submit whatever is in queue) -----------
app.post("/queue/flush", async (_req, res) => {
  await queue.flush();
  res.json({ status: "flushed", ...queue.getSnapshot() });
});

// ---- Batch History (from on-chain events) ----------------
app.get("/batches", (_req, res) => {
  res.json({
    count: blockchain.getBatchHistory().length,
    batches: blockchain.getBatchHistory(),
  });
});

// ---- Get contract batch count (on-chain query) -----------
app.get("/batches/count", async (_req, res) => {
  try {
    const count = await blockchain.getBatchCount();
    res.json({ batchCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║         Aegis Protocol — Relayer Service             ║
╠══════════════════════════════════════════════════════╣
║  Status:    Running                                  ║
║  Port:      ${String(PORT).padEnd(41)}║
║  RPC:       ${(RPC_URL || "").slice(0, 37).padEnd(41)}║
║  Contract:  ${CONTRACT_ADDR.slice(0, 37).padEnd(41)}║
║  Batch:     ${String(BATCH_SIZE).padEnd(41)}║
║  Relayer:   ${blockchain.getAddress().slice(0, 37).padEnd(41)}║
╚══════════════════════════════════════════════════════╝

  Endpoints:
    POST /intent          — Submit an AI-generated swap intent
    GET  /queue           — View current intent queue
    POST /queue/flush     — Force-submit queued intents
    GET  /batches         — View on-chain batch history
    GET  /batches/count   — Get total batches from contract
    GET  /health          — Service health check
`);
});
