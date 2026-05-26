/**
 * E2E Test: Submit 10 AI intents → Relayer batches → AgentExecutor on-chain
 *
 * Prerequisites:
 *   1. Hardhat node running (npx hardhat node)
 *   2. Contracts deployed (npx hardhat run scripts/deploy.ts --network localhost)
 *   3. Relayer running (cd relayer && npx ts-node src/index.ts)
 */

const RELAYER_URL = "http://localhost:3001";
const RELAYER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TOKEN_A = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TOKEN_B = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonResponse = any;

async function postIntent(index: number): Promise<JsonResponse> {
  const intent = {
    agentId: 0,
    action: "swap",
    user: RELAYER_ADDRESS,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B,
    amountIn: (100_000_000_000_000_000n * BigInt(index + 1)).toString(), // 0.1, 0.2, … 1.0 tokens
    metadata: "0x",
  };

  const res = await fetch(`${RELAYER_URL}/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intent),
  });

  const data: JsonResponse = await res.json();
  console.log(`[${index + 1}/10] POST /intent → ${data.status} | ${data.message}`);
  return data;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Aegis Protocol — E2E Batch Test");
  console.log("═══════════════════════════════════════════\n");

  // 1. Check health
  const health: JsonResponse = await fetch(`${RELAYER_URL}/health`).then((r) => r.json());
  console.log(`[Health] ${health.status} — relayer=${health.relayerAddress}\n`);

  // 2. Check current batch count
  const before: JsonResponse = await fetch(`${RELAYER_URL}/batches/count`).then((r) => r.json());
  console.log(`[Before] On-chain batch count: ${before.batchCount}\n`);

  // 3. Send 10 intents — the 10th should trigger automatic batch submission
  console.log("Sending 10 intents…\n");
  for (let i = 0; i < 10; i++) {
    await postIntent(i);
    // Small delay to allow async processing
    await new Promise((r) => setTimeout(r, 50));
  }

  // 4. Wait for batch to be mined
  console.log("\n⏳ Waiting for batch to be mined…");
  await new Promise((r) => setTimeout(r, 3000));

  // 5. Check queue (should be empty after batch)
  const queue: JsonResponse = await fetch(`${RELAYER_URL}/queue`).then((r) => r.json());
  console.log(`\n[Queue] ${queue.progress} intents remaining`);

  // 6. Check batch history
  const batches: JsonResponse = await fetch(`${RELAYER_URL}/batches`).then((r) => r.json());
  console.log(`[Batches] ${batches.count} batch(es) recorded:`);
  batches.batches.forEach((b: any) => {
    console.log(`  #${b.batchId} | ${b.numIntents} intents | gasSaved=${b.gasSaved} | tx=${b.txHash.slice(0, 14)}…`);
  });

  // 7. Verify on-chain
  const after: JsonResponse = await fetch(`${RELAYER_URL}/batches/count`).then((r) => r.json());
  console.log(`\n[After] On-chain batch count: ${after.batchCount}`);

  if (after.batchCount > before.batchCount && batches.count > 0) {
    console.log("\n✅ E2E TEST PASSED: Batch executed on-chain successfully!");
  } else {
    console.log("\n❌ E2E TEST FAILED: No batch detected on-chain.");
  }
}

main().catch(console.error);
