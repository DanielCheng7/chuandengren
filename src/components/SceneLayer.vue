<script setup lang="ts">
/**
 * 场景渐变层（单个场景一张渐变图）
 *
 * 优先使用 `public/assets/scenes/grad_<key>.svg`（scripts/gen-scene-gradients.mjs 生成，
 * 可自由替换为设计稿渐变图）；文件不存在时回落到代码生成的等价 CSS 渐变。
 * 真实场景图（bg_<key>.webp）到位后仍由 SceneBackdrop 叠加在此层之上。
 */
import { computed, ref, watch } from 'vue'
import { getScene } from '@/data/scenes'
import type { SceneKey } from '@/types/story'

const props = defineProps<{ scene: SceneKey }>()

const def = computed(() => getScene(props.scene))

/** 渐变图是否可用（404 时回落到 CSS 渐变） */
const gradOk = ref(true)
watch(
  () => props.scene,
  () => {
    gradOk.value = true
  }
)

function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** 与 grad_<key>.svg 等价的 CSS 渐变（回落用）：光源在上、底色在下 */
const cssBg = computed(() => {
  const d = def.value
  return `radial-gradient(circle at ${d.glowPos}, ${alpha(d.glow, d.glowStrength)} 0%, ${alpha(
    d.glow,
    d.glowStrength * 0.32
  )} 26%, transparent 64%), linear-gradient(180deg, ${d.base[0]} 0%, ${d.base[1]} 100%)`
})
</script>

<template>
  <div class="scene-layer">
    <div class="css" :style="{ background: cssBg }" />
    <img
      v-if="gradOk"
      class="img"
      :src="`/assets/scenes/grad_${scene}.svg`"
      alt=""
      @error="gradOk = false"
    />
  </div>
</template>

<style scoped>
.scene-layer {
  position: absolute;
  inset: 0;
}

.css,
.img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.img {
  object-fit: cover;
}
</style>
