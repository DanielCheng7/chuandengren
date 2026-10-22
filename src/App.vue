<script setup lang="ts">
/**
 * 《传灯人》互动叙事网页原型
 * 屏幕路由：标题页 →（渐隐·黑场）→ 开场 CG → 剧情页 → 结局页
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import EndingScreen from './components/EndingScreen.vue'
import OpeningCg from './components/OpeningCg.vue'
import OrientationHint from './components/OrientationHint.vue'
import StoryCg from './components/StoryCg.vue'
import StoryScreen from './components/StoryScreen.vue'
import TitleScreen from './components/TitleScreen.vue'
import { useAudio } from './composables/useAudio'
import { useStoryEngine } from './composables/useStoryEngine'

const engine = useStoryEngine()

const view = computed<'title' | 'story' | 'ending'>(() => {
  if (!engine.started.value) return 'title'
  if (engine.phase.value === 'end') return 'ending'
  return 'story'
})

/**
 * 开场流程阶段：idle → fade（标题页渐隐 0.55s）→ black（纯黑 1.5s）→ play（CG 渐显）
 * （2026-10-18 用户决议）
 */
const cgStage = ref<'idle' | 'fade' | 'black' | 'play'>('idle')
let stageTimers: number[] = []

function beginJourney() {
  if (cgStage.value !== 'idle') return
  cgStage.value = 'fade'
  stageTimers.push(
    window.setTimeout(() => {
      cgStage.value = 'black'
      stageTimers.push(
        window.setTimeout(() => {
          cgStage.value = 'play'
        }, 1500)
      )
    }, 560)
  )
}

function finishCg() {
  stageTimers.forEach((t) => window.clearTimeout(t))
  stageTimers = []
  cgStage.value = 'idle'
  engine.startFresh()
}

/** 标题页仅在「开场流程未启动且处于标题态」时存在；fade 阶段由 Transition 播放渐隐 */
const showTitle = computed(() => cgStage.value === 'idle' && view.value === 'title')

/**
 * BGM 驱动：标题页 → 标题曲；CG／黑场 → 静音让位（`开场CG_字幕版.mp4` 自带音轨，避免双层配乐）；
 * 剧情与结局 → 剧情曲（结局沿用不切曲，免得把情绪掐断）。
 *
 * 2026-10-21 起加上**节点内 CG**（`StoryNode.cg`，EP 现实篇《灯火正游来》）：
 * 播放期间同样让位，结束后由下面的 watch 恢复。
 */
const { playBgm, suspendBgm, resumeBgm } = useAudio()

watch(
  [cgStage, view, () => engine.activeCg.value],
  ([stage, v, storyCg]) => {
    if (stage !== 'idle' || storyCg) {
      suspendBgm()
      return
    }
    resumeBgm()
    playBgm(v === 'title' ? 'title' : 'story')
  },
  { immediate: true }
)

onUnmounted(() => stageTimers.forEach((t) => window.clearTimeout(t)))
</script>

<template>
  <div class="app-shell grain">
    <!-- 黑场垫底：标题页渐隐时露出纯黑；黑屏 1.5s 后 CG 再渐显 -->
    <div v-if="cgStage !== 'idle'" class="cg-blackout" aria-hidden="true" />

    <OpeningCg v-if="cgStage === 'play'" @done="finishCg" />

    <!-- 剧情内 CG（EP 现实篇）：播完或「跳过」后继续 nextNodeId -->
    <StoryCg
      v-if="engine.activeCg.value"
      :src="engine.activeCg.value"
      @done="engine.finishCg()"
    />

    <Transition name="title-out">
      <TitleScreen v-if="showTitle" :engine="engine" @begin="beginJourney" />
    </Transition>
    <EndingScreen v-if="!showTitle && view === 'ending'" :engine="engine" />
    <StoryScreen v-if="!showTitle && view === 'story'" :engine="engine" />

    <!-- 竖屏提示（2026-10-22）：只在竖屏出现，可关、不阻断；转横屏自动消失。
         放在最外层，标题页／CG／剧情页／结局页都会盖到。 -->
    <OrientationHint />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--ink-deep);
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
}

/* 桌面：16:9 横屏画幅（2026-10-16 决议，UI 设计书 r2 §5）
   宽 ≥900px 且高 ≥600px 时启用：画面等比内嵌居中，四周为影院式留边；
   手机竖屏 / 横屏保持全屏，不误触发。 */
@media (min-width: 900px) and (min-height: 600px) {
  .app-shell {
    position: absolute;
    inset: 0;
    margin: auto;
    width: min(100vw, calc(100dvh * 16 / 9));
    height: min(100dvh, calc(100vw * 9 / 16));
    max-width: none;
    box-shadow: 0 30px 90px rgba(4, 9, 20, 0.72), 0 0 1px rgba(245, 239, 226, 0.16);
  }
}

/* 开场黑场：垫在标题页之下（DOM 顺序在前），标题页渐隐时露出纯黑 */
.cg-blackout {
  position: absolute;
  inset: 0;
  background: #05080f;
}

/* 标题页离场：渐隐至黑（0.55s，随后进入 1.5s 黑屏） */
.title-out-leave-active {
  transition: opacity 0.55s ease;
}

.title-out-leave-to {
  opacity: 0;
}
</style>
