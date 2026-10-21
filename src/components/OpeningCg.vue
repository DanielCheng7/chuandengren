<script setup lang="ts">
/**
 * 开场 CG（2026-10-17 用户上传；**2026-10-21 换为字幕烧录版**）
 *
 * 点击「开始旅程」后全屏播放，播完自动进入序章 PRO-1a；
 * 点击画面或右下「跳过」可提前进入（评委/重复演示时友好）。
 * 带音轨：播放音量遵循设置面板主音量；若浏览器拦截有声自动播放，自动降级静音。
 *
 * **字幕已烧进成片**（`开场CG_字幕版.mp4`，30.07s／1920×1080），
 * 所以页面端**不再叠任何字幕层**：原先按时间码渲染的 `CAPTIONS` 覆盖层、
 * `--cap-fade` 淡变与 `.cg-caption` 系列样式已整体移除，避免与内嵌字幕双重显示。
 * 要改字幕文案**请直接改视频**，不要在这里重新加一层——文案与时间码存档见
 * `思路/开场CG字幕_文案与时间码.md`。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'

const emit = defineEmits<{ (e: 'done'): void }>()
const { settings } = useSettings()

const videoEl = ref<HTMLVideoElement | null>(null)
/** 是否因浏览器策略被降级为静音（给玩家一个轻提示） */
const muteHint = ref(false)
/** 防重复触发（ended / 跳过 / error 竞态） */
let finished = false

function finish() {
  if (finished) return
  finished = true
  emit('done')
}

onMounted(async () => {
  const v = videoEl.value
  if (!v) {
    finish()
    return
  }
  v.volume = Math.min(1, Math.max(0, settings.volume / 100))
  if (settings.volume === 0) v.muted = true
  try {
    await v.play()
  } catch {
    // 有声自动播放被拦截 → 静音重试，保证画面继续
    v.muted = true
    muteHint.value = settings.volume > 0
    try {
      await v.play()
    } catch {
      finish()
    }
  }
})

onUnmounted(() => {
  videoEl.value?.pause()
})
</script>

<template>
  <div class="cg">
    <video
      ref="videoEl"
      class="cg-video"
      autoplay
      playsinline
      preload="auto"
      src="/assets/scenes/开场/开场CG_字幕版.mp4"
      @ended="finish"
      @error="finish"
      @click="finish"
    ></video>

    <button class="cg-skip" type="button" @click.stop="finish">跳过 ›</button>
    <p v-if="muteHint" class="cg-mute">已静音播放（浏览器限制）</p>
  </div>
</template>

<style scoped>
.cg {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  background: #05080f;
  animation: cg-in 0.7s ease both;
}

.cg-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

/* 跳过：低调胶囊，不抢画面 */
.cg-skip {
  position: absolute;
  right: 22px;
  bottom: calc(18px + var(--safe-b));
  padding: 7px 16px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.14em;
  color: rgba(245, 239, 226, 0.6);
  background: rgba(10, 16, 28, 0.32);
  border: 1px solid rgba(245, 239, 226, 0.16);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.22s ease, border-color 0.22s ease, background 0.22s ease;
}

.cg-skip:hover {
  color: var(--paper);
  border-color: rgba(232, 163, 61, 0.5);
  background: rgba(10, 16, 28, 0.5);
}

.cg-skip:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
}

.cg-mute {
  position: absolute;
  left: 50%;
  bottom: 22px;
  margin: 0;
  transform: translateX(-50%);
  font-size: 13px;
  letter-spacing: 0.1em;
  color: rgba(245, 239, 226, 0.55);
  pointer-events: none;
}

@keyframes cg-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cg {
    animation: none;
  }
}
</style>
