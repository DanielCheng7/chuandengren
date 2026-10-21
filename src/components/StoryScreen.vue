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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AiFish from './AiFish.vue'
import CharacterLayer from './CharacterLayer.vue'
import ChoiceButtons from './ChoiceButtons.vue'
import DevPanel from './DevPanel.vue'
import DialogueBox from './DialogueBox.vue'
import FreeInput from './FreeInput.vue'
import HistoryPanel from './HistoryPanel.vue'
import ItemShowcase from './ItemShowcase.vue'
import SceneBackdrop from './SceneBackdrop.vue'
import SceneCard from './SceneCard.vue'
import SettingsPanel from './SettingsPanel.vue'
import Watermark from './Watermark.vue'
import { useSettings } from '@/composables/useSettings'
import { CHAPTERS, storyNodes } from '@/data/story'
import { AI_FALLBACK_BUTTON, AI_THINKING_TEXT } from '@/data/fallbackDialogue'
import { getSceneTint } from '@/data/scenes'
import type { StoryEngine } from '@/composables/useStoryEngine'
import type { FreeInputConfig, Line, SceneKey } from '@/types/story'

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
/**
 * 输入界面配置：普通自由输入 或 判定触点（stance）——统一适配成 FreeInput 所需形状。
 * 触点复用同一界面（3 预设 + 自由输入 + 可跳过，UI 设计书 §5.9）。
 */
const inputConfig = computed<FreeInputConfig | null>(() => {
  const n = e.node.value
  if (!n) return null
  if (n.freeInput) return n.freeInput
  if (n.stance) {
    const s = n.stance
    return {
      question: s.question,
      placeholder: s.placeholder,
      limit: s.limit,
      presets: s.presets.map((p) => ({ id: p.id, text: p.text, response: [] })),
      aiPromptKey: s.aiPromptKey,
      skippable: s.skippable,
      submitLabel: s.submitLabel,
    }
  }
  return null
})
const showAiPanel = computed(() => phase.value === 'ai')
const isAiFailed = computed(() => phase.value === 'ai' && e.aiStatus.value === 'failed')
const showChoices = computed(() => phase.value === 'choice' && e.visibleChoices.value.length > 0)
const showFreeInput = computed(() => phase.value === 'input' && !!inputConfig.value)
const showBreak = computed(() => phase.value === 'break')

/**
 * 断点屏的「已接入章节」按实际节点表算——不硬编码进度。
 * 分章开发期每接入一章文案自动跟上，避免出现「已到第三章却写着第二章已数据化」这类过期说明。
 */
const readyChapters = computed(() =>
  CHAPTERS.filter((c) => !!storyNodes[c.entry]).map((c) => c.title)
)

/** 任一覆盖层（回看 / 设置 / 调试面板）打开时：键盘不推进剧情（BUG-1 修复） */
const overlayOpen = computed(
  () => showHistory.value || showSettings.value || settings.showDevPanel
)

const isMontage = computed(() => e.node.value?.kind === 'montage')

/** 现实篇（EP-N1–N6）：非虚构段，允许整段跳过、直接落结局页（《开发文档》§2.4） */
const inRealChapter = computed(() => /^EP-N/.test(e.nodeId.value))

/** 纯图片镜头（序章 montage 无字屏）：对白框隐去，只留画面 */
const isHoldShot = computed(() => {
  const n = e.node.value
  return !!n && n.kind === 'montage' && e.lines.value.length === 0 && !!n.backdrop
})

/**
 * 幕基调场景：一幕内统一背景色板与 UI 主题色，避免场景切换时配色频繁跳变
 * （2026-10-17 用户决议：一幕中不频繁变更主题配色、切换不瞬间曝光）。
 * 未列出的幕回落到当前场景（后续章节正式接入时按需补充）。
 */
const CHAPTER_SCHEME: Record<string, SceneKey> = {
  '序章·一盏灯的一生': 'dry_field',
  '第一章·灯往何处去': 'laoxu_street',
  '第二章·两条路': 'lantern_workshop',
  '第三章·灯会前夜': 'banyan_night',
  '最终抉择·你的手往哪里放': 'lantern_workshop',
  '链A·守旧线': 'workshop_next_year',
  '链B·创新线': 'studio_night',
  '链C·合流线': 'lantern_workshop',
  '尾声·游鱼夜': 'fish_parade',
}
/** 未显式映射的幕：进入该幕时记录首个场景作为基调，幕内固定不变（后续章节接入也不会跳色） */
const schemeFallback = ref<SceneKey>(e.sceneKey.value)
watch(
  () => e.chapter.value,
  () => {
    schemeFallback.value = e.sceneKey.value
  },
  { immediate: true }
)
const schemeScene = computed<SceneKey>(
  () => CHAPTER_SCHEME[e.chapter.value] ?? schemeFallback.value
)

/** 场景谐调色：写入 --tint，供对话带 / 选项带消费；按幕统一（幕内不随场景跳色） */
const sceneTint = computed(() => getSceneTint(schemeScene.value))

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
/** 字卡过场 key：用显示文本——同文延续、异文过场。
 *  序章「一条鱼，先是一根竹。」横跨 PRO-1a（竹林）／PRO-1b（手与刀）两张图时不重新弹出。 */
const sceneCardKey = computed(() => sceneCardText.value ?? '')

let cardTimer: number | undefined
function clearCardTimer() {
  window.clearTimeout(cardTimer)
  cardTimer = undefined
}

/** 停留时长按文字长度：1500ms 基础 + 130ms/字，钳制在 2.5–7.5s；序章蒙太奇每屏再 +2s */
function scheduleCardAdvance() {
  clearCardTimer()
  if (phase.value !== 'lines') return

  // 覆盖层（回看／设置／调试面板）打开时挂起自动推进——关掉后由 watch 重新计时
  if (overlayOpen.value) return

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
  if (card) {
    const chars = Array.from(card.text).length
    // 序章蒙太奇节奏更缓：每屏停留 +2s（2026-10-18 用户决议）
    const montageExtra = e.node.value?.kind === 'montage' ? 2000 : 0
    const delay = Math.min(7500, Math.max(2500, 1500 + chars * 130)) + montageExtra
    cardTimer = window.setTimeout(() => {
      if (phase.value === 'lines' && currentSceneCard.value) e.advance()
    }, delay)
    return
  }

  // 普通台词／旁白：仅在「自动播放」开启时推进（字卡与道具原本就走自动节奏，不叠加）
  if (!settings.autoPlay) return
  const chars = Array.from(displayLine.value?.text ?? '').length
  // 打字机耗时 + 阅读停留（≥1.4s，长句最多 3.2s）——先算打字，避免半行被跳走
  const typeMs = settings.typewriter ? chars * settings.typewriterSpeed : 0
  const holdMs = Math.min(3200, Math.max(1400, 1200 + chars * 25))
  cardTimer = window.setTimeout(() => {
    if (phase.value === 'lines' && !currentItem.value && !currentSceneCard.value) e.advance()
  }, typeMs + holdMs)
}

// 行 / 节点 / 阶段变化时重排（手动点击推进同样触发，自动取消旧计时）
watch([phase, () => e.nodeId.value, () => e.lineIndex.value], scheduleCardAdvance, {
  immediate: true,
})

// 开关自动播放、关掉覆盖层 → 重新起算（否则要么白等旧计时，要么永远停住）
watch([() => settings.autoPlay, overlayOpen], scheduleCardAdvance)

/**
 * 选项／自由输入＝必须由玩家决定的一刻：**关闭**自动播放（不是暂停），
 * 选完之后也不恢复——避免玩家离开时替他选掉分支。
 */
watch(phase, (p) => {
  if ((p === 'choice' || p === 'input') && settings.autoPlay) settings.autoPlay = false
})

/* ---------- 推进与隐藏界面 ---------- */
/**
 * 统一的"推进"入口：交给 DialogueBox 判断——打字中先补全本行，打完再推进。
 * 舞台点击与 Space/Enter 都走这里，避免"点画面吞掉整行"。
 */
const dboxRef = ref<InstanceType<typeof DialogueBox> | null>(null)
function tapOrAdvance() {
  if (dboxRef.value) dboxRef.value.tap()
  else e.advance()
}

function onStageClick() {
  if (hudHidden.value) {
    hudHidden.value = false // 隐藏态下任意点击先恢复界面，不推进剧情
    return
  }
  if (phase.value === 'lines') tapOrAdvance()
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
    if (overlayOpen.value) return // 覆盖层（回看/设置/调试面板）打开时不推进剧情
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return // 交给控件自己处理
    if (hudHidden.value) {
      hudHidden.value = false
      ev.preventDefault()
      return
    }
    if (phase.value === 'lines') {
      ev.preventDefault()
      tapOrAdvance()
    }
    return
  }

  // 审核工作流：Shift+D 开关调试面板（面板默认隐藏；调试/审核属非玩家 UI，演示前经「演示模式」一键隐藏）
  if (ev.key === 'D' && ev.shiftKey && !ev.repeat) {
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    settings.showDevPanel = !settings.showDevPanel
    ev.preventDefault()
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

/* ---------- 立绘贴边基准：对白带顶边 ----------
   阿鲟要「贴在对白框上沿、不压字」，但对白带高度是会变的——字号设置、
   选项带、自由输入面板、移动端安全区都会改变它。所以这里实测
   「对白带顶边 → 画面底部」的距离，写成 CSS 变量 `--dbox-top`，
   立绘层用 `bottom: calc(var(--dbox-top) + 6px)` 消费：
   任何分辨率／窗口尺寸下都贴边，且永不上探盖住文字。 */
const storyRef = ref<HTMLElement | null>(null)
const bottomRef = ref<HTMLElement | null>(null)
const dboxWrapRef = ref<HTMLElement | null>(null)
const dboxTop = ref(192)
let dboxRO: ResizeObserver | undefined

function syncDboxTop() {
  const root = storyRef.value
  const box = dboxWrapRef.value
  if (!root || !box) return
  const r = root.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  if (!r.height) return // 还没真正排版（隐藏/未挂载）时不要写入错值
  dboxTop.value = Math.max(0, Math.round(r.bottom - b.top))
}

onMounted(async () => {
  await nextTick()
  syncDboxTop()
  // 字体/画面进来会改变行高 → 首帧后再校两次；字体就绪后再校一次
  requestAnimationFrame(() => {
    syncDboxTop()
    requestAnimationFrame(syncDboxTop)
  })
  document.fonts?.ready.then(syncDboxTop).catch(() => {})

  if (typeof ResizeObserver !== 'undefined') {
    dboxRO = new ResizeObserver(syncDboxTop)
    // 对白带本身会变高（选项带／自由输入面板／AI 面板），底栏整体也要盯
    if (dboxWrapRef.value) dboxRO.observe(dboxWrapRef.value)
    if (bottomRef.value) dboxRO.observe(bottomRef.value)
    if (storyRef.value) dboxRO.observe(storyRef.value)
  }
  window.addEventListener('resize', syncDboxTop)
  window.addEventListener('orientationchange', syncDboxTop)
})

onUnmounted(() => {
  dboxRO?.disconnect()
  window.removeEventListener('resize', syncDboxTop)
  window.removeEventListener('orientationchange', syncDboxTop)
})
</script>

<template>
  <div
    ref="storyRef"
    class="story"
    :class="{ 'ui-hidden': hudHidden, 'is-choosing': showChoices, 'overlay-open': showHistory }"
    :style="{ '--tint': sceneTint, '--dbox-top': `${dboxTop}px` }"
  >
    <SceneBackdrop
      :scene="e.sceneKey.value"
      :scheme="schemeScene"
      :blur="showChoices"
      :backdrop="e.node.value?.backdrop"
    />

    <!-- 人物立绘：**常驻在场**（2026-10-19 按 galgame 惯例重做）——
         挂在 stage 之外、z-index 低于舞台：对白带自然盖住人物下半身，
         也不会给可滚动的 .stage 添滚动条。在场人物由引擎 cast 决定，
         旁白行不改变 cast，所以旁白时立绘不消失。 -->
    <CharacterLayer :cast="e.cast.value" :side="e.castSide.value" />

    <!-- 幕间角标水印：仅幕（章）切换时浮出（2.4s 起落，UI 设计书 r4 §6）；
         普通场景切换不再浮出（2026-10-17 用户决议） -->
    <Watermark :key="e.chapter.value" />

    <!-- 舞台 -->
    <main class="stage" @click="onStageClick">
      <div class="props" :class="{ 'is-choosing': showChoices, 'is-inputting': showFreeInput }">
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
        <div v-if="showFreeInput && inputConfig" class="input-layer">
          <div class="input-inner">
            <FreeInput
              :config="inputConfig"
              :skippable="!!e.node.value?.stance?.skippable"
              @preset="e.usePreset($event)"
              @submit="e.submitFreeInput($event)"
              @skip="e.skipStance()"
            />
          </div>
        </div>
      </Transition>

      <p v-if="settings.showStageNotes" class="scene-tag">场景底版：{{ e.sceneKey.value }}</p>

      <!-- 场景旁白：画面中央字卡（渐入 → 停留 → 渐隐 → 自动推进，UI 设计书 r3 §4.6）。
           :key=chapter —— 跨幕时整块重建、旧字卡立即销毁，保证进入下一幕时上一幕
           文字完全退场（不随 0.95s 淡出残留在新场景上；2026-10-18 用户决议） -->
      <SceneCard :key="e.chapter.value" :text="sceneCardText" :line-key="sceneCardKey" />

      <!-- 道具亮相：整屏光雾 + 中央道具 + 文字（渐入 → 停留 → 渐隐 → 自动推进，UI 设计书 r4 §4.6） -->
      <ItemShowcase :line="currentItem" :text="itemText" :line-key="cardToken" />

      <div ref="bottomRef" class="bottom">
        <div ref="dboxWrapRef" class="dbox-wrap">
          <div class="dbox-blur">
            <!-- 自由输入阶段（2026-10-16 用户决议）：对白框隐去（保留占位），
                 只留问题/输入栏/预设选项——不再残留上一轮对话 -->
            <DialogueBox
              ref="dboxRef"
              :line="displayLine"
              :class="{ 'is-blank': !!sceneCardText || !!currentItem || showFreeInput || isHoldShot }"
              @advance="e.advance()"
            />
          </div>

          <!-- 快捷操作区：固定在对白框右下角（UI 设计书 r3 §4.4）；
               自由输入阶段隐藏（2026-10-16 用户决议），过渡淡出防闪屏 -->
          <div class="quick-zone" :class="{ 'is-hidden': showFreeInput }" @click.stop>
            <!-- 序章蒙太奇：可跳过（不可快进）——《开发文档》§6.3 -->
            <button
              v-if="isMontage"
              class="tool touch-44 is-skip"
              type="button"
              title="跳过序章，直接进入第一章"
              @click="e.skipMontage()"
            >
              跳过序章
            </button>
            <button
              v-if="inRealChapter"
              class="tool touch-44 is-skip"
              type="button"
              title="跳过现实篇，直接看结局页"
              @click="e.jumpTo('END')"
            >
              跳过现实篇
            </button>
            <button
              class="tool touch-44"
              :class="{ 'is-on': settings.autoPlay }"
              type="button"
              :aria-pressed="settings.autoPlay"
              :title="
                settings.autoPlay
                  ? '自动播放中：点击关闭（遇选项会自动关闭）'
                  : '自动逐行推进正文（遇选项自动关闭）'
              "
              @click.stop="settings.autoPlay = !settings.autoPlay"
            >
              自动
            </button>
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
          <h2>下一节点尚未接入</h2>
          <p class="break-line">
            下一节点 <code>{{ e.missingNodeId.value }}</code> 尚未接入（分章开发中）。
          </p>
          <p class="break-note">
            已接入：{{ readyChapters.join('、') }}。当前进度与待接入清单见《开发文档》§7.3；
            调试面板（Shift+D）可跳转各章节入口核对剧情。
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

/* 覆盖层打开时立绘一起退到背景（保留一点轮廓，不做硬切） */
.overlay-open :deep(.char-stage) {
  opacity: 0.18;
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
  transition: opacity 0.45s ease;
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
/* 选项带进出放柔：与背景虚化（0.55s）同步收放，选中后衔接不突兀（2026-10-17） */
.layer-enter-active {
  transition: opacity 0.42s ease;
}

.layer-leave-active {
  transition: opacity 0.42s ease;
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

/* 跳过序章（蒙太奇期间出现；暖金强调，与常规快捷键区分） */
.tool.is-skip {
  color: var(--gold);
  background: rgba(232, 163, 61, 0.1);
  border-color: rgba(232, 163, 61, 0.38);
}

/* 自动播放开启态：烛光橙（与「跳过序章」的暖金区分），常亮表示正在自动推进 */
.tool.is-on {
  color: var(--candle);
  background: rgba(255, 182, 92, 0.12);
  border-color: rgba(255, 182, 92, 0.42);
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
