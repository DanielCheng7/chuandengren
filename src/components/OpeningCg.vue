<script setup lang="ts">
/**
 * 开场 CG（2026-10-17 用户上传）
 *
 * 点击「开始旅程」后全屏播放，播完自动进入序章 PRO-1a；
 * 点击画面或右下「跳过」可提前进入（评委/重复演示时友好）。
 * 带音轨：播放音量遵循设置面板主音量；若浏览器拦截有声自动播放，自动降级静音。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'

const emit = defineEmits<{ (e: 'done'): void }>()
const { settings } = useSettings()

const videoEl = ref<HTMLVideoElement | null>(null)
/** 是否因浏览器策略被降级为静音（给玩家一个轻提示） */
const muteHint = ref(false)
/** 防重复触发（ended / 跳过 / error 竞态） */
let finished = false

/**
 * 字幕时间轴（2026-10-20）
 * 依据《入场 CG 字幕 · 镜头对照表 v1》：11 个镜头（S4 拆四镜），成片 30.05s。
 * 若成片重新剪辑，只改这张表即可；文案与时间码以对照表为准。
 * 烧录字幕的成片交付版请把 SHOW_CAPTIONS 置 false，避免双层。
 */
const SHOW_CAPTIONS = true

interface Caption {
  from: number
  to: number
  text: string
  /** normal：常规；steps：四道工工序条；credit：落版；note：角落小字 */
  kind?: 'normal' | 'steps' | 'credit1' | 'credit2' | 'note'
  /** 淡入淡出时长（ms）。短镜头用快切，避免"清晰时间"被淡变吃掉 */
  fade?: number
  /** 工序条：整行常驻，按 at 依次点亮当前工序 */
  steps?: { at: number; text: string }[]
}

const CAPTIONS: Caption[] = [
  // S1：等火苗光晕展开再出字（0.35），不抢画面
  { from: 0.35, to: 2.4, text: '粤西 · 遂溪 · 北坡老圩' },
  { from: 2.8, to: 5.4, text: '旱坡地上，水向天借。' },
  { from: 5.9, to: 8.9, text: '三百年前，鱼扎进了灯里。' },
  /**
   * S4a–S4d「四道工」：整行**常驻 4.75 秒**，只有当前工序逐镜点亮。
   * 之前逐镜整条替换，每条只剩 1 秒可读、切换时闪断；改成工序条后
   * 观众随时能看到完整四步，同时当前动作仍然一镜一对应（2026-10-20 用户要求"再放慢"）。
   */
  {
    from: 9.1,
    to: 13.85,
    text: '',
    kind: 'steps',
    fade: 200,
    steps: [
      { at: 9.1, text: '选竹' },
      { at: 10.1, text: '扎骨' },
      { at: 11.3, text: '糊纸' },
      { at: 12.5, text: '绘鳞' },
    ],
  },
  // S5 点亮：无字幕，让画面说话
  // S6：俯拍推镜建立后再出字（+0.5），给"灯河成形"一点时间
  { from: 17.8, to: 22.9, text: '正月十四、十五，百鱼成河。' },
  // S7：鱼灯举过头顶再出字（+0.4）
  { from: 23.4, to: 26.85, text: '鱼化龙，旱地人的愿。' },
  // S8 落版：两行依次淡入，淡变放慢（收尾要稳）
  { from: 27.5, to: 30.0, text: '元宵节（遂溪北坡游鱼）', kind: 'credit1', fade: 600 },
  {
    from: 28.4,
    to: 30.0,
    text: '广东省第七批省级非物质文化遗产 · 2018',
    kind: 'credit2',
    fade: 600,
  },
]

const now = ref(0)
const activeCaptions = computed(() =>
  SHOW_CAPTIONS ? CAPTIONS.filter((c) => now.value >= c.from && now.value < c.to) : []
)

/** 当前点亮的工序序号（-1 = 未进入） */
const stepIndex = computed(() => {
  const c = CAPTIONS.find((x) => x.kind === 'steps')
  if (!c?.steps || now.value < c.from || now.value >= c.to) return -1
  let idx = -1
  c.steps.forEach((s, i) => {
    if (now.value >= s.at) idx = i
  })
  return idx
})

let raf = 0
/** 用 rAF 读播放进度（timeupdate 只有 ~4Hz，1 秒的工序镜头会滞后） */
function tick() {
  const v = videoEl.value
  if (v) now.value = v.currentTime
  raf = requestAnimationFrame(tick)
}

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
  raf = requestAnimationFrame(tick)
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
  cancelAnimationFrame(raf)
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
      src="/assets/scenes/开场/开场CG.mp4"
      @ended="finish"
      @error="finish"
      @click="finish"
    ></video>

    <!-- 字幕层：按时间码对位（S4 四连快切逐镜单字） -->
    <TransitionGroup name="cap">
      <p
        v-for="c in activeCaptions"
        :key="c.text || c.kind"
        class="cg-caption"
        :class="`kind-${c.kind ?? 'normal'}`"
        :style="{ '--cap-fade': `${c.fade ?? 300}ms` }"
      >
        <template v-if="c.steps">
          <template v-for="(s, i) in c.steps" :key="s.text">
            <span class="step" :class="{ 'is-on': i === stepIndex }">{{ s.text }}</span>
            <span v-if="i < c.steps.length - 1" class="sep" aria-hidden="true">·</span>
          </template>
        </template>
        <template v-else>{{ c.text }}</template>
      </p>
    </TransitionGroup>

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

/* ---------- 字幕层（时间轴见 script 里的 CAPTIONS） ---------- */
.cg-caption {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  max-width: min(86%, 46em);
  text-align: center;
  font-family: var(--font-sans);
  font-size: calc(22px * var(--font-scale));
  line-height: 1.7;
  letter-spacing: 0.08em;
  color: rgba(245, 239, 226, 0.92);
  /* 亮场（S5 点亮）也要压得住 */
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  white-space: pre-line;
}

.kind-normal,
.kind-steps {
  bottom: 12%;
}

/* 四道工工序条：整行常驻 4.75s，当前步骤点亮（其余半透明） */
.kind-steps {
  font-size: calc(24px * var(--font-scale));
  letter-spacing: 0.22em;
  white-space: nowrap;
}

.step {
  opacity: 0.35;
  transition: opacity 140ms ease, text-shadow 140ms ease;
}

.step.is-on {
  opacity: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 16px rgba(232, 163, 61, 0.5);
}

.sep {
  margin: 0 0.45em;
  opacity: 0.22;
}

/* 落版：居中两行，依次淡入 */
.kind-credit1 {
  bottom: 24%;
  font-size: calc(28px * var(--font-scale));
  letter-spacing: 0.1em;
}

.kind-credit2 {
  bottom: 18%;
  font-size: calc(18px * var(--font-scale));
  color: rgba(245, 239, 226, 0.8);
}

/* 淡变时长逐条可配（--cap-fade）：短镜头快切、落版放慢 */
.cap-enter-active,
.cap-leave-active {
  transition: opacity var(--cap-fade, 300ms) ease;
}

.cap-enter-from,
.cap-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .cg-caption {
    font-size: calc(18px * var(--font-scale));
  }

  .kind-steps {
    font-size: calc(20px * var(--font-scale));
    letter-spacing: 0.16em;
  }

  .kind-credit1 {
    font-size: calc(22px * var(--font-scale));
  }

  .kind-credit2 {
    font-size: calc(15px * var(--font-scale));
  }
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
