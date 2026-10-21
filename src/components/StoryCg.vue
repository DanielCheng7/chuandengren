<script setup lang="ts">
/**
 * 剧情内插播 CG（2026-10-21，首个使用方＝ EP 现实篇《灯火正游来》）
 *
 * 与 `OpeningCg.vue` 同款行为：全屏播放、播完自动继续、点画面或「跳过」提前结束、
 * 音量跟随设置面板；浏览器拦截有声自动播放时静音降级并给一句轻提示。
 *
 * **字幕已烧进成片**（`尾声/EP_字幕版.mp4`），所以这里不叠任何字幕层。
 * 由引擎 `StoryNode.cg` 触发（进入节点即播），播完调用 `finishCg()` 继续 nextNodeId。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ (e: 'done'): void }>()
const { settings } = useSettings()

/**
 * 节点里写的是**相对 `/assets/scenes/` 的路径**（与 `backdrop` 一致）；
 * 以 `/` 开头的视为绝对路径直接用。不转绝对路径会相对当前页面 404。
 */
const fullSrc = computed(() =>
  props.src.startsWith('/') ? props.src : `/assets/scenes/${props.src}`
)

const videoEl = ref<HTMLVideoElement | null>(null)
const muteHint = ref(false)
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
      :src="fullSrc"
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
  z-index: 30;
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

/* 跳过：低调胶囊，不抢画面（与开场 CG 一致） */
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
