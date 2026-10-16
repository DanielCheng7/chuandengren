<script setup lang="ts">
/**
 * 剧情页：场景底版 + 旁白居中层 + 对白区（含固定快捷键）
 *
 * 规格来源：《UI 设计书 r3》
 *  §4.5/§4.6 场景旁白居中字卡渐隐、按长度自动推进（2.5–7.5s，点击可跳过）；对白框固定高度
 *  其余旁白（叙述/内心独白）与对白照常走底部对白框
 *  §4.4 快捷操作键固定在对白框右下角（不随内容浮动）；含「隐藏界面」
 *  §4.3 选项出现后 300ms 防连点缓冲
 *  §7   键盘：Space/Enter 推进、Esc 关面板；AI 文案 aria-live
 *  §5   顶栏只留作品名 + 审核 chip；操作集中在屏幕底部 1/3
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AiFish from './AiFish.vue'
import CharacterLayer from './CharacterLayer.vue'
import ChoiceButtons from './ChoiceButtons.vue'
import DevPanel from './DevPanel.vue'
import DialogueBox from './DialogueBox.vue'
import FreeInput from './FreeInput.vue'
import HistoryPanel from './HistoryPanel.vue'
import ItemShowcase from './ItemShowcase.vue'
import LanternVisual from './LanternVisual.vue'
import SceneBackdrop from './SceneBackdrop.vue'
import SceneCard from './SceneCard.vue'
import SettingsPanel from './SettingsPanel.vue'
import Watermark from './Watermark.vue'
import { useSettings } from '@/composables/useSettings'
import { AI_FALLBACK_BUTTON, AI_THINKING_TEXT } from '@/data/fallbackDialogue'
import { getSceneTint } from '@/data/scenes'
import type { StoryEngine } from '@/composables/useStoryEngine'
import type { Line } from '@/types/story'

const props = defineProps<{ engine: StoryEngine }>()
const { settings } = useSettings()
const e = props.engine

const showHistory = ref(false)
/** 游戏设置面板（字号 / 音量） */
const showSettings = ref(false)
/** 隐藏界面：只留舞台，让玩家/评委看完整场景（UI 设计书 §4.4） */
const hudHidden = ref(false)

const phase = computed(() => e.phase.value)
const displayLine = computed<Line | null>(() => {
  if (phase.value === 'lines') return e.currentLine.value
  const list = e.lines.value
  return list[list.length - 1] ?? null
})
const freeInputConfig = computed(() => e.node.value?.freeInput ?? null)
const showAiPanel = computed(() => phase.value === 'ai')
const isAiFailed = computed(() => phase.value === 'ai' && e.aiStatus.value === 'failed')
const showChoices = computed(() => phase.value === 'choice' && e.visibleChoices.value.length > 0)
const showFreeInput = computed(() => phase.value === 'input' && !!freeInputConfig.value)
const showBreak = computed(() => phase.value === 'break')

const lanternState = computed<'half' | 'digital' | 'lit'>(() => {
  if (e.state.lightingChoice || e.state.routeClue) return 'lit'
  if (e.state.route) return 'digital'
  return 'half'
})

/** 场景谐调色：对话带 / 选项带随场景一并切换（写入 --tint，供组件消费；2026-10-16 用户决议） */
const sceneTint = computed(() => getSceneTint(e.sceneKey.value))

/** 立绘层只在角色对白时出现；素材未到位时该层自动不渲染 */
const speakerForLayer = computed(() => {
  const l = displayLine.value
  if (!l || l.type !== 'dialogue') return undefined
  return l.speaker
})

/* ---------- 选项出现后的 300ms 防连点缓冲（UI 设计书 §4.3） ---------- */
const choicesReady = ref(false)
let readyTimer: number | undefined
function scheduleChoicesReady() {
  window.clearTimeout(readyTimer)
  if (phase.value !== 'choice') {
    choicesReady.value = false
    return
  }
  choicesReady.value = false
  readyTimer = window.setTimeout(() => {
    choicesReady.value = true
  }, 300)
}

/* ---------- 场景旁白：居中字卡 + 渐隐自动推进（UI 设计书 r3 §4.6） ---------- */
/**
 * 场景旁白的两条来源：
 *   ① 行类型 `caption`——画面描述类（含场景切换题注、无前缀的画面说明）；
 *   ② 兼容写法 `场景 `key`｜描述` 形式的舞台题注（剥离前缀后居中显示）。
 * 其余旁白（叙述/内心独白）与对白照常走底部对白框。
 */
const currentSceneCard = computed<Line | null>(() => {
  if (phase.value !== 'lines') return null // 抉择/输入/AI 阶段不再叠字卡
  const l = displayLine.value
  if (!l || l.item) return null // 道具亮相行由 ItemShowcase 接管，不叠字卡
  if (l.type === 'caption') return l
  if (l.type === 'stage') {
    const m = /^场景\s*`([^`]+)`｜(.+)$/s.exec(l.text)
    if (m) return { text: m[2].trim(), type: 'caption', sceneTag: m[1] }
  }
  return null
})

/** 审核模式给出剧本原文写法（含场景 key／提示符号），演示模式只给描述 */
const sceneCardText = computed<string | null>(() => {
  const c = currentSceneCard.value
  if (!c) return null
  if (!settings.showStageNotes) return c.text
  if (c.scriptRaw) return c.scriptRaw
  return c.sceneTag ? `场景 ${c.sceneTag}｜${c.text}` : c.text
})

/* ---------- 道具亮相：整屏光雾 + 中央道具 + 文字（UI 设计书 r4 §4.6） ---------- */
/**
 * 带 `item` 标记的行离开对白框，改以「光雾 + 道具 + 文字」呈现：
 * 连续标记行是一个「注视段」（道具不动、文字逐行渐换），推进到无标记行时落幕。
 * 停留时长与自动推进走同一套计时器（见 scheduleCardAdvance）。
 */
const currentItem = computed<Line | null>(() => {
  if (phase.value !== 'lines') return null
  const l = displayLine.value
  return l?.item ? l : null
})

/** 审核模式给出剧本原文（如汇合点提示），演示模式只给描述 */
const itemText = computed<string | null>(() => {
  const it = currentItem.value
  if (!it) return null
  if (settings.showStageNotes && it.scriptRaw) return it.scriptRaw
  return it.text
})

const cardToken = computed(() => `${e.nodeId.value}:${e.lineIndex.value}`)

let cardTimer: number | undefined
function clearCardTimer() {
  window.clearTimeout(cardTimer)
  cardTimer = undefined
}

/** 停留时长按文字长度：1500ms 基础 + 130ms/字，钳制在 2.5–7.5s */
function scheduleCardAdvance() {
  clearCardTimer()
  if (phase.value !== 'lines') return

  // 道具亮相：注视节奏更缓，2.2–4.6s 逐行推进（点击可跳过整段中的当前行）
  const it = currentItem.value
  if (it) {
    const chars = Array.from(it.text).length
    const delay = Math.min(4600, Math.max(2200, 1500 + chars * 90))
    cardTimer = window.setTimeout(() => {
      if (phase.value === 'lines' && currentItem.value) e.advance()
    }, delay)
    return
  }

  const card = currentSceneCard.value
  if (!card) return
  const chars = Array.from(card.text).length
  const delay = Math.min(7500, Math.max(2500, 1500 + chars * 130))
  cardTimer = window.setTimeout(() => {
    if (phase.value === 'lines' && currentSceneCard.value) e.advance()
  }, delay)
}

// 行 / 节点 / 阶段变化时重排（手动点击推进同样触发，自动取消旧计时）
watch([phase, () => e.nodeId.value, () => e.lineIndex.value], scheduleCardAdvance, {
  immediate: true,
})

/* ---------- 推进与隐藏界面 ---------- */
function onStageClick() {
  if (hudHidden.value) {
    hudHidden.value = false // 隐藏态下任意点击先恢复界面，不推进剧情
    return
  }
  if (phase.value === 'lines') e.advance()
}

function hideUi() {
  if (phase.value === 'ai') return // 一次只让玩家做一件事：AI 思考中不给其他动作
  hudHidden.value = true
}

/* ---------- 键盘（UI 设计书 §7） ---------- */
function onKeydown(ev: KeyboardEvent) {
  const target = ev.target as HTMLElement | null
  const tag = target?.tagName

  if (ev.key === 'Escape') {
    if (showSettings.value) {
      showSettings.value = false
      ev.preventDefault()
    } else if (showHistory.value) {
      showHistory.value = false
      ev.preventDefault()
    } else if (hudHidden.value) {
      hudHidden.value = false
      ev.preventDefault()
    }
    return
  }

  if (ev.key === ' ' || ev.key === 'Enter') {
    if (showSettings.value) return // 设置面板打开时不推进剧情
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return // 交给控件自己处理
    if (hudHidden.value) {
      hudHidden.value = false
      ev.preventDefault()
      return
    }
    if (phase.value === 'lines') {
      ev.preventDefault()
      e.advance()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  scheduleChoicesReady()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(readyTimer)
  clearCardTimer()
})

// 阶段变化时重排缓冲计时（选项刚出现的那一刻开始计时）
watch(phase, scheduleChoicesReady)
</script>

<template>
  <div
    class="story"
    :class="{ 'ui-hidden': hudHidden, 'is-choosing': showChoices, 'overlay-open': showHistory }"
    :style="{ '--tint': sceneTint }"
  >
    <SceneBackdrop :scene="e.sceneKey.value" :blur="showChoices" />

    <!-- 转场角标水印：随场景切换浮出（2.4s 起落，UI 设计书 r4 §6） -->
    <Watermark :key="e.sceneKey.value" />

    <!-- 舞台 -->
    <main class="stage" @click="onStageClick">
      <div class="props" :class="{ 'is-choosing': showChoices, 'is-inputting': showFreeInput }">
        <LanternVisual :state="lanternState" :size="212" />
        <CharacterLayer :speaker="speakerForLayer" />

        <!-- 抉择：出现在画面中央（2026-10-16 用户决议）；进出带柔和过渡（防闪屏） -->
        <Transition name="layer">
          <div v-if="showChoices" class="choice-layer">
            <div class="choice-inner">
              <ChoiceButtons
                :choices="e.visibleChoices.value"
                :ready="choicesReady"
                @select="e.choose($event)"
              />
            </div>
          </div>
        </Transition>
      </div>

      <!-- 自由输入：整体置于**窗口中央**（覆盖整个画幅，2026-10-16 用户决议终版）——
           问题 + 输入栏 + 提交 + 预设一屏完整呈现，**不滚动**；进出带柔和过渡（防闪屏） -->
      <Transition name="layer">
        <div v-if="showFreeInput && freeInputConfig" class="input-layer">
          <div class="input-inner">
            <FreeInput
              :config="freeInputConfig"
              @preset="e.usePreset($event)"
              @submit="e.submitFreeInput($event)"
            />
          </div>
        </div>
      </Transition>

      <p v-if="settings.showStageNotes" class="scene-tag">场景底版：{{ e.sceneKey.value }}</p>

      <!-- 场景旁白：画面中央字卡（渐入 → 停留 → 渐隐 → 自动推进，UI 设计书 r3 §4.6） -->
      <SceneCard :text="sceneCardText" :line-key="cardToken" />

      <!-- 道具亮相：整屏光雾 + 中央道具 + 文字（渐入 → 停留 → 渐隐 → 自动推进，UI 设计书 r4 §4.6） -->
      <ItemShowcase :line="currentItem" :text="itemText" :line-key="cardToken" />

      <div class="bottom">
        <div class="dbox-wrap">
          <div class="dbox-blur">
            <!-- 自由输入阶段（2026-10-16 用户决议）：对白框隐去（保留占位），
                 只留问题/输入栏/预设选项——不再残留上一轮对话 -->
            <DialogueBox
              :line="displayLine"
              :class="{ 'is-blank': !!sceneCardText || !!currentItem || showFreeInput }"
              @advance="e.advance()"
            />
          </div>

          <!-- 快捷操作区：固定在对白框右下角（UI 设计书 r3 §4.4）；
               自由输入阶段隐藏（2026-10-16 用户决议），过渡淡出防闪屏 -->
          <div class="quick-zone" :class="{ 'is-hidden': showFreeInput }" @click.stop>
            <button class="tool touch-44" type="button" @click="showHistory = true">回看</button>
            <button class="tool touch-44" type="button" @click="e.restart()">重新开始</button>
            <button class="tool touch-44" type="button" @click="showSettings = true">设置</button>
            <button class="tool touch-44" type="button" @click="e.goTitle()">标题</button>
            <button
              class="tool touch-44"
              type="button"
              :aria-pressed="hudHidden"
              title="只留舞台，点击任意处恢复"
              @click.stop="hideUi()"
            >
              隐藏界面
            </button>
          </div>
        </div>

        <section v-if="showAiPanel" class="ai-panel anim-rise">
          <AiFish :state="isAiFailed ? 'stuck' : 'thinking'" :size="86" />
          <p class="ai-text" aria-live="polite">{{ AI_THINKING_TEXT }}</p>
          <p v-if="isAiFailed" class="ai-fail" aria-live="polite">
            阿鲟没能给出回应。这不影响故事继续。
          </p>
          <button v-if="isAiFailed" class="btn btn-gold" type="button" @click="e.useFallbackReply()">
            {{ AI_FALLBACK_BUTTON }}
          </button>
        </section>

        <section v-else-if="showBreak" class="break-panel anim-rise">
          <h2>第二幕尚未接入</h2>
          <p class="break-line">
            下一节点 <code>{{ e.missingNodeId.value }}</code>（第二幕「问」）尚未接入。
          </p>
          <p class="break-note">
            按分幕开发流程，第一幕已交付人工审核；审核通过后开发第二幕，三条灯路与 `memory` /
            `hasLetter` 门控会在那一幕集中验证。
          </p>
          <div class="break-actions">
            <button class="btn btn-inline" type="button" @click="e.restart()">从头再玩一遍</button>
            <button class="btn btn-inline btn-ghost" type="button" @click="e.goTitle()">
              返回标题
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- 隐藏界面后的恢复提示（2 秒后自动淡出） -->
    <p v-if="hudHidden" class="restore-hint">点击任意处恢复界面</p>

    <!-- 回看：整体半透明覆盖（2026-10-16 参照同类产品优化）；进出带柔和过渡（防闪屏） -->
    <Transition name="layer">
      <HistoryPanel v-if="showHistory" :entries="e.history.value" @close="showHistory = false" />
    </Transition>
    <SettingsPanel v-if="showSettings" @close="showSettings = false" />
    <DevPanel v-if="settings.showDevPanel && !hudHidden" :engine="e" />
  </div>
</template>

<style scoped>
.story {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 隐藏界面：叙事区 / 工具栏 400ms 淡出，只留舞台（UI 设计书 §4.4；顶栏已于 r4 移除） */
.bottom {
  transition: opacity 0.4s ease;
}

.ui-hidden .bottom {
  opacity: 0;
  pointer-events: none;
}

.stage {
  position: relative;
  z-index: 4;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: calc(6px + env(safe-area-inset-top, 0px)) 16px calc(10px + var(--safe-b));
  min-height: 0;
  overflow-y: auto;
  transition: opacity 0.28s ease;
}

/* 打开回看（覆盖层）时：底层叙事整体淡出——背景只留干净的场景氛围
   （2026-10-16 参照同类产品：背景隐约可见且无叙事元素干扰） */
.overlay-open .stage {
  opacity: 0;
  pointer-events: none;
}

.props {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 120px;
}

/* 出选项 / 自由输入时：舞台道具退到背景，聚焦到中央界面 */
.props.is-choosing > :not(.choice-layer),
.props.is-inputting > * {
  opacity: 0.26;
  transition: opacity 0.35s ease;
}

/* ---------- 抉择层：画面中央 ---------- */
.choice-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  place-items: center;
  padding: 2px 4px;
  pointer-events: none;
  /* 字卡/选项背后压一层柔光，保证任何底图上都可读 */
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(6, 11, 20, 0.5) 0%,
    rgba(6, 11, 20, 0.24) 46%,
    transparent 76%
  );
}

.choice-inner {
  width: 100%;
  max-width: 720px; /* 横带式选项（r4）：带宽接近画面 1/2，文字居中两侧留白 */
  max-height: 52dvh;
  overflow-y: auto;
  pointer-events: auto;
}

/* ---------- 输入层：窗口中央（2026-10-16 用户决议终版） ----------
   覆盖整个舞台（画幅），内容一屏完整呈现、不滚动 */
.input-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: grid;
  place-items: center;
  padding: 12px 16px;
  pointer-events: none;
  /* 与抉择层同款柔光垫底，保证任何底图上都可读 */
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(6, 11, 20, 0.5) 0%,
    rgba(6, 11, 20, 0.24) 46%,
    transparent 76%
  );
}

.input-inner {
  width: 100%;
  max-width: 640px;
  pointer-events: auto;
}

/* 中央层（抉择 / 输入）进出过渡：淡入淡出——防「突现突消」闪屏（2026-10-16 用户要求） */
.layer-enter-active {
  transition: opacity 0.32s ease;
}

.layer-leave-active {
  transition: opacity 0.3s ease;
}

.layer-enter-from,
.layer-leave-to {
  opacity: 0;
}

.scene-tag {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: rgba(110, 139, 122, 0.75);
}

.bottom {
  position: relative;
  z-index: 4; /* 高于道具亮相光雾（z3）：快捷键保持可见可点，对白框此时按 is-blank 隐去 */
  display: grid;
  gap: 12px;
  padding-bottom: 4px;
}

/* 对白框包裹层：快捷键固定在本层（对白框）右下角，不随内容浮动 */
.dbox-wrap {
  position: relative;
}

/* 出选项时：底下的对白框虚化退让（快捷操作键保持清晰、可用） */
.dbox-blur {
  transition: filter 0.35s ease, opacity 0.35s ease;
}

.story.is-choosing .dbox-blur {
  filter: blur(5px);
  opacity: 0.5;
}

.quick-zone {
  position: absolute;
  right: 10px;
  bottom: 6px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px;
  transition: opacity 0.3s ease;
}

/* 自由输入阶段隐藏快捷操作键（2026-10-16 用户决议；淡出防闪屏） */
.quick-zone.is-hidden {
  opacity: 0;
  pointer-events: none;
}

/* 场景旁白字卡 / 道具亮相行进时：对白框整体隐去（保留占位，快捷键位置不变） */
.bottom .dbox-wrap .is-blank {
  opacity: 0;
  transition: opacity 0.35s ease;
}

/* AI 状态（毛玻璃·暖边） */
.ai-panel {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 18px;
  background: var(--glass-bg-soft);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(232, 163, 61, 0.3);
  border-radius: var(--radius);
  text-align: center;
}

.ai-text {
  margin: 0;
  font-family: var(--font-title);
  font-size: 18px;
  letter-spacing: 0.1em;
  color: var(--gold);
  animation: breathe 2.6s ease-in-out infinite;
}

.ai-fail {
  margin: 0;
  font-size: 14.5px;
  color: var(--text-dim);
}

/* 幕间占位（毛玻璃） */
.break-panel {
  display: grid;
  gap: 10px;
  padding: 18px;
  background: var(--glass-bg-soft);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
}

.break-panel h2 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 21.5px;
  letter-spacing: 0.18em;
  color: var(--gold);
}

.break-line {
  margin: 0;
  font-size: 16.5px;
}

.break-line code {
  color: var(--gold);
  font-size: 14px;
}

.break-note {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--text-dim);
}

.break-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 快捷操作键（内嵌于对白框右下角，UI 设计书 r2 §4.4）
   视觉轻量：无边框文字键；悬停透出暖金底；触屏设备按 coarse 放大视觉尺寸 */
.tool {
  min-height: 26px;
  padding: 4px 10px;
  font-size: 13.5px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

@media (hover: hover) and (pointer: fine) {
  .tool:hover {
    color: var(--paper);
    background: rgba(232, 163, 61, 0.14);
    border-color: rgba(232, 163, 61, 0.25);
  }
}

.tool:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
}

/* 触屏：放大视觉尺寸（配合 .touch-44 外扩热区） */
@media (pointer: coarse) {
  .tool {
    min-height: 38px;
    padding: 8px 10px;
    font-size: 14px;
  }
}

.restore-hint {
  position: absolute;
  left: 50%;
  bottom: calc(18px + var(--safe-b));
  z-index: 6;
  margin: 0;
  transform: translateX(-50%);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  pointer-events: none;
  animation: hint-fade 2.6s ease forwards;
}

@keyframes hint-fade {
  0%,
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@media (min-width: 720px) {
  .stage {
    padding-inline: 24px;
  }
}

/* 桌面 16:9 横屏画幅（r4）：对白框全宽——完全覆盖画面下方（2026-10-16 用户决议） */
@media (min-width: 900px) and (min-height: 600px) {
  .stage {
    padding: 8px 0 12px;
  }

  /* 审核场景标签保留左右呼吸（对白框已全宽贴边） */
  .scene-tag {
    margin-inline: 36px;
  }

  .bottom {
    width: 100%;
  }

  /* 附属面板（AI / 幕间）保持窄列居中，避免全宽拉伸 */
  .ai-panel,
  .break-panel {
    width: 100%;
    max-width: 720px;
    margin-inline: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom,
  .ai-text,
  .restore-hint {
    transition: none;
    animation: none;
  }

  .layer-enter-active,
  .layer-leave-active {
    transition: none;
  }
}
</style>
