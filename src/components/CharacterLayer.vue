<script setup lang="ts">
/**
 * 人物立绘层（制作计划 §0.4）
 * 有素材才显示；缺素材时整层不渲染 —— 不出现空立绘框。
 * 素材：public/assets/characters/char-*.webp（**透明底竖图，人物高占图高 ≈96%**，
 * 由 `scripts/import-characters.py` 从 16:9 全身像裁出；不强制 2:3）
 *
 * 尺寸按**视高**定（2026-10-19 接入实测调整）：原先 `min(52%, 420px)` 是相对
 * `.props`（已被对白带压掉一截），实际只有视高 41%，全身像显得空；
 * 改为 `min(52vh, 520px)`，脚底再留 6px 缝，不压对白带。
 *
 * 阿鲟例外：它是横卧的鱼灯（约 2:1），不能套竖立绘的档位——
 * 单独一档尺寸与位置（右侧偏上、悬空轻浮），素材见 `char-ashun.webp`。
 */
import { computed, ref, watch } from 'vue'
import { getCharacter } from '@/data/characters'

const props = defineProps<{ speaker?: string }>()

const ok = ref(true)
const def = computed(() => getCharacter(props.speaker))
const src = computed(() => (def.value?.asset ? `/assets/characters/${def.value.asset}` : ''))
const show = computed(() => !!src.value && ok.value)
/** 阿鲟：横卧鱼灯，单独一档 */
const isAshun = computed(() => props.speaker === '阿鲟')

watch(
  () => props.speaker,
  () => {
    ok.value = true
  }
)
</script>

<template>
  <div v-if="show" class="char-layer anim-fade" :class="{ 'is-ashun': isAshun }">
    <img :src="src" :alt="def?.name" @error="ok = false" />
  </div>
</template>

<style scoped>
.char-layer {
  position: absolute;
  right: 4%;
  /* 脚底与对白带上沿留 6px 缝：人物是全身像，贴死会被渐变带切到鞋尖 */
  bottom: 6px;
  height: min(52vh, 520px);
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

/* ---------- 阿鲟：横卧鱼灯（约 2:1）----------
   悬在画面右侧偏上，给底部对白带让位；轻微上下浮动像"漂"着。
   浮动写在 img 上，避免覆盖外层 .anim-fade 的淡入。 */
.char-layer.is-ashun {
  right: 5%;
  bottom: 22%;
  height: auto;
  width: min(46vw, 520px);
  filter: drop-shadow(0 12px 30px rgba(0, 0, 0, 0.45))
    drop-shadow(0 0 32px rgba(255, 182, 92, 0.3));
}

.char-layer.is-ashun img {
  width: 100%;
  height: auto;
  filter: brightness(1.02) saturate(1.03);
  animation: ashun-float 7s ease-in-out infinite;
}

@keyframes ashun-float {
  0%,
  100% {
    transform: translateY(0) rotate(-0.35deg);
  }
  50% {
    transform: translateY(-10px) rotate(0.45deg);
  }
}

/* 手机竖屏：更宽一档、稍微上移，避免贴到对白带 */
@media (max-width: 640px) {
  .char-layer.is-ashun {
    right: 2%;
    bottom: 24%;
    width: min(80vw, 420px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .char-layer.is-ashun img {
    animation: none;
  }
}
</style>
