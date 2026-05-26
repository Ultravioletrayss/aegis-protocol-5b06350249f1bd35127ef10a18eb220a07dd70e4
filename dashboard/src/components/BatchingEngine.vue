<template>
  <LiquidCard title="BATCHING ENGINE" glow="warning" customClass="h-full flex flex-col">
    <!-- Explainer: why batch? -->
    <div class="text-[8px] text-zinc-600 leading-relaxed mb-2 border-b border-white/[0.04] pb-1.5">
      Each on-chain tx costs <span class="text-rose-400">~120K gas</span> individually.
      Batching <span class="text-emerald-400">10 swaps into 1 tx</span> saves <span class="text-emerald-400">~70% gas</span> via amortized base cost.
    </div>

    <div class="flex-1 flex flex-col items-center justify-center gap-3">
      <!-- Bucket with outer glow -->
      <div class="relative w-full max-w-[180px] aspect-square">
        <div
          class="absolute inset-0 rounded-full border-2 transition-all duration-700"
          :class="queue.currentSize >= queue.batchSize
            ? 'border-amber-400/60 shadow-[0_0_40px_rgba(251,191,36,0.25)] batch-executing'
            : 'border-amber-500/15'"
        >
          <!-- Liquid fill -->
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500/30 via-amber-500/15 to-transparent transition-all duration-700 ease-out rounded-b-full"
            :style="{ height: fillPercent + '%' }">
            <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"></div>
          </div>

          <!-- Particles orbit -->
          <div v-for="i in queue.currentSize" :key="i"
            class="absolute w-1.5 h-1.5 rounded-full bg-amber-400/70"
            :style="particleStyle(i)"></div>
        </div>

        <!-- Center metric -->
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-3xl font-mono font-bold tabular-nums"
            :class="queue.currentSize >= queue.batchSize ? 'text-emerald-400' : 'text-amber-400'">
            {{ queue.currentSize }}
          </span>
          <span class="text-[9px] text-zinc-600">/ {{ queue.batchSize }}</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="w-full max-w-[180px]">
        <div class="flex justify-between text-[8px] text-zinc-600 mb-0.5">
          <span>BATCH READY</span><span>{{ Math.round(fillPercent) }}%</span>
        </div>
        <div class="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div class="h-full rounded-full transition-all duration-700 ease-out"
            :class="fillPercent >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.4)]' : 'bg-amber-500/50'"
            :style="{ width: fillPercent + '%' }"></div>
        </div>
      </div>

      <!-- Process flow -->
      <div class="flex items-center gap-1 text-[8px] text-zinc-700">
        <span class="text-zinc-500">AI INTENTS</span>
        <span>→</span>
        <span :class="queue.currentSize>0?'text-amber-500':''">QUEUE</span>
        <span>→</span>
        <span :class="queue.currentSize>=queue.batchSize?'text-emerald-500':''">BATCH</span>
        <span>→</span>
        <span class="text-zinc-500">ON-CHAIN</span>
      </div>

      <!-- Latest batch info -->
      <div v-if="latestBatch" class="text-center space-y-0.5">
        <div class="text-[8px] text-zinc-600">LAST BATCH</div>
        <div class="font-mono text-[10px]">
          <span class="text-emerald-400">#{{ latestBatch.batchId }}</span>
          <span class="text-zinc-700 mx-1.5">·</span>
          <span class="text-zinc-300">{{ latestBatch.numIntents }} intents</span>
          <span class="text-zinc-700 mx-1.5">·</span>
          <span class="text-emerald-400">~{{ gasSavedPct }}% saved</span>
        </div>
        <div class="text-[8px] text-zinc-700">tx: {{ latestBatch.txHash.slice(0,12) }}…</div>
      </div>
    </div>
  </LiquidCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LiquidCard from "./LiquidCard.vue";
import type { QueueSnapshot, BatchRecord } from "../types";

const props = defineProps<{ queue: QueueSnapshot; batches: BatchRecord[] }>();

const fillPercent = computed(() => Math.min(100, (props.queue.currentSize / props.queue.batchSize) * 100));
const latestBatch = computed(() => props.batches.length > 0 ? props.batches[props.batches.length-1] : null);

const gasSavedPct = computed(() => {
  if (!latestBatch.value) return "—";
  try {
    const est = Number(latestBatch.value.estimatedIndividualGas);
    const actual = Number(latestBatch.value.totalGasUsed);
    if (est === 0) return "—";
    return Math.round((1 - actual / est) * 100);
  } catch { return "—"; }
});

function particleStyle(i: number) {
  const angle = (i / props.queue.batchSize) * 360;
  const rad = (angle * Math.PI) / 180;
  const r = 40 + Math.sin(i * 2.7) * 6;
  return {
    left: `${50 + Math.cos(rad) * r * 0.35}%`,
    top: `${50 + Math.sin(rad) * r * 0.35}%`,
    animationDelay: `${i * 120}ms`,
  };
}
</script>
