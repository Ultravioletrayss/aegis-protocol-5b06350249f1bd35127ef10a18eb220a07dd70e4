<template>
  <LiquidCard title="PERFORMANCE METRICS" glow="success" customClass="h-full flex flex-col">
    <!-- Mode toggle -->
    <div class="flex gap-2 mb-3">
      <button
        v-for="mode in modes"
        :key="mode.key"
        @click="activeMode = mode.key"
        class="text-xs px-3 py-1 rounded border transition-all duration-300"
        :class="activeMode === mode.key
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
          : 'border-white/10 text-zinc-600 hover:border-white/20'"
      >
        {{ mode.label }}
      </button>
    </div>

    <!-- ECharts container -->
    <div ref="chartRef" class="flex-1 min-h-0"></div>

    <!-- Summary stats -->
    <div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
      <div class="text-center">
        <div class="text-[8px] text-zinc-600">BATCHES</div>
        <div class="text-sm font-mono text-zinc-200 tabular-nums">{{ batches.length }}</div>
      </div>
      <div class="text-center">
        <div class="text-[8px] text-zinc-600">INTENTS</div>
        <div class="text-sm font-mono text-zinc-200 tabular-nums">{{ totalIntents }}</div>
      </div>
      <div class="text-center">
        <div class="text-[8px] text-zinc-600">GAS SAVED</div>
        <div class="text-sm font-mono text-emerald-400 tabular-nums">{{ gasSavedDisplay }}</div>
      </div>
    </div>

    <!-- Gas Analytics Table -->
    <div class="mt-2 pt-2 border-t border-white/[0.04] flex-1 min-h-0 overflow-hidden flex flex-col">
      <div class="text-[8px] text-zinc-600 uppercase mb-1">Recent Batches</div>
      <div class="text-[8px] grid grid-cols-[24px_1fr_1fr_1fr] gap-1 text-zinc-700 mb-0.5 px-0.5">
        <span>#</span><span>Intents</span><span>Batch Gas</span><span>Saved</span>
      </div>
      <div class="flex-1 overflow-y-auto space-y-px">
        <div v-for="b in recentBatches" :key="b.batchId"
          class="grid grid-cols-[24px_1fr_1fr_1fr] gap-1 text-[8px] font-mono py-0.5 px-0.5 rounded hover:bg-white/[0.02]">
          <span class="text-zinc-600">{{ b.batchId }}</span>
          <span class="text-zinc-400 tabular-nums">{{ b.numIntents }}</span>
          <span class="text-rose-400/70 tabular-nums">{{ fmtGas(b.totalGasUsed) }}</span>
          <span class="text-emerald-400 tabular-nums">{{ savedPct(b) }}%</span>
        </div>
        <div v-if="batches.length === 0" class="text-zinc-800 text-[8px] italic p-1">No batches yet</div>
      </div>
    </div>
  </LiquidCard>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from "vue";
import * as echarts from "echarts";
import LiquidCard from "./LiquidCard.vue";
import type { BatchRecord, GasDataPoint } from "../types";

const props = defineProps<{
  batches: BatchRecord[];
  totalIntents: number;
  totalGasSaved: string;
}>();

const chartRef = ref<HTMLElement | null>(null);
let chart: echarts.ECharts | null = null;

type ChartMode = "gas" | "throughput" | "cumulative";
const modes: { key: ChartMode; label: string }[] = [
  { key: "gas", label: "GAS COMPARE" },
  { key: "throughput", label: "THROUGHPUT" },
  { key: "cumulative", label: "CUMULATIVE" },
];
const activeMode = ref<ChartMode>("gas");

// Gas saved formatted
const gasSavedDisplay = computed(() => {
  try {
    const val = BigInt(props.totalGasSaved || "0");
    if (val < 10000n) return val.toString() + " wei";
    return (Number(val) / 1e6).toFixed(2) + "M wei";
  } catch { return "0"; }
});

// Recent batches for analytics table (last 15)
const recentBatches = computed(() => props.batches.slice(-15).reverse());

function fmtGas(v: string) {
  try { const n = Number(v); return n < 10000 ? n.toFixed(0) : (n/1e3).toFixed(1)+"K"; }
  catch { return "—"; }
}
function savedPct(b: BatchRecord) {
  try {
    const est = Number(b.estimatedIndividualGas);
    const act = Number(b.totalGasUsed);
    if (est === 0) return "—";
    return Math.round((1 - act/est)*100);
  } catch { return "—"; }
}

// Build data points from batches
const dataPoints = computed<GasDataPoint[]>(() =>
  props.batches.map((b) => ({
    time: new Date(b.timestamp).toLocaleTimeString("en-US", { hour12: false }),
    batchGas: Number(b.totalGasUsed),
    individualGas: Number(b.estimatedIndividualGas),
    gasSaved: Number(b.gasSaved),
    batchId: b.batchId,
  }))
);

function getChartOption(): echarts.EChartsOption {
  const dp = dataPoints.value;
  const times = dp.map((d) => d.time);
  if (times.length === 0) times.push("--:--:--");

  if (activeMode.value === "gas") {
    return {
      grid: { top: 10, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(24,24,27,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#f4f4f5", fontFamily: "JetBrains Mono", fontSize: 11 },
      },
      legend: {
        data: ["Batch Gas", "Individual Gas"],
        textStyle: { color: "#a1a1aa", fontSize: 10 },
        top: 0,
      },
      xAxis: {
        type: "category",
        data: times,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#71717a", fontSize: 9, fontFamily: "JetBrains Mono" },
      },
      yAxis: {
        type: "value",
        name: "Gas (wei)",
        nameTextStyle: { color: "#71717a", fontSize: 9 },
        axisLabel: { color: "#71717a", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        {
          name: "Batch Gas",
          type: "line",
          data: dp.length > 0 ? dp.map((d) => d.batchGas) : [0],
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: "#34d399", width: 2 },
          itemStyle: { color: "#34d399" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(52,211,153,0.3)" },
              { offset: 1, color: "rgba(52,211,153,0.02)" },
            ]),
          },
        },
        {
          name: "Individual Gas",
          type: "line",
          data: dp.length > 0 ? dp.map((d) => d.individualGas) : [0],
          smooth: true,
          symbol: "diamond",
          symbolSize: 4,
          lineStyle: { color: "#f87171", width: 2, type: "dashed" },
          itemStyle: { color: "#f87171" },
        },
      ],
    };
  }

  if (activeMode.value === "throughput") {
    return {
      grid: { top: 10, right: 20, bottom: 30, left: 50 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(24,24,27,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#f4f4f5", fontFamily: "JetBrains Mono", fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: times,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
        axisLabel: { color: "#71717a", fontSize: 9, fontFamily: "JetBrains Mono" },
      },
      yAxis: {
        type: "value",
        name: "Intents",
        nameTextStyle: { color: "#71717a", fontSize: 9 },
        axisLabel: { color: "#71717a", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        {
          name: "Intents/Batch",
          type: "bar",
          data: dp.length > 0 ? dp.map((d) => props.batches[d.batchId - 1]?.numIntents || 0) : [0],
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#fbbf24" },
              { offset: 1, color: "rgba(251,191,36,0.2)" },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }

  // Cumulative gas saved
  const cumulative: number[] = [];
  let sum = 0;
  for (const d of dp) {
    sum += d.gasSaved;
    cumulative.push(sum);
  }

  return {
    grid: { top: 10, right: 20, bottom: 30, left: 50 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(24,24,27,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#f4f4f5", fontFamily: "JetBrains Mono", fontSize: 11 },
    },
    xAxis: {
      type: "category",
      data: times,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      axisLabel: { color: "#71717a", fontSize: 9, fontFamily: "JetBrains Mono" },
    },
    yAxis: {
      type: "value",
      name: "Gas Saved (wei)",
      nameTextStyle: { color: "#71717a", fontSize: 9 },
      axisLabel: { color: "#71717a", fontSize: 9 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
    },
    series: [
      {
        name: "Cumulative Gas Saved",
        type: "line",
        data: dp.length > 0 ? cumulative : [0],
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: "#34d399", width: 2.5 },
        itemStyle: { color: "#34d399" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(52,211,153,0.4)" },
            { offset: 1, color: "rgba(52,211,153,0.02)" },
          ]),
        },
      },
    ],
  };
}

function initChart() {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value, "dark");
  chart.setOption(getChartOption());
}

function resizeChart() {
  chart?.resize();
}

watch(activeMode, () => {
  if (chart) {
    chart.setOption(getChartOption(), true);
  }
});

watch(() => props.batches.length, async () => {
  await nextTick();
  if (chart) {
    chart.setOption(getChartOption(), true);
  }
});

onMounted(() => {
  nextTick(initChart);
  window.addEventListener("resize", resizeChart);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeChart);
  chart?.dispose();
});
</script>
