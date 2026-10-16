<script setup lang="ts">
/** 顶部进度条：一盏灯沿着线走 */
import { computed } from 'vue'

const props = defineProps<{ progress: number }>()

const pct = computed(() => `${Math.round(props.progress * 100)}%`)
</script>

<template>
  <div class="track" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100">
    <div class="fill" :style="{ width: pct }" />
    <div class="dot" :style="{ left: pct }" />
  </div>
</template>

<style scoped>
.track {
  position: relative;
  height: 3px;
  background: rgba(245, 239, 226, 0.12);
  border-radius: 2px;
  overflow: visible;
}

.fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, rgba(110, 139, 122, 0.7), var(--gold));
  border-radius: 2px;
  transition: width 0.5s ease;
}

.dot {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border-radius: 50%;
  background: var(--candle);
  box-shadow: 0 0 8px rgba(255, 182, 92, 0.85);
  transform: translateY(-50%);
  transition: left 0.5s ease;
}
</style>
