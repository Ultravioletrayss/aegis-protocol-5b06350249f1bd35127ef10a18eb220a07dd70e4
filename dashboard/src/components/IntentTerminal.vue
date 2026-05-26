<template>
  <LiquidCard title="AI INTENT STREAM" glow="success" customClass="h-full flex flex-col">
    <!-- Header -->
    <div class="flex justify-between items-center mb-2 text-[9px] text-zinc-600">
      <span class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> STREAM · {{ connected ? 'LIVE' : 'OFFLINE' }}
      </span>
      <span class="tabular-nums">{{ logs.length }} / 50</span>
    </div>

    <!-- Search filter -->
    <div class="mb-1.5">
      <input
        v-model="search"
        type="text"
        placeholder="Filter by action / amount / ID…"
        class="w-full bg-white/[0.03] border border-white/[0.05] rounded px-2 py-1 text-[9px] text-zinc-400 font-mono focus:border-emerald-500/20 outline-none placeholder:text-zinc-700"
      />
    </div>

    <!-- Column header -->
    <div class="grid grid-cols-[34px_38px_58px_1fr_1fr] gap-1 text-[8px] text-zinc-700 uppercase mb-1 px-0.5 items-center">
      <span>Time</span><span class="text-center">ID</span><span class="text-center">Action</span><span>Amount</span><span>Status</span>
    </div>

    <!-- Terminal area -->
    <div ref="terminalRef" class="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[9px] leading-relaxed space-y-px pr-0.5">
      <div
        v-for="log in filteredLogs" :key="log.id"
        class="terminal-line animate-slide-up grid grid-cols-[34px_38px_58px_1fr_1fr] gap-1 py-0.5 px-0.5 rounded hover:bg-white/[0.03] cursor-pointer transition-colors group items-center"
        @click="$emit('drill-down', log)"
      >
        <span class="text-zinc-700 tabular-nums">{{ formatTime(log.timestamp) }}</span>
        <span class="text-emerald-600 tabular-nums text-center">#{{ String(log.id).padStart(4,'0') }}</span>
        <span class="uppercase text-[7px] tracking-wider font-semibold truncate text-center" :class="actionColor(log.action)" :title="log.action">{{ log.action }}</span>
        <span class="text-zinc-400 tabular-nums truncate text-right">{{ log.amount }}</span>
        <span class="flex items-center gap-1 justify-end">
          <span class="text-[7px] px-1 py-px rounded border shrink-0" :class="statusBadge(log)">{{ statusBadge(log) === 'BATCHED' ? 'BATCHED' : 'PENDING' }}</span>
          <span class="text-zinc-700 text-[7px] truncate">0x{{ addrShort }}</span>
        </span>
      </div>
      <div v-if="filteredLogs.length === 0 && logs.length === 0" class="text-zinc-800 italic pt-2 text-[9px]">Awaiting AI intent stream…<span class="animate-terminal-blink">▊</span></div>
      <div v-else-if="filteredLogs.length === 0" class="text-zinc-700 italic pt-2 text-[9px]">No intents match filter "{{ search }}"</div>
    </div>

    <!-- Bottom summary -->
    <div class="mt-2 pt-1.5 border-t border-white/[0.04] grid grid-cols-3 gap-1 text-[8px]">
      <div><span class="text-zinc-600">AVG SIZE</span><br><span class="text-zinc-400 tabular-nums">{{ avgSize }}</span></div>
      <div><span class="text-zinc-600">BATCHED</span><br><span class="text-emerald-500 tabular-nums">{{ logs.length }}</span></div>
      <div><span class="text-zinc-600">TOTAL</span><br><span class="text-zinc-300 tabular-nums">{{ totalTokens }}</span></div>
    </div>
  </LiquidCard>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import LiquidCard from "./LiquidCard.vue";
import type { IntentLog } from "../types";

const props = defineProps<{ logs: IntentLog[]; connected: boolean }>();
defineEmits<{ 'drill-down': [log: IntentLog] }>();

const terminalRef = ref<HTMLElement | null>(null);
const search = ref("");

const filteredLogs = computed(() => {
  if (!search.value) return props.logs;
  const q = search.value.toLowerCase();
  return props.logs.filter(l =>
    l.action.toLowerCase().includes(q) ||
    (l.amount || "").toLowerCase().includes(q) ||
    String(l.id).includes(q)
  );
});
const addrShort = computed(() => "f39F…2266");

const avgSize = computed(() => {
  if (props.logs.length === 0) return "—";
  const vals = props.logs.map(l => parseFloat(l.amount) || 0).filter(v => v > 0);
  return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)+" tk" : "—";
});
const totalTokens = computed(() => {
  const sum = props.logs.reduce((s,l) => s + (parseFloat(l.amount)||0), 0);
  return sum.toFixed(1) + " tk";
});

watch(() => props.logs.length, async () => {
  await nextTick();
  if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
});

function formatTime(ts: number) { return new Date(ts).toTimeString().slice(0,5); }
function actionColor(a: string) {
  return ({swap:"text-emerald-400",dca:"text-cyan-400",rebalance:"text-amber-400",compound:"text-violet-400",arbitrage:"text-rose-400"} as any)[a]||"text-zinc-400";
}
function statusBadge(log: IntentLog) { return log.id <= (props.logs.length||0)-2 ? "BATCHED" : "PENDING"; }
</script>

