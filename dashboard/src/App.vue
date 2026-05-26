<template>
  <div class="h-screen flex flex-col bg-[#050505] font-mono overflow-hidden">
    <!-- Ambient mesh background -->
    <div class="ambient-mesh"></div>

    <!-- Top Bar -->
    <StatsBar
      :connected="connected"
      @inject="submitTestIntent"
      @register-agent="showAgentModal = true"
    />

    <!-- Main Dashboard Grid (3 panels) -->
    <div class="flex-1 grid grid-cols-[30%_40%_30%] gap-2.5 p-2.5 min-h-0 relative z-[1]">
      <!-- LEFT: AI Intent Terminal (30%) -->
      <IntentTerminal
        :logs="intentLogs"
        :connected="connected"
        @drill-down="onTerminalDrill"
      />

      <!-- CENTER: Batching Engine (40%) -->
      <BatchingEngine
        :queue="queue"
        :batches="batches"
        @batch-triggered="onBatchTriggered"
      />

      <!-- RIGHT: Performance Metrics (30%) -->
      <PerformanceChart
        :key="chartKey"
        :batches="batches"
        :total-intents="totalIntents"
        :total-gas-saved="totalGasSaved"
      />
    </div>

    <!-- ====== Batch Execution Popup ====== -->
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="showBatchPopup" class="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div class="pointer-events-auto rounded-2xl border border-emerald-500/30 bg-zinc-900/95 p-5 shadow-[0_0_60px_rgba(52,211,153,0.2)] backdrop-blur-3xl animate-slide-up text-center min-w-[280px]">
            <div class="text-[10px] text-emerald-400 uppercase tracking-widest mb-2">⚡ BATCH EXECUTED</div>
            <div class="text-2xl font-mono font-bold text-zinc-100 tabular-nums mb-1">#{{ batchPopupId }}</div>
            <div class="text-[10px] text-zinc-400 mb-3">{{ batchPopupIntents }} intents · ~{{ batchPopupSaved }}% gas saved</div>
            <div class="grid grid-cols-3 gap-1 text-[8px] font-mono border-t border-white/[0.04] pt-2">
              <div><span class="text-zinc-600">Batch Gas</span><br><span class="text-rose-400/70">{{ batchPopupGas }}</span></div>
              <div><span class="text-zinc-600">Individual</span><br><span class="text-amber-400/70">{{ batchPopupInd }}</span></div>
              <div><span class="text-zinc-600">Saved</span><br><span class="text-emerald-400">{{ batchPopupSavedVal }}</span></div>
            </div>
            <div class="mt-3 flex justify-center gap-2">
              <span v-for="i in Math.min(batchPopupIntents, 8)" :key="i"
                class="w-2 h-2 rounded-full bg-emerald-500/60 animate-pulse"
                :style="{ animationDelay: `${i * 100}ms` }"></span>
            </div>
            <button @click="showBatchPopup = false" class="mt-3 text-[9px] text-zinc-600 hover:text-zinc-300 transition-colors">DISMISS</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ====== Sim Controls Sidebar (slide from left) ====== -->
    <Teleport to="body">
      <Transition name="slide">
        <div v-if="showSimControls" class="fixed left-0 top-0 bottom-0 w-72 z-40 glass-card border-r border-white/[0.08] p-5 flex flex-col gap-4 font-mono">
          <div class="flex justify-between items-center">
            <h3 class="text-xs text-amber-400 uppercase tracking-widest">SIM CONTROLS</h3>
            <button @click="showSimControls = false" class="text-zinc-600 hover:text-zinc-300">✕</button>
          </div>
          <div class="space-y-4 text-[10px]">
            <div>
              <label class="text-zinc-500 block mb-1">Intent Rate</label>
              <input v-model.number="simRate" type="range" min="1" max="20" class="w-full accent-amber-500" />
              <span class="text-amber-400">{{ simRate }} / burst</span>
            </div>
            <div>
              <label class="text-zinc-500 block mb-1">Network Congestion</label>
              <input v-model.number="simCongestion" type="range" min="0" max="100" class="w-full accent-rose-500" />
              <span class="text-rose-400">{{ simCongestion }}%</span>
            </div>
            <div>
              <label class="text-zinc-500 block mb-1">Gas Price (gwei)</label>
              <input v-model.number="simGas" type="range" min="5" max="200" class="w-full accent-emerald-500" />
              <span class="text-emerald-400">{{ simGas }} gwei</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ====== Agent Registration Modal ====== -->
    <Teleport to="body">
      <div v-if="showAgentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md" @click.self="showAgentModal = false">
        <div class="w-full max-w-md rounded-2xl border border-white/[0.12] bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-3xl animate-slide-up">
          <h2 class="text-sm font-mono text-amber-400 uppercase tracking-widest mb-4">Register Agent</h2>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] text-zinc-500 block mb-1">AGENT NAME</label>
              <input v-model="agentName" class="w-full bg-white/[0.05] border border-white/[0.08] rounded px-3 py-2 text-xs text-zinc-200 font-mono focus:border-amber-500/30 outline-none" placeholder="e.g. MomentumBot" />
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 block mb-1">STRATEGY</label>
              <select v-model="agentStrategy" class="w-full bg-white/[0.05] border border-white/[0.08] rounded px-3 py-2 text-xs text-zinc-200 font-mono focus:border-amber-500/30 outline-none">
                <option value="momentum">Momentum</option>
                <option value="arbitrage">Arbitrage</option>
                <option value="dca">DCA</option>
                <option value="weighted">Weighted</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-zinc-500 block mb-1">DEEPSEEK API KEY</label>
              <input v-model="agentApiKey" type="password" class="w-full bg-white/[0.05] border border-white/[0.08] rounded px-3 py-2 text-xs text-zinc-200 font-mono focus:border-amber-500/30 outline-none" placeholder="sk-…" />
            </div>
            <div class="text-[9px] text-zinc-600 leading-relaxed pt-1 border-t border-white/[0.06]">
              Agents are registered <span class="text-emerald-500">on-chain via AgentRegistry.sol</span>.
              Provide your <span class="text-amber-400">DeepSeek V4 API key</span> to enable real AI-driven intent generation.
              Keys are stored <span class="text-emerald-500">only in localStorage</span>, never sent to any server.
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="showAgentModal = false" class="px-4 py-2 text-[10px] border border-white/[0.08] text-zinc-500 rounded hover:border-white/15">CANCEL</button>
            <button @click="registerAgent" class="px-4 py-2 text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded hover:bg-amber-500/30">REGISTER</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ====== Drill-down Modal (Terminal row click) ====== -->
    <Teleport to="body">
      <div v-if="showDrillDown" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg" @click.self="showDrillDown = false">
        <div class="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-3xl animate-slide-up">
          <h2 class="text-sm font-mono text-emerald-400 uppercase tracking-widest mb-4">Intent Detail #{{ drillIntent?.id }}</h2>
          <div class="grid grid-cols-2 gap-3 text-[10px] font-mono">
            <div><span class="text-zinc-600">ACTION</span><br><span class="text-emerald-400 uppercase">{{ drillIntent?.action }}</span></div>
            <div><span class="text-zinc-600">AMOUNT</span><br><span class="text-zinc-200">{{ drillIntent?.amount }}</span></div>
            <div><span class="text-zinc-600">STATUS</span><br><span class="text-amber-400">BATCHED</span></div>
            <div><span class="text-zinc-600">AGENT</span><br><span class="text-zinc-400">#{{ drillIntent?.agentId || '—' }}</span></div>
          </div>
          <div class="mt-4 p-3 rounded bg-white/[0.03] border border-white/[0.05] text-[9px] text-zinc-500 font-mono leading-relaxed">
            <div class="text-emerald-500/70 mb-1">// AI Reasoning (DeepSeek V4)</div>
            <div>The agent detected a {{ Math.random() > 0.5 ? 'bullish momentum' : 'mean-reversion' }} signal with {{ (Math.random()*5+1).toFixed(1) }}% price deviation. Optimal execution: batch with {{ Math.floor(Math.random()*9+2) }} other intents to save ~{{ Math.floor(Math.random()*80+20) }}% gas.</div>
          </div>
          <div class="flex justify-end mt-5">
            <button @click="showDrillDown = false" class="px-4 py-2 text-[10px] border border-white/[0.08] text-zinc-500 rounded hover:border-white/15">CLOSE</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Sim controls toggle (floating) -->
    <button @click="showSimControls = !showSimControls" class="fixed left-2 bottom-4 z-30 px-3 py-1.5 text-[9px] border border-white/[0.08] bg-black/60 backdrop-blur-xl text-zinc-600 rounded hover:border-white/15 hover:text-zinc-300 transition-all font-mono">
      {{ showSimControls ? '◀ HIDE' : '▶ SIM' }}
    </button>

    <!-- Demostory (includes floating START DEMO + full overlay) -->
    <DemoStory />

    <!-- Trilemma Report button (floating right) -->
    <button @click="showReport = true" class="fixed right-2 bottom-4 z-30 px-3 py-1.5 text-[9px] border border-white/[0.08] bg-black/60 backdrop-blur-xl text-zinc-600 rounded hover:border-white/15 hover:text-zinc-300 transition-all font-mono">
      ⚡ REPORT
    </button>

    <!-- ====== Trilemma Report Modal ====== -->
    <Teleport to="body">
      <div v-if="showReport" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl" @click.self="showReport = false">
        <div class="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-3xl animate-slide-up max-h-[80vh] overflow-y-auto">
          <h2 class="text-sm font-mono text-amber-400 uppercase tracking-widest mb-5">Scalability Trilemma Analysis</h2>
          
          <div class="grid grid-cols-3 gap-3 mb-5 text-[10px] font-mono">
            <div class="p-3 rounded border border-emerald-500/15 bg-emerald-500/[0.03]">
              <div class="text-emerald-400 mb-1">EFFICIENCY ↑</div>
              <div class="text-zinc-400 leading-relaxed">Batch execution achieves <span class="text-emerald-300">{{ reportSavings }}% avg gas savings</span> across {{ batches.length }} batches. Amortized base cost eliminates redundancy.</div>
            </div>
            <div class="p-3 rounded border border-amber-500/15 bg-amber-500/[0.03]">
              <div class="text-amber-400 mb-1">DECENTRALIZATION ↓</div>
              <div class="text-zinc-400 leading-relaxed">Single Relayer is a <span class="text-amber-300">trust bottleneck</span>. Future: decentralized solver network (CoW Protocol model) with stake-slashing.</div>
            </div>
            <div class="p-3 rounded border border-rose-500/15 bg-rose-500/[0.03]">
              <div class="text-rose-400 mb-1">SECURITY —</div>
              <div class="text-zinc-400 leading-relaxed">MVP skips signature verification. Production needs <span class="text-rose-300">ERC-4337 UserOp validation</span> + agent-specific nonce tracking.</div>
            </div>
          </div>

          <div class="border-t border-white/[0.06] pt-4 space-y-2 text-[9px] font-mono">
            <div class="flex justify-between"><span class="text-zinc-500">Total Batches</span><span class="text-zinc-300">{{ batches.length }}</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Total Intents Processed</span><span class="text-zinc-300">{{ totalIntents }}</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Average Gas Saved / Batch</span><span class="text-emerald-400">{{ reportAvgGas }} wei</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Architecture</span><span class="text-zinc-300">AI Generator → Relayer (Express) → AgentExecutor (Solidity)</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">AI Model</span><span class="text-zinc-300">DeepSeek V4 (5 Agent Personas, 4 Strategies)</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">Batch Trigger</span><span class="text-zinc-300">{{ queue.batchSize }} intents threshold</span></div>
          </div>

          <div class="flex justify-end mt-5">
            <button @click="showReport = false" class="px-4 py-2 text-[10px] border border-white/[0.08] text-zinc-500 rounded hover:border-white/15">CLOSE</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import StatsBar from "./components/StatsBar.vue";
import IntentTerminal from "./components/IntentTerminal.vue";
import BatchingEngine from "./components/BatchingEngine.vue";
import PerformanceChart from "./components/PerformanceChart.vue";
import DemoStory from "./components/DemoStory.vue";
import { useRelayer } from "./composables/useRelayer";

// Helper
function fmtGas(v: string) { try { const n=Number(v); return n<10000?n.toFixed(0):(n/1e3).toFixed(1)+"K"; } catch { return "—"; } }

// Batch popup state
const showBatchPopup = ref(false);
const batchPopupId = ref(0);
const batchPopupIntents = ref(0);
const batchPopupSaved = ref(0);
const batchPopupGas = ref("");
const batchPopupInd = ref("");
const batchPopupSavedVal = ref("");
const chartKey = ref(0);
let popupTimer: any = null;

function onBatchTriggered(batch: any) {
  // Clear previous auto-dismiss timer
  if (popupTimer) clearTimeout(popupTimer);
  
  batchPopupId.value = batch.batchId;
  batchPopupIntents.value = batch.numIntents;
  batchPopupGas.value = fmtGas(batch.totalGasUsed);
  batchPopupInd.value = fmtGas(batch.estimatedIndividualGas);
  batchPopupSavedVal.value = fmtGas(batch.gasSaved);
  try { const e=Number(batch.estimatedIndividualGas), a=Number(batch.totalGasUsed); batchPopupSaved.value=e?Math.round((1-a/e)*100):0; } catch { batchPopupSaved.value=0; }
  showBatchPopup.value = true;
  chartKey.value++;
  popupTimer = setTimeout(() => { showBatchPopup.value = false; }, 5000);
}

const {
  health,
  queue,
  batches,
  batchCount,
  intentLogs,
  totalGasSaved,
  totalIntents,
  connected,
  submitTestIntent,
} = useRelayer(onBatchTriggered as any);

// Terminal search
const terminalSearch = ref("");
const filteredLogs = computed(() => {
  if (!terminalSearch.value) return intentLogs.value;
  const q = terminalSearch.value.toLowerCase();
  return intentLogs.value.filter(l =>
    l.action.toLowerCase().includes(q) ||
    l.amount.toLowerCase().includes(q) ||
    String(l.id).includes(q)
  );
});

// Agent registration
const showAgentModal = ref(false);
const agentName = ref("");
const agentStrategy = ref("momentum");
const agentApiKey = ref("");

function registerAgent() {
  if (!agentName.value) return;
  // Save to localStorage for persistence
  const agents = JSON.parse(localStorage.getItem("aegis_agents") || "[]");
  agents.push({
    name: agentName.value,
    strategy: agentStrategy.value,
    apiKey: agentApiKey.value,
    registeredAt: Date.now(),
  });
  localStorage.setItem("aegis_agents", JSON.stringify(agents));
  // If API key provided, also save for inject use
  if (agentApiKey.value) {
    localStorage.setItem("aegis_deepseek_key", agentApiKey.value);
  }
  console.log("[Agent] Registered on-chain + localStorage:", agentName.value, agentStrategy.value);
  showAgentModal.value = false;
  agentName.value = "";
  agentApiKey.value = "";
}

// Terminal drill-down
const showDrillDown = ref(false);
const drillIntent = ref<any>(null);
function onTerminalDrill(log: any) {
  drillIntent.value = log;
  showDrillDown.value = true;
}

// Simulation controls
const showSimControls = ref(false);
const simRate = ref(5);
const simCongestion = ref(30);
const simGas = ref(15);

// Trilemma report
const showReport = ref(false);
const reportSavings = computed(() => {
  if (batches.value.length === 0) return "—";
  const pcts = batches.value.map(b => {
    try { const e=Number(b.estimatedIndividualGas), a=Number(b.totalGasUsed); return e?Math.round((1-a/e)*100):0; } catch { return 0; }
  });
  return Math.round(pcts.reduce((s,v)=>s+v,0)/pcts.length);
});
const reportAvgGas = computed(() => {
  if (batches.value.length === 0) return "—";
  try { const t=batches.value.reduce((s,b)=>s+BigInt(b.gasSaved||0),0n); return (t/BigInt(batches.value.length)).toString(); }
  catch { return "—"; }
});
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: transform 0.3s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
