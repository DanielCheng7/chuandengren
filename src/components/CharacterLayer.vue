<script setup lang="ts">
/**
 * 人物立绘层（制作计划 §0.4）
 * 有素材才显示；缺素材时整层不渲染 —— 不出现空立绘框。
 * 素材：public/assets/characters/char-*.webp（2:3，透明底）
 */
import { computed, ref, watch } from 'vue'
import { getCharacter } from '@/data/characters'

const props = defineProps<{ speaker?: string }>()

const ok = ref(true)
const def = computed(() => getCharacter(props.speaker))
const src = computed(() => (def.value?.asset ? `/assets/characters/${def.value.asset}` : ''))
const show = computed(() => !!src.value && ok.value)

watch(
  () => props.speaker,
  () => {
    ok.value = true
  }
)
</script>

<template>
  <div v-if="show" class="char-layer anim-fade">
    <img :src="src" :alt="def?.name" @error="ok = false" />
  </div>
</template>

<style scoped>
.char-layer {
  position: absolute;
  right: 4%;
  bottom: 0;
  height: min(52%, 420px);
  pointer-events: none;
  filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.5));
}

img {
  height: 100%;
  width: auto;
  object-fit: contain;
  opacity: 0.96;
  /* 立绘统一压低一点亮度，避免比场景图更"跳" */
  filter: brightness(0.94) saturate(0.96);
}
</style>
