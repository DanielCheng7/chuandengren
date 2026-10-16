<script setup lang="ts">
/**
 * 选项按钮组（2–3 个，移动端竖屏足够大）
 *
 * 规格（《UI 设计书 r4》§4.3 / §4.2）：
 *  - 当前行播完 → 300ms 缓冲（父级用 ready 控制）→ 逐项上浮错峰 +80ms/项
 *  - 选中后「点亮」250ms 再转场，期间锁定不可再点（防误触）
 *  - 门控选项不渲染（由引擎过滤）；选项本身是固定文本，绝不标 AI
 *  - 横带式选项（r4）：中间实、两端渐隐的横带，文字居中；无边框、直角；
 *    底色为**场景谐调色**（`--tint`，由 StoryScreen 随场景写入，与画面配色统一）
 *  - **点击点亮动画**（2026-10-16 用户决议）：选中时整带亮度脉冲（「被点亮」）
 *    + 暖金渐晕自中央淡入 + 文字变金，保持至转场；无缩放/位移（遵循 §6 禁令）
 *  - 2026-10-16 用户决议：**不再显示剧本编号 chip**（编号核对以剧本数据源为准）
 */
import { computed, ref, watch } from 'vue'
import { useSettings } from '@/composables/useSettings'
import type { Choice } from '@/types/story'

const props = defineProps<{ choices: Choice[]; ready?: boolean }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()

const { settings } = useSettings()

const items = computed(() => props.choices)
const selectedId = ref<string | null>(null)

// 换一组选项时重置选中态
watch(items, () => {
  selectedId.value = null
})

function pick(id: string) {
  if (selectedId.value) return // 已选中：锁定
  if (props.ready === false) return // 出现后 300ms 内无效（防连点）
  selectedId.value = id
  window.setTimeout(() => emit('select', id), 250)
}
</script>

<template>
  <div class="choices" :class="{ 'not-ready': ready === false }">
    <div v-if="items.length === 0" class="empty">（本节点没有可选项，请检查剧本数据）</div>
    <button
      v-for="(c, i) in items"
      :key="c.id"
      class="btn choice anim-rise"
      :class="{ 'is-selected': selectedId === c.id }"
      type="button"
      :style="{ animationDelay: `${i * 80}ms` }"
      @click="pick(c.id)"
    >
      <span class="label">{{ c.text }}</span>
      <span v-if="settings.showChoiceIds && c.note" class="note">{{ c.note }}</span>
    </button>
  </div>
</template>

<style scoped>
.choices {
  display: grid;
  gap: 18px;
}

/* ---------- 横带式选项（r4）：中间实、两端渐隐，文字居中，底色随场景 ---------- */
.choice {
  --band: linear-gradient(
    90deg,
    rgba(var(--tint, 30, 47, 80), 0) 0%,
    rgba(var(--tint, 30, 47, 80), 0.7) 22%,
    rgba(var(--tint, 30, 47, 80), 0.88) 50%,
    rgba(var(--tint, 30, 47, 80), 0.7) 78%,
    rgba(var(--tint, 30, 47, 80), 0) 100%
  );
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 56px;
  padding: 15px 28px;
  text-align: center;
  background: var(--band);
  border: none;
  border-radius: 0;
  transition: filter 0.2s ease, transform 0.12s ease;
}

/* 去掉 .btn 的灯芯线（横带样式由亮度承担反馈） */
.choice::before {
  content: none;
}

/* 点亮渐晕层：选中时自中央淡入（暖金） */
.choice::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(232, 163, 61, 0) 0%,
    rgba(232, 163, 61, 0.3) 50%,
    rgba(232, 163, 61, 0) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

@media (hover: hover) and (pointer: fine) {
  .choice:hover {
    background: var(--band); /* 抵消全局 .btn:hover 的暖金卡片背景 */
    border-color: transparent;
    filter: brightness(1.18);
  }
}

/* 按下瞬间即亮（与选中的脉冲衔接成一次「点亮」） */
.choice:active {
  filter: brightness(1.3);
}

/* ---------- 选中：「被点击」点亮动画（脉冲 → 渐晕 → 文字金） ---------- */
.choice.is-selected {
  background: linear-gradient(
    90deg,
    rgba(var(--tint, 36, 54, 90), 0) 0%,
    rgba(var(--tint, 36, 54, 90), 0.92) 22%,
    rgba(var(--tint, 36, 54, 90), 0.96) 50%,
    rgba(var(--tint, 36, 54, 90), 0.92) 78%,
    rgba(var(--tint, 36, 54, 90), 0) 100%
  );
  border-color: transparent;
  animation: choice-light 0.5s ease-out;
}

.choice.is-selected::after {
  opacity: 1;
}

/* 亮度脉冲：点击后整带先亮起再稳下（无缩放/位移，遵循 §6 动效禁令） */
@keyframes choice-light {
  0% {
    filter: brightness(1.45);
  }
  100% {
    filter: brightness(1);
  }
}

.chip {
  display: none; /* 2026-10-16 决议：选项不再显示编号 chip（保留样式位以便回退） */
}

.label {
  color: var(--text);
  font-size: 19px; /* 2026-10-16 用户决议：整体再加大 */
  line-height: 1.55;
  text-shadow: 0 1px 10px rgba(8, 14, 28, 0.5);
  transition: color 0.28s ease;
}

.choice.is-selected .label {
  color: var(--gold);
}

.note {
  font-size: 15px;
  line-height: 1.6;
  color: rgba(232, 163, 61, 0.72);
}

.empty {
  font-size: 14px;
  color: var(--seal);
}

/* 300ms 缓冲期内不接受点击（视觉不变，避免"按钮变灰"的挫败感） */
.not-ready {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .anim-rise {
    animation: none;
  }

  .choice.is-selected {
    animation: none;
  }
}
</style>
