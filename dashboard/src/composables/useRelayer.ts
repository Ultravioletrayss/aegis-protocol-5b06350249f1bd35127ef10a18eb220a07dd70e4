// ─── Relayer API composable ───
import { ref, onMounted, onUnmounted } from "vue";
import type { HealthStatus, QueueSnapshot, BatchRecord, IntentLog } from "../types";

const RELAYER_BASE = "/api";

export function useRelayer(onNewBatch?: (batch: BatchRecord) => void) {
  const health = ref<HealthStatus | null>(null);
  const queue = ref<QueueSnapshot>({ currentSize: 0, batchSize: 10, progress: "0/10", intents: [] });
  const batches = ref<BatchRecord[]>([]);
  const batchCount = ref(0);
  const intentLogs = ref<IntentLog[]>([]);
  const totalGasSaved = ref("0");
  const avgGasSaved = ref("0");
  const totalIntents = ref(0);
  const connected = ref(false);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let logCounter = 0;
  let prevBatchLen = 0;
  let ready = false; // skip initial batch-trigger for existing data

  async function fetchHealth(): Promise<void> {
    try {
      const res = await fetch(`${RELAYER_BASE}/health`);
      health.value = await res.json();
      connected.value = health.value?.status === "ok";
    } catch {
      connected.value = false;
    }
  }

  async function fetchQueue(): Promise<void> {
    try {
      const res = await fetch(`${RELAYER_BASE}/queue`);
      const data = await res.json();
      
      // Detect new intents from queue
      if (data.intents && data.intents.length > 0) {
        const prevCount = queue.value.intents.length;
        const newIntents = data.intents.slice(prevCount > data.intents.length ? 0 : prevCount);
        for (const intent of newIntents) {
          logCounter++;
          intentLogs.value.push({
            id: logCounter,
            action: intent.action || "swap",
            amount: (Number(BigInt(intent.amountIn || "0")) / 1e18).toFixed(4) + " tokens",
            timestamp: Date.now(),
            agentId: intent.agentId,
          });
          // Keep last 50 logs
          if (intentLogs.value.length > 50) {
            intentLogs.value.shift();
          }
        }
      }
      
      queue.value = data;
    } catch { /* ignore */ }
  }

  async function fetchBatches(): Promise<void> {
    try {
      const res = await fetch(`${RELAYER_BASE}/batches`);
      const data = await res.json();
      const newBatches: BatchRecord[] = data.batches || [];
      
      // Detect new batches → trigger callback for popup
      // Skip on first poll (ready=false) to avoid trashing existing data
      if (newBatches.length > prevBatchLen && onNewBatch && ready) {
        const added = newBatches.slice(prevBatchLen);
        for (const b of added) onNewBatch(b);
      }
      prevBatchLen = newBatches.length;
      ready = true; // mark ready after first fetch completes

      batches.value = newBatches;
      
      // Compute aggregates
      if (batches.value.length > 0) {
        const totalSaved = batches.value.reduce(
          (sum: bigint, b: BatchRecord) => sum + BigInt(b.gasSaved), 0n
        );
        totalGasSaved.value = totalSaved.toString();
        avgGasSaved.value = (totalSaved / BigInt(batches.value.length)).toString();
        totalIntents.value = batches.value.reduce(
          (sum: number, b: BatchRecord) => sum + b.numIntents, 0
        );
      }
    } catch { /* ignore */ }
  }

  async function fetchBatchCount(): Promise<void> {
    try {
      const res = await fetch(`${RELAYER_BASE}/batches/count`);
      const data = await res.json();
      batchCount.value = data.batchCount;
    } catch { /* ignore */ }
  }

  async function submitTestIntent(): Promise<void> {
    const apiKey = localStorage.getItem("aegis_deepseek_key");
    let intent: any;

    if (apiKey) {
      // Use DeepSeek V4 to generate real AI intent
      try {
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "You are a DeFi trading agent. Output ONLY valid JSON: {\"action\":\"swap\",\"tokenIn\":\"0x5FbDB2315678afecb367f032d93F642f64180aa3\",\"tokenOut\":\"0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512\",\"amountIn\":\"1000000000000000000\",\"metadata\":\"0x\"}. Choose action from: swap, dca, rebalance, compound, arbitrage. amountIn in wei (18 decimals), random 0.01-50 tokens." },
              { role: "user", content: `Market: TKA trending ${Math.random()>0.5?'UP':'DOWN'}. Generate your next intent.` }
            ],
            temperature: 0.8, max_tokens: 200,
          }),
        });
        const json = await res.json();
        const raw = json.choices?.[0]?.message?.content || "";
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) intent = JSON.parse(m[0]);
      } catch { /* fallback to random */ }
    }

    // Fallback: random swap intent
    if (!intent) {
      const actions = ["swap","dca","rebalance","compound","arbitrage"];
      intent = {
        agentId: 0,
        action: actions[Math.floor(Math.random()*actions.length)],
        user: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        tokenIn: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        tokenOut: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        amountIn: String(BigInt(Math.floor(Math.random()*50+1))*10n**18n),
        metadata: "0x",
      };
    }

    try {
      await fetch(`${RELAYER_BASE}/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
    } catch { /* ignore */ }
  }

  function startPolling(intervalMs = 1500) {
    fetchHealth();
    fetchQueue();
    fetchBatches();
    fetchBatchCount();

    pollTimer = setInterval(() => {
      fetchHealth();
      fetchQueue();
      fetchBatches();
      fetchBatchCount();
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMounted(() => startPolling());
  onUnmounted(() => stopPolling());

  return {
    health,
    queue,
    batches,
    batchCount,
    intentLogs,
    totalGasSaved,
    avgGasSaved,
    totalIntents,
    connected,
    submitTestIntent,
  };
}
