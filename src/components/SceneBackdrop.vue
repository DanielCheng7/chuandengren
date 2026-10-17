<script setup lang="ts">
/**
 * 场景层（制作计划 §0.4 素材机制 / UI 设计书 r3 §6）
 *
 * 三层结构，全部"图片优先、缺图回落、代码零改动"：
 *   ① 场景渐变图：每个场景一张独立渐变图（`grad_<key>.svg`，SceneLayer 实现，可替换）；
 *      切换场景时上一张交叉淡出（0.95s），不硬切；
 *   ② 真实场景图（AI 生图）：`bg_<key>.webp` 放进 public/assets/scenes/ 即生效，盖在渐变图上；
 *   ③ 可读性层：极淡暗角 + 夜场轻压暗。
 *
 * 素材清单与命名见《制作计划》§三对照表 /《人物设定与场景设计 r2》。
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import SceneLayer from './SceneLayer.vue'
import { getScene } from '@/data/scenes'
import type { SceneKey } from '@/types/story'

const props = defineProps<{
  scene: SceneKey
  /**
   * 幕基调场景：一幕内统一背景色板与氛围，避免场景切换时配色跳变
   * （2026-10-17 用户决议）。不传时回落到 scene。
   */
  scheme?: SceneKey
  dim?: number
  blur?: boolean
  /** 单屏背景图（相对 /assets/scenes/ 的路径，如 prologue/PRO-1a_竹林晨光.jpg）；优先于场景素材图 */
  backdrop?: string
}>()

/**
 * 渐变与氛围实际使用的场景 key：
 *  - 有 backdrop 单屏图（序章蒙太奇）→ 用当前 scene（逐图切换，图片盖住渐变，效果不变）；
 *  - 无 backdrop（正片）→ 用幕基调 scheme（一幕内不换色，杜绝跳色与瞬间曝光）。
 */
const schemeKey = computed<SceneKey>(() =>
  props.backdrop ? props.scene : props.scheme ?? props.scene
)
/** 底色/暗角/氛围（按幕统一） */
const def = computed(() => getScene(schemeKey.value))
/** 真实素材图（按具体场景，素材到位后才生效） */
const sceneDef = computed(() => getScene(props.scene))

/** 幕切换时渐变交叉淡出：上一渐变图短暂保留并渐隐（UI 设计书 r3 §6；幕内不切换） */
const prevScene = ref<SceneKey | null>(null)
let prevTimer: number | undefined
watch(
  schemeKey,
  (nv, ov) => {
    if (!ov || ov === nv) return
    prevScene.value = ov
    window.clearTimeout(prevTimer)
    prevTimer = window.setTimeout(() => {
      prevScene.value = null
    }, 1600)
  }
)
onUnmounted(() => {
  window.clearTimeout(prevTimer)
  window.clearTimeout(clearPrevTimer)
})

/** 真实图片是否可用（404 时自动回落渐变图）；序章单屏图（backdrop）与场景素材图（bg_<key>.webp）共用 */
const imageOk = ref(true)
/** 当前底图（渐显后的稳定态，不透明，垫在渐隐层之下） */
const currentSrc = ref('')
/** 上一张图（渐隐层，交叉溶解时覆盖在底图之上、逐渐淡出） */
const prevSrc = ref('')
/** 首图入场标记：仅第一张做柔和渐显，后续切换由「旧图渐隐揭示新图」完成（避免双层半透明漏底） */
const firstEnter = ref(true)
let clearPrevTimer: number | undefined

function targetSrc(): string {
  if (props.backdrop) return `/assets/scenes/${props.backdrop}`
  return sceneDef.value.asset ? `/assets/scenes/${sceneDef.value.asset}` : ''
}

watch(
  () => [props.scene, props.backdrop],
  () => {
    imageOk.value = true
    const target = targetSrc()
    if (!target) {
      currentSrc.value = ''
      prevSrc.value = ''
      window.clearTimeout(clearPrevTimer)
      return
    }
    // 预加载：新图加载完成后再交叉溶解——旧图升到渐隐层（1→0 淡出），
    // 新图作为不透明底图垫在下面被揭示（无闪烁、无漏底）；
    // onload 时校验目标未变——快速连续切换时丢弃过期预加载（竞态防护）
    const pre = new Image()
    pre.onload = () => {
      if (targetSrc() !== target) return
      window.clearTimeout(clearPrevTimer)
      const had = !!currentSrc.value
      prevSrc.value = currentSrc.value
      currentSrc.value = target
      firstEnter.value = !had
      clearPrevTimer = window.setTimeout(() => {
        prevSrc.value = ''
      }, 1700)
    }
    pre.onerror = () => {
      if (targetSrc() === target) imageOk.value = false
    }
    pre.src = target
  },
  { immediate: true }
)

const showImage = computed(() => !!currentSrc.value && imageOk.value)

/**
 * 是否隐藏场景渐变底：
 * 有真实图片（序章单屏图 / 场景素材图）且图片可用时，渐变底整体隐去——
 * 这样从 CG 切入序幕是「黑场 → 图片渐显」，不会先透出暖色光晕
 * （2026-10-17 用户反馈：CG→序幕不应有暖灯花光过渡）。
 * 无图片或图片加载失败时，渐变底作为兜底正常显示。
 */
const hideBase = computed(
  () => (!!props.backdrop || !!sceneDef.value.asset) && imageOk.value
)
</script>

<template>
  <div
    class="backdrop grain"
    :class="[
      `mood-${def.mood}`,
      { dim: props.dim, 'has-photo': showImage, 'is-blurred': props.blur },
    ]"
  >
    <!-- ① 场景渐变图：按幕基调统一（幕内不换色），幕切换时交叉淡出。
         有真实图片时整体隐去，让图片从黑场渐显（避免暖色光晕透出） -->
    <div class="base" :class="{ 'is-hidden': hideBase }">
      <SceneLayer :scene="schemeKey" />
      <SceneLayer v-if="prevScene" :scene="prevScene" class="fading" />
    </div>

    <!-- ② 素材位：真实场景图，文件存在即生效。
         双图层交叉溶解：底图（当前）不透明，渐隐层（上一张）在其上 1→0 淡出揭示新图 -->
    <img
      v-if="showImage"
      :key="currentSrc"
      class="layer photo is-current"
      :class="{ 'is-first': firstEnter }"
      :src="currentSrc"
      :alt="props.backdrop ?? sceneDef.name"
      @error="imageOk = false"
    />
    <img
      v-if="showImage && prevSrc"
      :key="prevSrc"
      class="layer photo is-prev"
      :src="prevSrc"
      alt=""
      aria-hidden="true"
    />

    <!-- ③ 可读性层 -->
    <div class="layer vignette" />
    <div class="layer scrim" :style="props.dim ? { opacity: props.dim } : undefined" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /* 黑场底色：从 CG 切入时先见纯黑，再由图片渐显（无暖色光晕闪现） */
  background: #05080f;
  /* 选项进出的虚化过渡放柔，避免瞬间曝光（2026-10-17） */
  transition: filter 0.55s ease, transform 0.55s ease;
}

/* 渐变底层：有真实图片时隐去（黑场垫底），无图/图片失败时兜底显示 */
.base {
  position: absolute;
  inset: 0;
  transition: opacity 1.2s ease;
}

.base.is-hidden {
  opacity: 0;
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

/* 幕切换时上一渐变图的交叉淡出（1.6s 缓入缓出，杜绝瞬间曝光） */
.fading {
  animation: scene-fade 1.6s ease-in-out forwards;
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
}

/* 底图：仅首图做柔和渐显（1.4s）；后续切换保持不透明垫底，避免与渐隐层双层半透明漏底 */
.photo.is-current.is-first {
  animation: fade-in 1.4s ease both;
}

/* 渐隐层：上一张图淡出（1.6s），揭示下面的新图（交叉溶解时缓入缓出，过渡更从容） */
.photo.is-prev {
  animation: photo-fade-out 1.6s ease-in-out forwards;
}

@keyframes photo-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
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

@media (prefers-reduced-motion: reduce) {
  .fading {
    display: none;
  }

  .photo {
    animation: none;
  }

  /* 减弱动效：不保留旧图渐隐层，直接切换为新图 */
  .photo.is-prev {
    display: none;
  }
}
</style>
