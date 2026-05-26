<template>
  <!-- Floating launch button -->
  <button
    v-if="!active"
    @click="start"
    class="fixed right-2 bottom-12 z-30 px-3 py-1.5 text-[9px] border border-amber-500/25 bg-black/60 backdrop-blur-xl text-amber-400/80 rounded hover:bg-amber-500/10 hover:text-amber-300 transition-all font-mono animate-pulse"
  >
    🎬 START DEMO
  </button>

  <!-- Full-screen overlay -->
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="active"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-2xl"
      >
        <!-- Demo panel -->
        <div
          class="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-zinc-900/95 p-7 shadow-2xl backdrop-blur-3xl animate-slide-up font-mono max-h-[85vh] overflow-y-auto"
        >
          <!-- Step indicator -->
          <div class="flex justify-center gap-1.5 mb-5">
            <span
              v-for="s in 4"
              :key="s"
              class="w-8 h-1 rounded-full transition-all duration-500"
              :class="s <= step ? 'bg-emerald-500' : 'bg-white/[0.06]'"
            ></span>
          </div>

          <!-- ====== STEP 1: AI INTENT GENERATION ====== -->
          <div v-if="step === 1">
            <h2 class="text-sm text-emerald-400 uppercase tracking-widest mb-1">🧠 Step 1: AI Intent Generation</h2>
            <div class="text-[9px] text-zinc-600 mb-4">DeepSeek V4 analyzes market signals & generates structured intents</div>

            <!-- Agent persona card -->
            <div class="glass-card p-4 mb-3 border-amber-500/20">
              <div class="text-[8px] text-zinc-600 uppercase mb-2">Active Agent: <span class="text-amber-400">{{ persona.name }}</span> · {{ persona.style }}</div>
              <div class="text-[9px] text-zinc-500 leading-relaxed mb-2">{{ persona.prompt }}</div>
              <div class="bg-white/[0.02] border border-white/[0.05] rounded p-2 mb-1">
                <div class="text-[7px] text-emerald-500 mb-1">// DeepSeek V4 Output → Structured JSON Intent</div>
                <pre class="text-[8px] text-zinc-300 leading-relaxed font-mono">{{ sampleIntent }}</pre>
              </div>
            </div>

            <!-- Market signal -->
            <div class="grid grid-cols-2 gap-2 mb-3">
              <div class="glass-card p-3">
                <div class="text-[8px] text-zinc-600">MARKET SIGNAL</div>
                <div class="text-[10px] mt-1">
                  TKA/USD <span class="text-emerald-400 tabular-nums">${{ marketSignal.price }}</span>
                  <span class="text-emerald-500"> ▲ {{ marketSignal.change }}%</span>
                </div>
                <div class="text-[8px] text-zinc-600 mt-1">Volatility: {{ marketSignal.vol }}% · Trend: <span class="text-emerald-400">UP</span></div>
              </div>
              <div class="glass-card p-3">
                <div class="text-[8px] text-zinc-600">AGENT DECISION</div>
                <div class="text-[10px] mt-1 text-amber-400 uppercase font-bold">{{ sampleAction }}</div>
                <div class="text-[8px] text-zinc-600 mt-1">Amount: <span class="text-zinc-300 tabular-nums">{{ sampleAmount }} tokens</span></div>
              </div>
            </div>

            <!-- Flow arrows -->
            <div class="flex items-center justify-center gap-3 text-[8px] text-zinc-600 mb-3">
              <span class="text-emerald-500">📡 Market Signal</span>
              <span>→</span>
              <span class="text-amber-500">🧠 DeepSeek V4</span>
              <span>→</span>
              <span class="text-emerald-500">📄 JSON Intent</span>
              <span>→</span>
              <span class="text-zinc-500">🌐 POST /intent</span>
            </div>
          </div>

          <!-- ====== STEP 2: QUEUE & BATCHING ====== -->
          <div v-if="step === 2">
            <h2 class="text-sm text-amber-400 uppercase tracking-widest mb-1">📦 Step 2: Queue & Batching</h2>
            <div class="text-[9px] text-zinc-600 mb-4">Intents accumulate in the relayer queue — flush at threshold (10)</div>

            <!-- Animated queue fill -->
            <div class="glass-card p-4 mb-3">
              <div class="flex justify-between text-[8px] text-zinc-600 mb-2">
                <span>INTENT QUEUE</span>
                <span>{{ queueFill }}/10</span>
              </div>
              <div class="flex gap-1 mb-2">
                <div
                  v-for="i in 10" :key="i"
                  class="w-7 h-7 rounded border transition-all duration-300 flex items-center justify-center text-[8px] font-mono"
                  :class="i <= queueFill
                    ? checkmarkColor(i)
                    : 'border-white/[0.06] text-zinc-700'"
                >
                  {{ i <= queueFill ? actionSymbol(i) : i }}
                </div>
              </div>
              <!-- Bucket fill visual -->
              <div class="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700 ease-out"
                  :class="queueFill >= 10 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-amber-500/60'"
                  :style="{ width: (queueFill/10*100) + '%' }"
                ></div>
              </div>
              <div class="text-[8px] text-zinc-600 mt-2 text-center">
                <span v-if="queueFill < 10">⏳ Collecting intents… {{ queueFill }}/10 needed for batch</span>
                <span v-if="queueFill === 10" class="text-emerald-400 animate-pulse">⚡ TRIGGER FLUSH! Sending 10 intents to AgentExecutor…</span>
              </div>
            </div>

            <!-- Why batch? -->
            <div class="glass-card p-3 border-amber-500/15">
              <div class="text-[8px] text-zinc-600 uppercase mb-1">⚡ Why Batch?</div>
              <div class="text-[9px] text-zinc-400 leading-relaxed">
                Each on-chain transaction has a <span class="text-rose-400">~21K gas base cost</span>.
                Processing 10 intents individually = <span class="text-rose-400">10 × base cost</span>.
                Batching them into 1 tx = <span class="text-emerald-400">1 × base cost</span>.
                The savings compound as batch size grows.
              </div>
            </div>
          </div>

          <!-- ====== STEP 3: ON-CHAIN EXECUTION ====== -->
          <div v-if="step === 3">
            <h2 class="text-sm text-cyan-400 uppercase tracking-widest mb-1">⛓️ Step 3: On-Chain Execution</h2>
            <div class="text-[9px] text-zinc-600 mb-4">AgentExecutor contract verifies & routes each intent through the AMM</div>

            <div class="glass-card p-4 mb-3">
              <!-- Contract call visualization -->
              <div class="text-[8px] text-zinc-600 mb-2">CONTRACT: <span class="text-cyan-400">AgentExecutor.batchExecute()</span></div>
              <div class="space-y-1.5 text-[8px] font-mono">
                <div v-for="(item, i) in executionSteps" :key="i"
                  class="flex items-center gap-2 p-1.5 rounded"
                  :class="i <= execProgress ? 'bg-white/[0.03]' : ''"
                >
                  <span class="w-4 h-4 rounded-full flex items-center justify-center text-[7px]"
                    :class="i < execProgress ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/[0.05] text-zinc-700'">
                    {{ i < execProgress ? '✓' : i === execProgress ? '◉' : '○' }}
                  </span>
                  <span class="text-zinc-400">{{ item }}</span>
                </div>
              </div>
            </div>

            <!-- Transaction details -->
            <div class="grid grid-cols-2 gap-2">
              <div class="glass-card p-3">
                <div class="text-[8px] text-zinc-600">TX HASH</div>
                <div class="text-[9px] text-zinc-300 tabular-nums truncate">{{ txHash }}</div>
              </div>
              <div class="glass-card p-3">
                <div class="text-[8px] text-zinc-600">BLOCK</div>
                <div class="text-[9px] text-zinc-300 tabular-nums">#{{ blockNumber }}</div>
              </div>
            </div>
          </div>

          <!-- ====== STEP 4: GAS COMPARISON ====== -->
          <div v-if="step === 4">
            <h2 class="text-sm text-emerald-400 uppercase tracking-widest mb-1">📊 Step 4: Gas Savings Analysis</h2>
            <div class="text-[9px] text-zinc-600 mb-4">Comparing traditional execution vs batch execution</div>

            <!-- Side-by-side comparison -->
            <div class="grid grid-cols-2 gap-3 mb-4">
              <!-- Traditional -->
              <div class="glass-card p-4 border-rose-500/20 bg-rose-500/[0.03]">
                <div class="text-[8px] text-rose-400 uppercase mb-2">❌ Traditional (Individual)</div>
                <div class="space-y-1 text-[8px]">
                  <div v-for="i in 5" :key="i" class="flex justify-between">
                    <span class="text-zinc-500">Tx #{{ i }}</span>
                    <span class="text-rose-400 tabular-nums">120,000 gas</span>
                  </div>
                  <div class="border-t border-rose-500/20 pt-1 mt-1 flex justify-between font-bold">
                    <span class="text-zinc-300">Total</span>
                    <span class="text-rose-400 tabular-nums">{{ fmtNum(individualGas) }} gas</span>
                  </div>
                </div>
              </div>

              <!-- Batch -->
              <div class="glass-card p-4 border-emerald-500/20 bg-emerald-500/[0.03]">
                <div class="text-[8px] text-emerald-400 uppercase mb-2">✅ Batch (Aegis)</div>
                <div class="space-y-1 text-[8px]">
                  <div class="flex justify-between">
                    <span class="text-zinc-500">1 batch tx</span>
                    <span class="text-emerald-400 tabular-nums">{{ fmtNum(batchGas) }} gas</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-zinc-500">Intents</span>
                    <span class="text-zinc-300 tabular-nums">10</span>
                  </div>
                  <div class="border-t border-emerald-500/20 pt-1 mt-1 flex justify-between font-bold">
                    <span class="text-zinc-300">Total</span>
                    <span class="text-emerald-400 tabular-nums">{{ fmtNum(batchGas) }} gas</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Savings highlight -->
            <div class="glass-card p-4 text-center border-emerald-500/30 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
              <div class="text-[8px] text-zinc-600 uppercase mb-1">🎉 TOTAL GAS SAVED</div>
              <div class="text-3xl font-mono font-bold text-emerald-400 tabular-nums">{{ gasSavedPct }}%</div>
              <div class="text-[9px] text-zinc-400 mt-1">
                {{ fmtNum(gasSaved) }} gas saved per batch
              </div>
              <div class="text-[8px] text-zinc-600 mt-2 leading-relaxed">
                By batching 10 intents into 1 transaction, we eliminate 9× the base cost.
                At $50/gwei, that's <span class="text-emerald-400">~${{ gasSavedUsd }} USD saved</span>
                per batch.
              </div>
            </div>
          </div>

          <!-- Navigation -->
          <div class="flex justify-between items-center mt-5 pt-4 border-t border-white/[0.06]">
            <div class="text-[8px] text-zinc-600">Step {{ step }} of 4</div>
            <div class="flex gap-2">
              <button
                @click="reset"
                class="px-4 py-2 text-[9px] border border-white/[0.08] text-zinc-500 rounded hover:border-white/15 transition-all font-mono"
              >
                EXIT
              </button>
              <button
                @click="prevStep"
                v-if="step > 1"
                class="px-4 py-2 text-[9px] border border-white/[0.08] text-zinc-400 rounded hover:border-white/15 transition-all font-mono"
              >
                ← BACK
              </button>
              <button
                @click="nextStep"
                class="px-4 py-2 text-[9px] border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-500/10 transition-all font-mono"
              >
                {{ step === 4 ? '✅ FINISH' : '▶ CONTINUE' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";

const active = ref(false);
const step = ref(1);

// ── Step 1 data ──
const personaIndex = ref(0);
const personas = [
  { name: "MomentumBot", style: "Trend Follower · Aggressive", prompt: "Market signal: TokenA price surged 2.4% in last 5 minutes with above-average volume. Momentum indicators confirm bullish breakout. Optimal action: buy the breakout." },
  { name: "ArbitrageEye", style: "Cross-Market Hunter · Moderate", prompt: "Price discrepancy detected: TokenA/TokenB ratio deviated 6.2% from fair value. Risk-free profit opportunity. Optimal action: execute arbitrage trade." },
  { name: "DCA_Warden", style: "Disciplined Dollar-Cost Averager · Conservative", prompt: "Scheduled DCA execution: regardless of market conditions, accumulating 0.5 TokenB per cycle. Long-term strategy: reduce entry price volatility." },
  { name: "RebalanceKeeper", style: "Portfolio Balancer · Moderate", prompt: "Portfolio drift alert: TokenA allocation exceeded 65% (target 50%). Rebalancing required to maintain risk profile. Optimal action: sell excess TokenA." },
  { name: "YieldCompoundor", style: "Yield Optimizer · Conservative", prompt: "Harvest period triggered. Current APY: 12.4%. Optimal action: claim rewards, swap to principal asset, and redeposit." },
];

const marketSignals = [
  { price: "3,245.67", change: "2.41", vol: "38", action: "swap", amount: "15.3" },
  { price: "3,201.22", change: "0.87", vol: "22", action: "arbitrage", amount: "42.7" },
  { price: "3,189.44", change: "0.12", vol: "15", action: "dca", amount: "0.5" },
  { price: "3,310.50", change: "3.88", vol: "55", action: "rebalance", amount: "28.4" },
  { price: "3,178.90", change: "-0.45", vol: "19", action: "compound", amount: "8.2" },
];

const persona = ref(personas[0]);
const marketSignal = ref(marketSignals[0]);
const sampleAction = ref("swap");
const sampleAmount = ref("15.3");
const sampleIntent = ref("");

function genIntent() {
  const idx = personaIndex.value % personas.length;
  persona.value = personas[idx];
  marketSignal.value = marketSignals[idx];
  sampleAction.value = marketSignal.value.action;
  sampleAmount.value = marketSignal.value.amount;
  sampleIntent.value = JSON.stringify({
    agentId: 0,
    action: sampleAction.value,
    user: "0xf39Fd6…2266",
    tokenIn: "0x5FbD…0aa3",
    tokenOut: "0xe7f1…512",
    amountIn: String(BigInt(Number(sampleAmount.value) * 1e18)),
    metadata: "0x",
  }, null, 2);
  personaIndex.value++;
}

// ── Step 2 data ──
const queueFill = ref(0);
const actionSymbols = ["S", "D", "R", "C", "A", "S", "D", "S", "C", "R"];
function actionSymbol(i: number): string {
  return actionSymbols[(i - 1) % 10];
}
function checkmarkColor(i: number): string {
  return 'bg-white/[0.05] text-zinc-200';
}

// ── Step 3 data ──
const executionSteps = [
  "Validate batch: 10 intents, no empties",
  "Route Intent #1 — swap(SimpleAMM)",
  "Route Intent #2 — dca(SimpleAMM)",
  "Route Intent #3 — rebalance(SimpleAMM)",
  "Route Intent #4 — compound(SimpleAMM)",
  "Route Intent #5 — arbitrage(SimpleAMM)",
  "Route Intent #6-10 — batch completed",
  "Emit BatchExecuted(batchId, gasUsed, gasSaved)",
  "Emit IntentProcessed × 10 events",
];
const execProgress = ref(0);
const txHash = ref("0x4d92d034b80290683c4a17f0fc96037117cc069d2412fedb4c88bd908d19265f");
const blockNumber = ref(10);

// ── Step 4 data ──
const individualGas = 10 * 120000;
const batchGas = 242150;
const gasSaved = individualGas - batchGas;
const gasSavedPct = Math.round((1 - batchGas / individualGas) * 100);
const gasSavedUsd = ((gasSaved * 50) / 1e9).toFixed(2);

function fmtNum(n: number): string {
  return n.toLocaleString();
}

// ── Navigation ──
function start() {
  active.value = true;
  step.value = 1;
  queueFill.value = 0;
  execProgress.value = 0;
  genIntent();
}

function reset() {
  active.value = false;
  step.value = 1;
  queueFill.value = 0;
  execProgress.value = 0;
}

function nextStep() {
  if (step.value < 4) {
    // Animate step transitions
    if (step.value === 1) startQueueFill();
    if (step.value === 2) startExecAnimation();
    if (step.value === 3) { step.value = 4; return; }
    step.value++;
  } else {
    reset();
  }
}

function prevStep() {
  if (step.value > 1) step.value--;
}

// ── Animations ──
function startQueueFill() {
  queueFill.value = 0;
  const interval = setInterval(() => {
    if (queueFill.value >= 10) { clearInterval(interval); return; }
    queueFill.value++;
  }, 300);
}

function startExecAnimation() {
  execProgress.value = 0;
  const interval = setInterval(() => {
    if (execProgress.value >= executionSteps.length) { clearInterval(interval); return; }
    execProgress.value++;
  }, 400);
}

onUnmounted(() => reset());
</script>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.3s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
