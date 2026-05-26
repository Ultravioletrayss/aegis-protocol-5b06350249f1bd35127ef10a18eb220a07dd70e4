<template>
  <div class="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl relative z-10">
    <!-- Logo -->
    <div class="flex items-center gap-2.5 mr-1 shrink-0">
      <div class="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
        <span class="text-[10px] font-bold text-black">Æ</span>
      </div>
      <div>
        <div class="text-[11px] font-mono font-bold text-zinc-200 tracking-wider leading-none">AEGIS</div>
        <div class="text-[8px] text-zinc-600 leading-none mt-0.5">v0.1</div>
      </div>
    </div>

    <!-- Live Market Dropdown → replaces static TKA/USD ticker + 📊 button -->
    <MarketPanel />

    <div class="flex items-center gap-3 text-[10px] font-mono shrink-0">
      <div class="w-px h-3 bg-white/[0.08]"></div>
      <div class="flex items-center gap-1.5"><span class="text-zinc-600">GAS</span><span class="text-amber-400 tabular-nums">{{ gasPrice }} gwei</span><span class="text-[8px] text-zinc-600">{{ gasTrend }}</span></div>
      <div class="w-px h-3 bg-white/[0.08]"></div>
      <div class="flex items-center gap-1.5"><span class="text-zinc-600">BLOCK</span><span class="text-zinc-300 tabular-nums">#{{ blockHeight }}</span></div>
      <div class="w-px h-3 bg-white/[0.08]"></div>
      <div class="flex items-center gap-1.5"><span class="text-zinc-600">LAT</span><span class="text-zinc-400 tabular-nums">{{ latency }}ms</span></div>
    </div>

    <div class="flex-1"></div>

    <!-- Right: Wallet + Actions + Clock -->
    <div class="flex items-center gap-3 shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full" :class="connected ? 'bg-emerald-500' : 'bg-rose-500'"></span>
        <span class="text-[9px] text-zinc-600 font-mono">{{ connected ? 'LIVE' : 'OFF' }}</span>
      </div>

      <!-- Wallet Connect -->
      <button v-if="!walletAddress" @click="connectWallet" class="px-3 py-1 text-[10px] border border-emerald-500/25 text-emerald-400/80 rounded hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-300 font-mono">🦊 CONNECT</button>
      <span v-else class="flex items-center gap-1.5 text-[10px] text-emerald-400/80 font-mono">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        {{ walletShort }}
        <span class="text-[8px] text-zinc-600">({{ chainLabel }})</span>
      </span>

      <div class="w-px h-4 bg-white/[0.06]"></div>
      <button @click="$emit('register-agent')" class="px-3 py-1 text-[10px] border border-amber-500/15 text-amber-400/60 rounded hover:bg-amber-500/10 hover:text-amber-300 transition-all duration-300 font-mono">+ AGENT</button>
      <button @click="$emit('inject')" class="px-3 py-1 text-[10px] border border-white/[0.08] text-zinc-500 rounded hover:border-white/15 hover:text-zinc-300 transition-all duration-300 font-mono">INJECT</button>

      <div class="text-[10px] text-zinc-600 font-mono tabular-nums pl-2 border-l border-white/[0.06]">{{ systemTime }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import MarketPanel from "./MarketPanel.vue";

defineProps<{ connected: boolean }>();
defineEmits<{ inject: []; 'register-agent': [] }>();

const walletAddress = ref("");
const walletChainId = ref("");
const walletShort = computed(() => walletAddress.value ? walletAddress.value.slice(0,6)+"…"+walletAddress.value.slice(-4) : "");
const chainLabel = computed(() => {
  const labels: Record<string,string> = {"0x7a69":"Hardhat","0x1":"Mainnet","0xaa36a7":"Sepolia","0x89":"Polygon"};
  return labels[walletChainId.value] || walletChainId.value.slice(0,6) || "—";
});

// ── Real MetaMask wallet connect ──
async function connectWallet() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    alert("MetaMask not detected. Please install MetaMask extension.");
    return;
  }
  try {
    const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
    walletAddress.value = accounts[0];
    const chainId: string = await ethereum.request({ method: "eth_chainId" });
    walletChainId.value = chainId;
    // Switch to Hardhat local network if not already
    if (chainId !== "0x7a69") {
      try { await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] }); } catch { /* ok if not configured */ }
    }
  } catch (err: any) {
    console.error("[Wallet] Connection rejected:", err.message);
  }
}

// Listen for account/chain changes
if (typeof window !== "undefined") {
  const ethereum = (window as any).ethereum;
  if (ethereum) {
    ethereum.on("accountsChanged", (accounts: string[]) => {
      walletAddress.value = accounts[0] || "";
    });
    ethereum.on("chainChanged", (chainId: string) => {
      walletChainId.value = chainId;
    });
    ethereum.on("disconnect", () => {
      walletAddress.value = "";
      walletChainId.value = "";
    });
    // Auto-connect if already authorized
    ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length > 0) walletAddress.value = accounts[0];
    });
  }
}

// Simulated real-time ticker (GAS/BLOCK/LAT only — price is now live via MarketPanel)
const gasPrice = ref("12"); const gasTrend = ref("↓"); const blockHeight = ref(0);
const latency = ref("24"); const systemTime = ref("");
let t1: any, t2: any;

function tick() {
  gasPrice.value = String(Math.floor(8+Math.random()*15)); gasTrend.value = Math.random()>0.5?"↑":"↓";
  blockHeight.value = Math.floor(50+Math.random()*200); latency.value = String(Math.floor(15+Math.random()*30));
}
function clock() { const n = new Date(); systemTime.value = n.toTimeString().slice(0,8)+"."+String(n.getMilliseconds()).padStart(3,"0"); }

onMounted(() => { tick(); clock(); t1=setInterval(tick,2000); t2=setInterval(clock,250); });
onUnmounted(() => { clearInterval(t1); clearInterval(t2); });
</script>
