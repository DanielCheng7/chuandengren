<script setup lang="ts">
/**
 * 回看（历史记录）——2026-10-16 参照同类产品（History 页）优化：
 *  - **整屏半透明覆盖**：场景隐约可见（打开时底层叙事已整体淡出，见 StoryScreen .overlay-open）；
 *    膜色随场景谐调色（--tint）；
 *  - **左上大标题**：中文大字「回看」+ 英文小字「HISTORY」；
 *  - **按章分组的记录流**（V3.0）：同章记录只在组首标一次
 *    「第一章·灯往何处去」式标题（**取节点数据的 `chapter` 字段**，V3.0 章序、自动分组），
 *    组内不逐行标节点号；
 *    行＝【名字（语气色，与对话框一致）】+ 文本同行排列，台词带「」、旁白缩进；
 *  - **美化滚动条**（浅轨 + 纸白滑块）；**右下「返回」胶囊**（参考图 Back）。
 * 关闭方式仍三条：返回按钮 + 点击遮罩 + Esc（UI 设计书 §4.9）。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { HistoryEntry } from '@/composables/useStoryEngine'
import { getNode } from '@/data/story'
import { speakerTone } from '@/utils/speakerTone'

const props = defineProps<{ entries: HistoryEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

/** 滚动容器（打开时定位到最新一句，而不是从头看） */
const listEl = ref<HTMLElement | null>(null)

/**
 * 打开回看即**定位到最新剧情进度**（2026-10-21 用户要求）。
 *
 * 直接跳到底、不加平滑动画：回看的用途是"刚才那句是什么"，
 * 滚动动画反而拖慢。`document.fonts.ready` 后再补一次——霞鹜文楷是分包加载的，
 * 字体到位后行高会变，只滚一次可能差出半行。
 */
async function scrollToLatest() {
  await nextTick()
  const el = listEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape') {
    ev.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void scrollToLatest()
  document.fonts?.ready?.then(() => void scrollToLatest()).catch(() => {})
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

/** 名字行：仅对白与短信显示（与对话框一致）；台词行在回看里同样以「」呈现 */
function showWho(h: HistoryEntry): boolean {
  return (h.type === 'dialogue' || h.type === 'sms') && !!h.speaker
}

function displayText(h: HistoryEntry): string {
  if (h.type === 'dialogue') return `「${h.text}」`
  return h.text
}

/** 节点 → 所属章标题（V3.0：取节点数据的 `chapter` 字段，如「第一章·灯往何处去」） */
function chapterOf(nodeId: string): string {
  return getNode(nodeId)?.chapter ?? ''
}

interface Row {
  key: string
  /** 有值＝幕分组标题行 */
  head: string | null
  who: string | null
  text: string | null
  tone: string
  cls: string
  ai: boolean
}

/** 记录流 → 渲染行（章首插入分组标题；行级不再标节点号） */
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  let lastGroup = ''
  props.entries.forEach((h, i) => {
    const group = chapterOf(h.nodeId) || lastGroup || '其他'
    if (group !== lastGroup) {
      lastGroup = group
      out.push({ key: `h${i}`, head: group, who: null, text: null, tone: '', cls: '', ai: false })
    }
    out.push({
      key: `l${i}`,
      head: null,
      who: showWho(h) ? `【${h.speaker}】` : null,
      text: displayText(h),
      tone: speakerTone(h.speaker),
      cls: `t-${h.type}`,
      ai: !!h.aiGenerated,
    })
  })
  return out
})
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <header class="head">
        <h2 class="title-cn">回看</h2>
        <p class="title-en">HISTORY</p>
      </header>

      <div ref="listEl" class="list">
        <p v-if="entries.length === 0" class="empty">还没有可回看的内容。</p>
        <template v-for="row in rows" :key="row.key">
          <!-- 幕分组标题：同幕记录只在组首标一次 -->
          <div v-if="row.head" class="group">
            <span class="group-title">{{ row.head }}</span>
          </div>
          <div v-else class="item" :class="[row.cls, `sp-${row.tone}`]">
            <span v-if="row.who" class="who">{{ row.who }}</span>
            <span class="what">{{ row.text }}</span>
            <span v-if="row.ai" class="ai-badge">AI 生成</span>
          </div>
        </template>
      </div>
    </div>

    <button class="back touch-44" type="button" @click="emit('close')">返 回</button>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  /* 半透明深膜：场景隐约可见（参考图设计）。底层叙事层在打开时已整体淡出
     （StoryScreen .overlay-open），因此膜无需过重——留出场景氛围即可；
     膜色随场景谐调色（--tint） */
  background: rgba(var(--tint, 12, 20, 36), 0.72);
}

.sheet {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ---------- 左上大标题（参考图：大字 + 小字副题） ---------- */
.head {
  flex: none;
  padding: 34px 48px 14px;
}

.title-cn {
  margin: 0;
  font-family: var(--font-title);
  font-size: 42px;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  color: var(--paper);
  text-shadow: 0 1px 18px rgba(8, 14, 28, 0.55);
}

.title-en {
  margin: 8px 0 0;
  font-size: 13px;
  letter-spacing: 0.52em;
  text-indent: 0.52em;
  color: var(--gold);
}

/* ---------- 记录流 ---------- */
.list {
  flex: 1;
  overflow-y: auto;
  width: 100%;
  max-width: 1020px;
  padding: 10px 56px 112px 48px;
  display: grid;
  gap: 20px;
  align-content: start;
}

/* 美化滚动条（参考图的长轨道：浅色轨 + 纸白滑块） */
.list::-webkit-scrollbar {
  width: 10px;
}

.list::-webkit-scrollbar-track {
  background: rgba(245, 239, 226, 0.1);
  border-radius: 6px;
  margin-block: 10px;
}

.list::-webkit-scrollbar-thumb {
  background: rgba(245, 239, 226, 0.38);
  border-radius: 6px;
}

/* 章分组标题：「第一章·灯往何处去」+ 右延细线（章节扉页感） */
.group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
}

.group-title {
  flex: none;
  font-family: var(--font-title);
  font-size: 19px;
  letter-spacing: 0.22em;
  color: var(--gold);
  white-space: nowrap;
  text-shadow: 0 1px 12px rgba(8, 14, 28, 0.5);
}

.group::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(232, 163, 61, 0.42), rgba(232, 163, 61, 0));
}

.item {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 17px;
  line-height: 1.8;
  color: var(--text);
}

.who {
  flex: none;
  font-family: var(--font-title);
  font-size: 17.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.what {
  flex: 1;
  min-width: 0;
  color: var(--text-dim);
}

/* 台词/短信：亮色正文（旁白保持柔和） */
.item.t-dialogue .what,
.item.t-sms .what {
  color: var(--text);
}

/* 选项记录：竹青（沿用） */
.item.t-choice .what {
  color: var(--bamboo);
}

/* 旁白：无名字，整体缩进（让位于「名字」的视觉通道，参考图） */
.item.t-narration {
  padding-left: 3.4em;
}

/* 语气色（与对话框完全一致，共用 speakerTone 映射） */
.sp-gold .who {
  color: var(--gold);
}

.sp-candle .who {
  color: var(--candle);
}

.sp-bamboo .who {
  color: var(--bamboo);
}

.sp-seal .who {
  color: #c9705d;
}

.sp-paper .who {
  color: var(--paper);
}

.sp-dim .who {
  color: var(--text-dim);
}

.empty {
  color: var(--text-faint);
  font-size: 16px;
}

/* ---------- 右下「返回」胶囊（参考图 Back） ---------- */
.back {
  position: absolute;
  right: 44px;
  bottom: calc(30px + var(--safe-b));
  font-family: var(--font-title);
  font-size: 17px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--paper);
  background: rgba(245, 239, 226, 0.1);
  border: 1px solid rgba(245, 239, 226, 0.45);
  border-radius: 999px;
  padding: 10px 26px;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

@media (hover: hover) and (pointer: fine) {
  .back:hover {
    background: rgba(232, 163, 61, 0.2);
    border-color: rgba(232, 163, 61, 0.6);
  }
}

/* ---------- 移动端 ---------- */
@media (max-width: 640px) {
  .head {
    padding: 22px 22px 10px;
  }

  .title-cn {
    font-size: 30px;
  }

  .list {
    padding: 6px 24px 100px 22px;
    gap: 14px;
  }

  .item {
    font-size: 15.5px;
  }

  .item.t-narration {
    padding-left: 2em;
  }

  .back {
    right: 22px;
  }
}
</style>
