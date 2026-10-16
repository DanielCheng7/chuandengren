<script setup lang="ts">
/**
 * 对白框：说话人（第一行）+ 正文（第二行起）+ 打字机
 * 点击一次＝跳过打字 / 推进到下一行（由父级处理推进）
 * 舞台提示、编剧备注、引用文字不走打字机
 *
 * 《UI 设计书 r4》：
 *  ① **渐变风格对话带**（用户决议 2026-10-16，取代毛玻璃）：无边框、直角，
 *     顶边一条 1px 暖光细线 + 主体左实右隐的暮蓝渐变（向右侧留白处融入场景）；
 *     固定高度（不随文字变尺寸），随设置字号等比联动；
 *  ② **名字融入框内第一行**（不再单独开小窗）：`【名字】` + 语气色，左对齐；
 *     旁白/舞台题注等无说话人的行保留第一行占位（空）——
 *     **所有行正文一律从第二行同一基线开始**，切换时不跳动；
 *  ③ 场景旁白（`场景 `key`｜描述`）由 SceneCard 居中呈现，此时框体整体隐去但保留占位；
 *  ④ 快捷操作键由父级固定在本框右下角（不再随内容浮动）；「▾」继续指示保留在文末内联；
 *  ⑤ 阿鲟的名字行右侧带标志性金色鱼图案；短信/旧信不再加内层小框；
 *  ⑥ 对白台词以 `「」` 包裹（随打字机逐字打出：先「、正文、末收尾）——
 *     仅呈现层包装，不改剧本文案。
 */
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useTypewriter } from '@/composables/useTypewriter'
import { speakerTone as toneOf } from '@/utils/speakerTone'
import type { Line } from '@/types/story'

const props = defineProps<{ line: Line | null }>()
const emit = defineEmits<{ (e: 'advance'): void }>()

const { settings } = useSettings()

const text = computed(() => props.line?.text ?? '')
const type = computed(() => props.line?.type ?? 'narration')
const instant = computed(() =>
  ['stage', 'note', 'quote', 'subtitle', 'caption'].includes(type.value)
)
const enabled = computed(() => settings.typewriter && !instant.value)
const speed = computed(() => settings.typewriterSpeed)

/**
 * 对白台词以「」包裹呈现（r4：说话句即引用句；仅呈现层，不改文案）。
 * 引号并入打字机文本：先出「、正文逐字、最后收」。
 */
const displayText = computed(() =>
  type.value === 'dialogue' ? `「${text.value}」` : text.value
)

const { displayed, typing, skip } = useTypewriter(displayText, enabled, speed)

const speaker = computed(() => props.line?.speaker ?? '')
/**
 * 只有对白与短信在第一行显示名字；
 * 旁白／内心独白（V2.0 第一人称「我…」）与舞台题注不带名字，第一行保留占位。
 */
const showSpeaker = computed(() => !!speaker.value && ['dialogue', 'sms'].includes(type.value))

const tone = computed(() => toneOf(speaker.value))

function onClick() {
  if (typing.value) {
    skip()
    return
  }
  emit('advance')
}
</script>

<template>
  <div class="dbox" :class="`t-${type}`" @click.stop="onClick">
    <!-- 名字行（框内第一行）：说话人融入对话带，「【名字】」+ 语气色；
         无说话人的行保留空占位，保证所有正文都从第二行同一位置开始 -->
    <div class="name-row" :class="showSpeaker ? `sp-${tone}` : 'is-empty'">
      <template v-if="showSpeaker">
        <span class="name">【{{ speaker }}】</span>
        <!-- 阿鲟：名字行右侧的标志性金色鱼图案（UI 设计书 r3 §4.5） -->
        <svg
          v-if="speaker === '阿鲟'"
          class="fish-ico"
          viewBox="0 0 128 84"
          aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
            <path
              d="M12 42C24 24 56 17 78 27c12 5.5 20 11 25 15-5 4-13 9.5-25 15-22 10-54 3-66-15Z"
            />
            <path d="M103 42c5-8 11-13 16-15-4 8-4 22 0 30-5-2-11-7-16-15Z" />
          </g>
          <circle cx="27" cy="39" r="5" fill="currentColor" />
        </svg>
        <span v-if="line?.aiGenerated" class="ai-badge">AI 生成</span>
      </template>
    </div>

    <div class="text-scroll">
      <p class="text" :class="`line-${type}`">
        <span>{{ displayed }}</span>
        <span v-if="typing" class="caret" aria-hidden="true" />
        <span v-else class="tap" aria-hidden="true">▾</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 对话带（渐变风格，用户决议 2026-10-16 取代毛玻璃） ---------- */
.dbox {
  position: relative;
  /* 固定高度：旁白/对白/短信一致，不随文字变尺寸；随设置字号等比联动 */
  height: calc(172px * var(--font-scale));
  padding: 10px 20px 10px;
  /* ① 顶边 1px 暖光细线（中间亮、两端隐，代表「灯」，不随场景）；② 主体「中间实、
     两端渐隐」的场景谐调色渐变带——`--tint` 由 StoryScreen 随场景写入（夜场偏蓝、
     黄昏偏暖棕……）；与居中排版配合：台词/名字居中，正落在实色核心处；
     缺省回退暮蓝。 */
  background-image:
    linear-gradient(
      93deg,
      rgba(255, 214, 150, 0) 0%,
      rgba(255, 214, 150, 0.42) 50%,
      rgba(255, 214, 150, 0) 100%
    ),
    linear-gradient(
      93deg,
      rgba(var(--tint, 30, 47, 80), 0) 0%,
      rgba(var(--tint, 30, 47, 80), 0.78) 20%,
      rgba(var(--tint, 30, 47, 80), 0.9) 50%,
      rgba(var(--tint, 30, 47, 80), 0.78) 80%,
      rgba(var(--tint, 30, 47, 80), 0) 100%
    );
  background-size: 100% 1px, 100% 100%;
  background-repeat: no-repeat;
  cursor: pointer;
  transition: filter 0.25s ease, opacity 0.35s ease;
}

@media (hover: hover) and (pointer: fine) {
  .dbox:hover {
    filter: brightness(1.05);
  }
}

/* ---------- 名字行（框内第一行；空时占位，正文统一从第二行开始） ----------
   「块居中、行内左对齐」：桌面端名字行与正文块同宽（42em）并整体居中——
   名字与文字一起从画面中间偏左处起始，不贴边、也不做完全居中（2026-10-16 用户决议修订） */
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: calc(30px * var(--font-scale));
  /* 统一 42em 块宽基数（与 .text 同字号；行内子元素字号各自定义）——
     保证名字块与正文块等宽、左缘对齐 */
  font-size: calc(20px * var(--font-scale));
}

.name {
  font-family: var(--font-title);
  font-size: calc(21px * var(--font-scale)); /* 2026-10-16 用户决议：名字字号加大 */
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

/* 阿鲟的金色鱼图案：名字行右侧，与名字同色（暖金） */
.fish-ico {
  width: 26px;
  height: auto;
  flex: none;
  color: var(--gold);
  opacity: 0.95;
}

.sp-gold .name {
  color: var(--gold);
}

.sp-candle .name {
  color: var(--candle);
}
.sp-bamboo .name {
  color: var(--bamboo);
}
.sp-seal .name {
  color: #c9705d;
}
.sp-paper .name {
  color: var(--paper);
}
.sp-dim .name {
  color: var(--text-dim);
}

/* 正文滚动容器（122px = 高度 172 − 上下 padding 20 − 名字行 30） */
.text-scroll {
  height: calc(122px * var(--font-scale));
  overflow-y: auto;
}

.text {
  margin: 0;
  font-size: calc(20px * var(--font-scale)); /* 2026-10-16 用户决议：整体再加大 */
  line-height: 1.85;
  text-align: left; /* 行文左对齐（块整体居中，见下方媒体查询） */
  white-space: pre-wrap;
  word-break: break-word;
}

.caret {
  display: inline-block;
  width: 7px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--gold);
  opacity: 0.75;
  animation: blink 1s steps(2, end) infinite;
}

@keyframes blink {
  0%,
  49% {
    opacity: 0.75;
  }
  50%,
  100% {
    opacity: 0;
  }
}

/* 「▾」继续指示：文末内联 */
.tap {
  display: inline-block;
  margin-left: 8px;
  color: var(--gold);
  opacity: 0.75;
  font-size: 13px;
  animation: float-hint 1.8s ease-in-out infinite;
}

@keyframes float-hint {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(3px);
    opacity: 0.85;
  }
}

/* 舞台提示 / 备注类的行：仅字号收小；保持左对齐（审核辅助信息，不随正文居中） */
.t-stage .text,
.t-note .text {
  font-size: 15.5px;
  text-align: left;
}

.t-quote .text,
.t-subtitle .text {
  font-size: calc(20.5px * var(--font-scale));
}

/* 「块居中、行内左对齐」（2026-10-16 用户决议修订）：
   桌面端名字行与全部正文块限制 42em 宽并整体居中——文字向画面中间靠，
   但每行仍自块左缘起始（不完全居中、不贴左）；手机端不受限、保持全宽 */
@media (min-width: 720px) {
  .name-row,
  .text {
    max-width: 42em;
    margin-inline: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dbox {
    transition: none;
  }

  .caret,
  .tap {
    animation: none;
  }
}
</style>
