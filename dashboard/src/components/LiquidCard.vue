<template>
  <div
    class="glass-card glass-shimmer p-4 animate-slide-up group"
    :class="customClass"
  >
    <!-- Top accent border: visible ONLY on hover -->
    <div
      class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      :class="accentClass"
    ></div>

    <h3 class="text-xs font-mono uppercase tracking-widest mb-3 transition-colors duration-500" :class="titleClass">
      {{ title }}
    </h3>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    glow?: "success" | "warning" | "danger" | "none";
    customClass?: string;
  }>(),
  { glow: "none", customClass: "" }
);

const accentClass = computed(() => {
  switch (props.glow) {
    case "success": return "via-emerald-500/30 to-transparent";
    case "warning": return "via-amber-500/30 to-transparent";
    case "danger": return "via-rose-500/30 to-transparent";
    default: return "via-white/5 to-transparent";
  }
});

const titleClass = computed(() => {
  switch (props.glow) {
    case "success": return "text-zinc-500 group-hover:text-emerald-400";
    case "warning": return "text-zinc-500 group-hover:text-amber-400";
    case "danger": return "text-zinc-500 group-hover:text-rose-400";
    default: return "text-zinc-500 group-hover:text-zinc-300";
  }
});
</script>
