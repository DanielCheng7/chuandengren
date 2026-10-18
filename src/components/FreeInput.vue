<script setup lang="ts">
/**
 * S04 自由输入（《规格书》§4.5；《UI 设计书 r4》§4.7）
 * 预设答案与自由输入并存：预设答案走剧本固定回应（不调 AI），自由输入走 AI 功能 A。
 *
 * 2026-10-16 用户决议（输入阶段精简版）：
 *  - 整体展示于**画面中央**（由 StoryScreen 的 input-layer 承载）；
 *  - **移除**「回车换行」提示、字数计数与隐私等注释——只留问题、输入栏、提交与预设；
 *  - 输入框＝**半透明圆角矩形**（最简形态；聚焦稍亮）；光标暖金；
 *  - 预设横带与六处抉择同款（点击点亮 250ms 锁定切换）。
 */
import { computed, ref } from 'vue'
import type { FreeInputConfig } from '@/types/story'

const props = defineProps<{ config: FreeInputConfig; skippable?: boolean }>()
const emit = defineEmits<{
  (e: 'preset', id: string): void
  (e: 'submit', text: string): void
  (e: 'skip'): void
}>()

const value = ref('')
const fieldRef = ref<HTMLTextAreaElement | null>(null)

/**
 * 移动端键盘遮挡（UI 设计书 §4.7）：聚焦时把输入框滚到可视区中部，
 * 保证提交按钮不被软键盘挡住。
 */
function keepVisible() {
  window.setTimeout(() => {
    fieldRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 260)
}

const used = computed(() => Array.from(value.value).length)
const overLimit = computed(() => used.value > props.config.limit)
const canSubmit = computed(() => value.value.trim().length > 0 && !overLimit.value)

function submit() {
  if (!canSubmit.value) return
  emit('submit', value.value)
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit()
}

/* 预设：点击点亮 250ms 后切换（与抉择选项同一节奏；期间锁定防连点） */
const selectedPreset = ref<string | null>(null)
function pickPreset(id: string) {
  if (selectedPreset.value) return
  selectedPreset.value = id
  window.setTimeout(() => emit('preset', id), 250)
}
</script>

<template>
  <div class="free-input">
    <p class="question">{{ config.question }}</p>

    <textarea
      ref="fieldRef"
      v-model="value"
      class="field"
      rows="3"
      :placeholder="config.placeholder"
      @focus="keepVisible"
      @keydown="onKeydown"
    />

    <button class="btn btn-gold submit" type="button" :disabled="!canSubmit" @click="submit">
      用这句话回答阿鲟
    </button>

    <div class="divider"><span>或者，选一个预设答案</span></div>

    <div class="presets">
      <button
        v-for="p in config.presets"
        :key="p.id"
        class="btn preset"
        :class="{ 'is-selected': selectedPreset === p.id }"
        type="button"
        @click="pickPreset(p.id)"
      >
        <span class="label">{{ p.text }}</span>
      </button>
    </div>

    <!-- 可跳过（仅 C2-X 次触点）：幽灵文字键，低调不抢主要行动 -->
    <button v-if="skippable" class="skip" type="button" @click="emit('skip')">
      先不记录，跳过
    </button>
  </div>
</template>

<style scoped>
.free-input {
  display: grid;
  gap: 12px;
}

.question {
  margin: 0;
  text-align: center;
  font-family: var(--font-title);
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 0.06em;
}

/* ---------- 输入框：半透明圆角矩形（2026-10-16 用户决议：最简形态） ---------- */
.field {
  width: 100%;
  padding: 12px 16px;
  min-height: 88px;
  background: rgba(var(--tint, 30, 47, 80), 0.66);
  border: none;
  border-radius: var(--radius);
  color: var(--text);
  caret-color: var(--gold);
  line-height: 1.7;
  resize: vertical;
  transition: background 0.22s ease;
  font-size: 17px; /* ≥16px 防 iOS Safari 聚焦自动放大（UI 设计书 §4.7） */
}

/* 聚焦：底色稍实（无边框，不引入描边闪烁） */
.field:focus {
  outline: none;
  background: rgba(var(--tint, 30, 47, 80), 0.78);
}

.field::placeholder {
  color: var(--text-faint);
}

.divider {
  position: relative;
  text-align: center;
  color: var(--text-faint);
  font-size: 14px;
  margin: 1px 0;
}

.divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--hairline-soft);
}

.divider span {
  position: relative;
  padding: 0 10px;
}

/* ---------- 预设答案：横带式（与六处抉择完全同款） ---------- */
.presets {
  display: grid;
  gap: 12px;
}

.preset {
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
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 50px;
  padding: 12px 26px;
  text-align: center;
  background: var(--band);
  border: none;
  border-radius: 0;
  transition: filter 0.2s ease, transform 0.12s ease;
}

/* 去掉 .btn 的灯芯线（横带样式由亮度承担反馈） */
.preset::before {
  content: none;
}

/* 点亮渐晕层：选中时自中央淡入（暖金） */
.preset::after {
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
  .preset:hover {
    background: var(--band); /* 抵消全局 .btn:hover 的暖金卡片背景 */
    border-color: transparent;
    filter: brightness(1.18);
  }
}

/* 按下瞬间即亮（与选中的脉冲衔接成一次「点亮」） */
.preset:active {
  filter: brightness(1.3);
}

/* 选中：「被点击」点亮动画（脉冲 → 渐晕 → 文字金） */
.preset.is-selected {
  background: linear-gradient(
    90deg,
    rgba(var(--tint, 36, 54, 90), 0) 0%,
    rgba(var(--tint, 36, 54, 90), 0.92) 22%,
    rgba(var(--tint, 36, 54, 90), 0.96) 50%,
    rgba(var(--tint, 36, 54, 90), 0.92) 78%,
    rgba(var(--tint, 36, 54, 90), 0) 100%
  );
  border-color: transparent;
  animation: preset-light 0.5s ease-out;
}

.preset.is-selected::after {
  opacity: 1;
}

@keyframes preset-light {
  0% {
    filter: brightness(1.45);
  }
  100% {
    filter: brightness(1);
  }
}

/* 「先不记录，跳过」：幽灵文字键（仅 C2-X 次触点） */
.skip {
  justify-self: center;
  margin-top: 6px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.1em;
  color: rgba(245, 239, 226, 0.45);
  cursor: pointer;
  transition: color 0.22s ease;
}

.skip:hover {
  color: rgba(245, 239, 226, 0.8);
}

.skip:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}

.preset .label {
  color: var(--text);
  font-size: 19px; /* 与选项同号（2026-10-16 整体加大） */
  line-height: 1.55;
  text-shadow: 0 1px 10px rgba(8, 14, 28, 0.5);
  transition: color 0.28s ease;
}

.preset.is-selected .label {
  color: var(--gold);
}

@media (prefers-reduced-motion: reduce) {
  .preset.is-selected {
    animation: none;
  }
}
</style>
