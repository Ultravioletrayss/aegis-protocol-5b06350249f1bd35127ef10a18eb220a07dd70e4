<template>
  <div class="relative">
    <!-- Toggle: clickable price ticker -->
    <button @click.stop="visible = !visible"
      class="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer hover:bg-white/[0.04] px-1.5 py-0.5 rounded transition-all group">
      <span class="text-zinc-600 group-hover:text-emerald-400 transition-colors">$</span>
      <span class="text-emerald-400 tabular-nums group-hover:text-emerald-300 transition-colors">{{ displayPrice }}</span>
      <span class="text-[9px] px-1 rounded transition-colors"
        :class="(changePct||0) >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'">
        {{ (changePct||0) >= 0 ? '▲' : '▼' }} {{ Math.abs(changePct||0).toFixed(2) }}%
      </span>
      <span class="text-zinc-700 group-hover:text-zinc-500 text-[8px] ml-0.5">{{ visible ? '▲' : '▼' }}</span>
    </button>

    <!-- Dropdown panel -->
    <Transition name="fade">
      <div v-if="visible"
        class="absolute top-full left-0 mt-1.5 w-72 z-50 rounded-lg border border-white/[0.08] bg-zinc-900/95 backdrop-blur-3xl p-4 shadow-2xl animate-slide-up font-mono"
        @click.stop>

        <!-- Token pills -->
        <div class="flex gap-1 flex-wrap mb-3">
          <button v-for="t in tokens" :key="t.id" @click="selectedToken = t.id"
            class="text-[9px] px-2 py-0.5 rounded border transition-all"
            :class="selectedToken === t.id ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.06] text-zinc-600 hover:border-white/15'">
            {{ t.symbol.toUpperCase() }}
          </button>
        </div>

        <div v-if="loading" class="text-[9px] text-zinc-600 animate-pulse py-3 text-center">Fetching CoinGecko…</div>
        <div v-if="err" class="text-[9px] text-rose-500 py-2 text-center">{{ err }}</div>

        <div v-if="d && !err && !loading" class="space-y-2">
          <div class="text-center">
            <div class="text-[8px] text-zinc-600">{{ d.name }} ({{ d.symbol.toUpperCase() }})</div>
            <div class="text-xl font-mono font-bold tabular-nums"
              :class="(d.pc||0)>=0?'text-emerald-400':'text-rose-400'">
              ${{ fp(d.price) }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] border-t border-white/[0.04] pt-2">
            <div><span class="text-zinc-600">Mkt Cap</span><br><span class="text-zinc-300">${{ fl(d.mcap) }}</span></div>
            <div><span class="text-zinc-600">24h Vol</span><br><span class="text-zinc-300">${{ fl(d.vol) }}</span></div>
            <div><span class="text-zinc-600">24h High</span><br><span class="text-emerald-400">${{ fp(d.high) }}</span></div>
            <div><span class="text-zinc-600">24h Low</span><br><span class="text-rose-400">${{ fp(d.low) }}</span></div>
            <div><span class="text-zinc-600">Supply</span><br><span class="text-zinc-400">{{ fl(d.supply) }}</span></div>
            <div><span class="text-zinc-600">Rank</span><br><span class="text-zinc-400">#{{ d.rank }}</span></div>
          </div>
          <div class="text-[7px] text-zinc-700 text-center pt-1 border-t border-white/[0.03]">CoinGecko · 30s refresh</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const visible = ref(false);
const tokens = [
  { id: "ethereum", symbol: "eth" }, { id: "bitcoin", symbol: "btc" },
  { id: "solana", symbol: "sol" }, { id: "matic-network", symbol: "matic" },
  { id: "arbitrum", symbol: "arb" }, { id: "optimism", symbol: "op" },
];
const selectedToken = ref("ethereum");
const loading = ref(false);
const err = ref("");
let timer: any;

// Per-token cache: { [tokenId]: { data, timestamp } }
const tokenCache = ref<Record<string, { data: any; ts: number }>>({});
const CACHE_TTL = 120_000; // 2 minutes per token

const d = computed(() => {
  const entry = tokenCache.value[selectedToken.value];
  if (!entry) return null;
  const raw = entry.data;
  const m = raw.market_data || raw;
  return {
    name: raw.name || "—", symbol: raw.symbol || "",
    price: m.current_price?.usd ?? 0, pc: m.price_change_percentage_24h ?? 0,
    mcap: m.market_cap?.usd ?? 0, vol: m.total_volume?.usd ?? 0,
    high: m.high_24h?.usd ?? 0, low: m.low_24h?.usd ?? 0,
    supply: m.circulating_supply ?? 0, rank: raw.market_cap_rank ?? "—",
  };
});

const changePct = computed(() => d.value?.pc ?? 0);
const displayPrice = computed(() => {
  const p = d.value?.price;
  if (p && p !== "—") return p < 1 ? p.toFixed(4) : p.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2});
  return "—";
});

async function fetchData() {
  const tokenId = selectedToken.value;
  const cached = tokenCache.value[tokenId];

  // Serve from cache if fresh
  if (cached && Date.now() - cached.ts < CACHE_TTL) return;

  loading.value = true; err.value = "";
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`);
    if (res.status === 429) {
      err.value = "Rate limited — using cached data";
      return;
    }
    if (!res.ok) { err.value = `Error ${res.status}`; return; }
    const json = await res.json();
    // Store per-token
    tokenCache.value = { ...tokenCache.value, [tokenId]: { data: json, ts: Date.now() } };
  } catch { err.value = "Network error — using cached data"; }
  finally { loading.value = false; }
}
function fp(v: number) { if (!v) return "—"; return v<1?v.toFixed(6):v<100?v.toFixed(2):v.toLocaleString(); }
function fl(v: number) { if (!v) return "—"; if(v>1e12)return (v/1e12).toFixed(2)+"T"; if(v>1e9)return (v/1e9).toFixed(2)+"B"; if(v>1e6)return (v/1e6).toFixed(2)+"M"; return v.toLocaleString(); }

watch(selectedToken, () => fetchData()); // New token? Check/load cache immediately

onMounted(() => {
  fetchData(); // Load first token on mount
  // Background refresh: only if visible, respects per-token TTL
  timer = setInterval(() => { if (visible.value) fetchData(); }, CACHE_TTL);
});
onUnmounted(() => clearInterval(timer));

// Close on click outside
import { onMounted as _m } from "vue";
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
