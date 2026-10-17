<script setup lang="ts">
/**
 * 场景层（制作计划 §0.4 素材机制 / UI 设计书 r3 §6）
 *
 * 四层结构，全部"图片优先、缺图回落、代码零改动"：
 *   ① 场景渐变图：每个场景一张独立渐变图（`grad_<key>.svg`，SceneLayer 实现，可替换）；
 *      切换场景时上一张交叉淡出（0.95s），不硬切；
 *   ② 真实场景图（AI 生图）：`bg_<key>.webp` 放进 public/assets/scenes/ 即生效，盖在渐变图上；
 *   ③ 可读性层：极淡暗角 + 夜场轻压暗；
 *   ④ 转场花光：切换场景时一层暖灯柔光雾盖住画面（光雾 + 背景模糊，1.5s 起落），
 *      「在光里」完成场景替换再褪去（参考同类作品转场；随 scene key 重放）。
 *
 * 素材清单与命名见《制作计划》§三对照表 /《人物设定与场景设计 r2》。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import SceneLayer from './SceneLayer.vue'
import { getScene } from '@/data/scenes'
import type { SceneKey } from '@/types/story'

const props = defineProps<{
  scene: SceneKey
  dim?: number
  blur?: boolean
  /** 单屏背景图（相对 /assets/scenes/ 的路径，如 prologue/PRO-1a_竹林晨光.jpg）；优先于场景素材图 */
  backdrop?: string
}>()

const def = computed(() => getScene(props.scene))

/** 切场景交叉淡出：上一场景渐变图短暂保留并渐隐（UI 设计书 r3 §6） */
const prevScene = ref<SceneKey | null>(null)
let prevTimer: number | undefined
watch(
  () => props.scene,
  (nv, ov) => {
    if (!ov || ov === nv) return
    prevScene.value = ov
    window.clearTimeout(prevTimer)
    prevTimer = window.setTimeout(() => {
      prevScene.value = null
    }, 1000)
  }
)
onUnmounted(() => window.clearTimeout(prevTimer))

/** 真实图片是否可用（404 时自动回落渐变图）；序章单屏图（backdrop）与场景素材图（bg_<key>.webp）共用 */
const imageOk = ref(true)
const imageSrc = computed(() => {
  if (props.backdrop) return `/assets/scenes/${props.backdrop}`
  return def.value.asset ? `/assets/scenes/${def.value.asset}` : ''
})
watch(
  () => [props.scene, props.backdrop],
  () => {
    imageOk.value = true
  }
)
const showImage = computed(() => !!imageSrc.value && imageOk.value)
</script>

<template>
  <div
    class="backdrop grain"
    :class="[
      `mood-${def.mood}`,
      { dim: props.dim, 'has-photo': showImage, 'is-blurred': props.blur },
    ]"
  >
    <!-- ① 场景渐变图：当前层 + 上一场景交叉淡出层 -->
    <SceneLayer :scene="props.scene" />
    <SceneLayer v-if="prevScene" :scene="prevScene" class="fading" />

    <!-- ② 素材位：真实场景图，文件存在即生效 -->
    <img
      v-if="showImage"
      class="layer photo"
      :src="imageSrc"
      :alt="props.backdrop ?? def.name"
      @error="imageOk = false"
    />

    <!-- ③ 可读性层 -->
    <div class="layer vignette" />
    <div class="layer scrim" :style="props.dim ? { opacity: props.dim } : undefined" />

    <!-- ④ 转场花光：切换场景时一层暖灯柔光雾扫过（随 scene key 重放，参考同类作品转场） -->
    <div :key="props.scene" class="layer bloom" aria-hidden="true" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  transition: filter 0.4s ease, transform 0.4s ease;
}

/* 出选项时：场景整体虚化（放大 4% 避免模糊后露边），聚焦到抉择 */
.backdrop.is-blurred {
  filter: blur(7px) saturate(0.92) brightness(0.86);
  transform: scale(1.04);
}

/* 虚化期间停掉呼吸动画，避免每帧重算模糊 */
.backdrop.is-blurred .glow {
  animation: none;
}

.layer {
  position: absolute;
  inset: 0;
}

/* 上一场景渐变图的交叉淡出 */
.fading {
  animation: scene-fade 0.95s ease forwards;
}

@keyframes scene-fade {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* 真实素材图：轻微压暗统一色调（暮色基调） */
.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.96) brightness(0.94);
  animation: fade-in 0.8s ease both;
}

.vignette {
  background: radial-gradient(
    ellipse at 50% 45%,
    transparent 36%,
    rgba(12, 20, 36, 0.32) 100%
  );
}

/* 夜场轻压暗，保证正文对比度（暮色基调：不再压到深夜） */
.mood-night .scrim {
  background: linear-gradient(180deg, rgba(20, 32, 54, 0.16) 0%, rgba(20, 32, 54, 0.4) 100%);
}

.scrim {
  opacity: 0.85;
  transition: opacity 0.6s ease;
}

/* 转场花光：暖灯柔光雾 + 背景模糊，1.5s 起落（「在光里」完成场景替换） */
.bloom {
  pointer-events: none;
  opacity: 0;
  -webkit-backdrop-filter: blur(9px) brightness(1.08) saturate(1.04);
  backdrop-filter: blur(9px) brightness(1.08) saturate(1.04);
  background:
    radial-gradient(
      circle at 50% 44%,
      rgba(255, 219, 160, 0.5) 0%,
      rgba(255, 200, 128, 0.26) 36%,
      rgba(255, 200, 128, 0) 74%
    ),
    linear-gradient(180deg, rgba(255, 231, 190, 0.42) 0%, rgba(255, 205, 140, 0.26) 100%);
  animation: scene-bloom 1.5s ease-in-out both;
}

@keyframes scene-bloom {
  0% {
    opacity: 0;
  }
  30% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fading {
    display: none;
  }

  .photo {
    animation: none;
  }

  .bloom {
    display: none;
  }
}
</style>
