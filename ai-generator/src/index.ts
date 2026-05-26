// ═══════════════════════════════════════════════════════════
//  Aegis Protocol — AI Intent Generator (Orchestrator)
//  Generates swap intents via 4 strategies, sends to Relayer.
//  Modes: random (offline) | llm (DeepSeek V4) | hybrid
// ═══════════════════════════════════════════════════════════

import "dotenv/config";
import { RandomGenerator } from "./random-generator";
import { LLMClient } from "./llm-client";
import { UserIntent, GeneratorConfig } from "./types";

// ─── Config ───────────────────────────────────────────────
const config: GeneratorConfig = {
  mode: (process.env.MODE as "random" | "llm" | "hybrid") || "random",
  intervalMs: parseInt(process.env.INTERVAL_MS || "800", 10),
  batchBurst: parseInt(process.env.BATCH_BURST || "5", 10),
  strategy: (process.env.STRATEGY as GeneratorConfig["strategy"]) || "weighted",
  relayerUrl: process.env.RELAYER_URL || "http://localhost:3001",
};

// CLI override: --mode llm
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith("--mode=")) {
    config.mode = arg.split("=")[1] as GeneratorConfig["mode"];
  }
  if (arg.startsWith("--strategy=")) {
    config.strategy = arg.split("=")[1] as GeneratorConfig["strategy"];
  }
}

// ─── Components ───────────────────────────────────────────
const randomGen = new RandomGenerator();

const llmClient = config.mode !== "random"
  ? new LLMClient(
      process.env.DEEPSEEK_API_KEY || "",
      process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      process.env.DEEPSEEK_MODEL || "deepseek-chat"
    )
  : null;

// ─── Statistics ───────────────────────────────────────────
const stats = {
  totalGenerated: 0,
  totalSubmitted: 0,
  failedSubmissions: 0,
  startTime: Date.now(),
  actionBreakdown: {} as Record<string, number>,
};

// ─── Core Loop ────────────────────────────────────────────

async function generateIntents(count: number): Promise<UserIntent[]> {
  if (config.mode === "llm" && llmClient) {
    console.log(`[AI] 🤖 Calling DeepSeek V4 for ${count} intents…`);
    return llmClient.generateBatch(count);
  }

  if (config.mode === "hybrid" && llmClient && Math.random() < 0.3) {
    // 30% chance of LLM in hybrid mode
    console.log(`[AI] 🎲 Hybrid: using DeepSeek for this burst`);
    return llmClient.generateBatch(count);
  }

  // Default: deterministic random
  console.log(`[AI] 🎲 Generating ${count} intents (strategy: ${config.strategy})…`);
  return randomGen.generateBatch(count, config.strategy);
}

async function submitIntent(intent: UserIntent): Promise<boolean> {
  try {
    const res = await fetch(`${config.relayerUrl}/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    const data: any = await res.json();
    stats.totalSubmitted++;
    stats.actionBreakdown[intent.action] = (stats.actionBreakdown[intent.action] || 0) + 1;

    // Compact log
    const amountEth = (Number(BigInt(intent.amountIn)) / 1e18).toFixed(4);
    console.log(
      `  ✅ [#${stats.totalSubmitted}] ${intent.action.padEnd(10)} ${amountEth.padStart(8)} tokens → ${data.message}`
    );
    return true;
  } catch (err: any) {
    stats.failedSubmissions++;
    console.error(`  ❌ Submit failed: ${err.message}`);
    return false;
  }
}

async function runBurst(): Promise<void> {
  const intents = await generateIntents(config.batchBurst);
  stats.totalGenerated += intents.length;

  for (const intent of intents) {
    await submitIntent(intent);
    // Small delay between individual submissions within a burst
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function printStatus(): Promise<void> {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const market = randomGen.getMarketState();

  console.log(`\n${"─".repeat(55)}`);
  console.log(`📊 Status | ${elapsed}s elapsed | ${stats.totalGenerated} generated | ${stats.totalSubmitted} submitted | ${stats.failedSubmissions} failed`);
  console.log(`   Market: TokenA=$${market.tokenAPrice.toFixed(4)} TokenB=$${market.tokenBPrice.toFixed(4)} | volatility=${(market.volatility * 100).toFixed(0)}% trend=${market.trend}`);
  console.log(`   Actions:`, Object.entries(stats.actionBreakdown).map(([k, v]) => `${k}=${v}`).join(" | "));
  console.log(`${"─".repeat(55)}\n`);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     Aegis Protocol — AI Intent Generator            ║
╠══════════════════════════════════════════════════════╣
║  Mode:      ${config.mode.padEnd(42)}║
║  Strategy:  ${config.strategy.padEnd(42)}║
║  Interval:  ${String(config.intervalMs + "ms").padEnd(42)}║
║  Burst:     ${String(config.batchBurst).padEnd(42)}║
║  Relayer:   ${config.relayerUrl.padEnd(42)}║
╚══════════════════════════════════════════════════════╝

Press Ctrl+C to stop.
`);

  // Status report every 10 seconds
  const statusInterval = setInterval(printStatus, 10_000);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    clearInterval(statusInterval);
    console.log("\n\n🛑 Shutting down…");
    await printStatus();
    process.exit(0);
  });

  // Main generation loop
  while (true) {
    await runBurst();
    await new Promise((r) => setTimeout(r, config.intervalMs));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
