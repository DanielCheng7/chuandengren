<script setup lang="ts">
/**
 * 《传灯人》互动叙事网页原型
 * 屏幕路由：标题页 →（开场 CG）→ 剧情页 → 结局页
 */
import { computed, ref } from 'vue'
import EndingScreen from './components/EndingScreen.vue'
import OpeningCg from './components/OpeningCg.vue'
import StoryScreen from './components/StoryScreen.vue'
import TitleScreen from './components/TitleScreen.vue'
import { useStoryEngine } from './composables/useStoryEngine'

const engine = useStoryEngine()

const view = computed<'title' | 'story' | 'ending'>(() => {
  if (!engine.started.value) return 'title'
  if (engine.phase.value === 'end') return 'ending'
  return 'story'
})

/** 开场 CG：点「开始旅程」后先全屏播放，播完（或跳过后）再正式进入序章 */
const showCg = ref(false)
function finishCg() {
  showCg.value = false
  engine.startFresh()
}
</script>

<template>
  <div class="app-shell grain">
    <OpeningCg v-if="showCg" @done="finishCg" />
    <TitleScreen v-else-if="view === 'title'" :engine="engine" @begin="showCg = true" />
    <EndingScreen v-else-if="view === 'ending'" :engine="engine" />
    <StoryScreen v-else :engine="engine" />
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
</style>
