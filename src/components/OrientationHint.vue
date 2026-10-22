<script setup lang="ts">
/**
 * 竖屏提示（2026-10-22 用户要求）
 *
 * 「进入网页时判定横竖屏，竖屏则提示横屏游玩效果更佳」。
 *  — 判定：`innerHeight > innerWidth`（resize / orientationchange 时重算），不依赖 UA；
 *  — **不阻断**：竖屏仍可正常游玩（移动端布局已适配），提示只是一条可关的横幅；
 *  — 关闭后本标签页不再打扰（sessionStorage），重新开页面且仍是竖屏才会再提示；
 *  — 转成横屏自动消失；转回竖屏且没关过，会再出现。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const KEY = 'chuandengren.orientationHintDismissed'

const portrait = ref(false)
const dismissed = ref(false)
let recheck = 0

const visible = computed(() => portrait.value && !dismissed.value)

function sync() {
  portrait.value = window.innerHeight > window.innerWidth
}

function onOrientationChange() {
  // 部分机型 orientationchange 早于尺寸更新，补一次延迟同步
  window.clearTimeout(recheck)
  recheck = window.setTimeout(sync, 120)
}

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* 隐私模式禁写：本页内仍然生效 */
  }
}

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(KEY) === '1'
  } catch {
    /* 同上 */
  }
  sync()
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', onOrientationChange)
})

onUnmounted(() => {
  window.clearTimeout(recheck)
  window.removeEventListener('resize', sync)
  window.removeEventListener('orientationchange', onOrientationChange)
})
</script>

<template>
  <div v-if="visible" class="orient-layer">
    <Transition name="orient" appear>
      <div class="orient-hint" role="status" aria-live="polite">
        <!-- 旋转的手机：暗示「把手机横过来」，不依赖 emoji/图标字体 -->
        <svg class="orient-icon" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="10" y="4" width="12" height="24" rx="2.4" />
          <line x1="14" y1="7.2" x2="18" y2="7.2" />
        </svg>
        <div class="orient-text">
          <p class="orient-title">横屏游玩效果更佳</p>
          <p class="orient-sub">横过来能看到完整画幅</p>
        </div>
        <button class="orient-close" type="button" @click="dismiss">知道了</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 只负责摆位置：整层不吃点击，避免挡住对白带与 HUD */
.orient-layer {
  position: fixed;
  inset: 0;
  z-index: 35; /* 高于剧情页(6)与 CG(20/30)，低于回看/设置面板(40) */
  display: flex;
  justify-content: center;
  align-items: flex-start;
  /* 右侧多留 44px：标题页右上有竖排副标题，别把它压住；
     顶部多留 26px：让开左上角的「AI辅助生成」角标（z-index 低于它，不让就叠在一起） */
  padding: calc(max(10px, env(safe-area-inset-top)) + 26px) 44px 0 12px;
  pointer-events: none;
}

.orient-hint {
  /* 整条不吃点击（只有「知道了」按钮吃）——否则它会变成一块点不动的死区，
     剧情页点顶部本该推进对话 */
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(92vw, 420px);
  padding: 9px 10px 9px 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-lift);
}

/* 手机图标：轻微来回转动（prefers-reduced-motion 下静止） */
.orient-icon {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  fill: none;
  stroke: var(--candle);
  stroke-width: 1.5;
  stroke-linecap: round;
  transform-origin: 50% 50%;
  animation: turn 3.2s ease-in-out infinite;
}

@keyframes turn {
  0%,
  35% {
    transform: rotate(0deg);
  }
  55%,
  80% {
    transform: rotate(90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.orient-text {
  min-width: 0;
}

.orient-title {
  margin: 0;
  font-family: var(--font-title);
  font-size: calc(15px * var(--font-scale, 1));
  letter-spacing: 0.02em;
  color: var(--paper);
}

.orient-sub {
  margin: 2px 0 0;
  font-size: calc(12px * var(--font-scale, 1));
  letter-spacing: 0.02em;
  color: var(--text-dim);
}

.orient-close {
  pointer-events: auto;
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid var(--hairline-soft);
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: calc(12.5px * var(--font-scale, 1));
  letter-spacing: 0.06em;
  color: var(--gold);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.orient-close:hover {
  border-color: var(--hairline);
  color: var(--candle);
}

.orient-close:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
}

/* 进出：自上而下轻落，不抢戏 */
.orient-enter-active,
.orient-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.orient-enter-from,
.orient-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .orient-icon {
    animation: none;
  }
  .orient-enter-active,
  .orient-leave-active {
    transition: opacity 0.2s ease;
  }
  .orient-enter-from,
  .orient-leave-to {
    transform: none;
  }
}
</style>
