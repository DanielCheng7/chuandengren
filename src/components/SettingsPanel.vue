<script setup lang="ts">
/**
 * 设置面板（UI 设计书 r3 ⑧ · 2026-10-16 改版）
 *
 * 参考同类作品设置页（System 设置）：中文大标题 + 英文小签、分节标题带英文小签与
 * 下划线分隔、滑杆两端「慢/快」式端点标注、右下「重置 / 返回」。
 * 项目：文字大小（小/标准/大）· 文字显示速度 · 音量；即时生效并经 useSettings 持久化。
 */
import { computed, onMounted, onUnmounted } from 'vue'
import { useSettings } from '@/composables/useSettings'

const emit = defineEmits<{ (e: 'close'): void }>()
const { settings } = useSettings()

const FONT_OPTIONS = [
  { label: '小', value: 0.9 },
  { label: '标准', value: 1 },
  { label: '大', value: 1.2 },
]

function isFontOn(value: number) {
  return Math.abs(settings.fontScale - value) < 0.01
}

/** 速度滑杆：左慢右快（内部为每字毫秒 8–60，向右＝数值变小＝更快） */
const speedSlider = computed({
  get: () => Math.round(100 - ((settings.typewriterSpeed - 8) / (60 - 8)) * 100),
  set: (v: number) => {
    settings.typewriterSpeed = Math.round(60 - (v / 100) * (60 - 8))
  },
})

/** 重置为默认值（字号/速度/音量；不动审核与调试开关） */
function resetAll() {
  settings.fontScale = 1
  settings.typewriterSpeed = 26
  settings.volume = 70
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape') {
    ev.preventDefault()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel anim-rise">
      <header class="head">
        <h2 class="title">设置</h2>
        <p class="title-en">SETTINGS</p>
      </header>

      <div class="body">
        <!-- 分节：文字 -->
        <section class="group">
          <div class="group-head">
            <span class="group-name">文字</span>
            <span class="group-en">TEXT</span>
          </div>

          <div class="row">
            <span class="row-label">
              文字大小
              <span class="row-en">FONT SIZE</span>
            </span>
            <div class="seg" role="radiogroup" aria-label="文字大小">
              <button
                v-for="o in FONT_OPTIONS"
                :key="o.value"
                class="seg-btn"
                :class="{ 'is-on': isFontOn(o.value) }"
                type="button"
                role="radio"
                :aria-checked="isFontOn(o.value)"
                @click="settings.fontScale = o.value"
              >
                {{ o.label }}
              </button>
            </div>
          </div>

          <div class="row stacked">
            <span class="row-label">
              文字显示速度
              <span class="row-en">TEXT SPEED</span>
            </span>
            <div class="slider-row">
              <span class="edge">慢</span>
              <input
                v-model.number="speedSlider"
                class="slider"
                type="range"
                min="0"
                max="100"
                step="5"
                aria-label="文字显示速度"
              />
              <span class="edge">快</span>
            </div>
          </div>
        </section>

        <!-- 分节：声音 -->
        <section class="group">
          <div class="group-head">
            <span class="group-name">声音</span>
            <span class="group-en">SOUND</span>
          </div>

          <div class="row stacked">
            <span class="row-label">
              音量
              <span class="row-en">VOLUME</span>
            </span>
            <div class="slider-row">
              <span class="edge">小</span>
              <input
                v-model.number="settings.volume"
                class="slider"
                type="range"
                min="0"
                max="100"
                step="5"
                aria-label="音量"
              />
              <span class="edge">大</span>
              <span class="val">{{ settings.volume }}%</span>
            </div>
          </div>
        </section>
      </div>

      <footer class="foot">
        <button class="pill" type="button" @click="resetAll">
          重置 <span class="pill-en">RESET</span>
        </button>
        <button class="pill is-primary" type="button" @click="emit('close')">
          返回 <span class="pill-en">BACK</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(16, 26, 46, 0.6);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

.panel {
  width: min(560px, 100%);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
}

/* 大标题（中文大字 + 英文小签，参考同类作品设置页） */
.head {
  padding: 22px 26px 0;
}

.title {
  margin: 0;
  font-family: var(--font-title);
  font-size: 30px;
  letter-spacing: 0.22em;
  color: var(--paper);
}

.title-en {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 0.34em;
  color: var(--text-faint);
}

.body {
  padding: 6px 26px 4px;
}

/* 分节：中文名 + 英文小签 + 下划线分隔（参考图样式） */
.group {
  padding: 12px 0 4px;
}

.group + .group {
  border-top: 1px solid rgba(245, 239, 226, 0.08);
}

.group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(245, 239, 226, 0.14);
}

.group-name {
  font-family: var(--font-title);
  font-size: 19.5px;
  letter-spacing: 0.14em;
  color: var(--paper);
}

.group-en {
  font-size: 11.5px;
  letter-spacing: 0.26em;
  color: var(--text-faint);
  border: 1px solid rgba(245, 239, 226, 0.22);
  border-radius: 4px;
  padding: 1px 7px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 0;
}

.row.stacked {
  display: grid;
  gap: 9px;
}

.row-label {
  font-size: 16.5px;
  color: var(--text);
}

.row-en {
  margin-left: 6px;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--text-faint);
}

/* 字号三档 */
.seg {
  display: inline-flex;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;
  flex: none;
}

.seg-btn {
  min-width: 56px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 16px;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-left: 1px solid rgba(245, 239, 226, 0.08);
  transition: color 0.18s ease, background 0.18s ease;
}

.seg-btn:first-child {
  border-left: none;
}

.seg-btn.is-on {
  color: var(--candle);
  background: rgba(232, 163, 61, 0.2);
}

@media (hover: hover) and (pointer: fine) {
  .seg-btn:hover:not(.is-on) {
    color: var(--paper);
    background: rgba(245, 239, 226, 0.06);
  }
}

.seg-btn:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: -2px;
}

/* 滑杆：细轨 + 暖金圆钮，两端端点标注（慢/快、小/大） */
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edge {
  flex: none;
  font-size: 15px;
  letter-spacing: 0.1em;
  color: var(--text-dim);
}

.val {
  flex: none;
  min-width: 3.4em;
  text-align: right;
  font-size: 14.5px;
  color: var(--text-dim);
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 26px;
  background: transparent;
  cursor: pointer;
}

.slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: rgba(245, 239, 226, 0.28);
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--gold);
  border: 2px solid rgba(16, 26, 46, 0.85);
  box-shadow: 0 0 12px rgba(232, 163, 61, 0.45);
}

.slider::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: rgba(245, 239, 226, 0.28);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--gold);
  border: 2px solid rgba(16, 26, 46, 0.85);
  box-shadow: 0 0 12px rgba(232, 163, 61, 0.45);
}

.slider:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
  border-radius: 8px;
}

/* 右下：重置 / 返回（参考图版式） */
.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 26px 20px;
  border-top: 1px solid rgba(245, 239, 226, 0.08);
}

.pill {
  min-height: 42px;
  padding: 9px 22px;
  font-size: 16px;
  letter-spacing: 0.12em;
  color: var(--text-dim);
  background: rgba(36, 54, 90, 0.4);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.pill.is-primary {
  color: var(--paper);
  border-color: rgba(232, 163, 61, 0.4);
}

@media (hover: hover) and (pointer: fine) {
  .pill:hover {
    color: var(--paper);
    background: rgba(232, 163, 61, 0.16);
    border-color: rgba(232, 163, 61, 0.4);
  }
}

.pill:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
}

.pill:active {
  transform: translateY(1px);
}

.pill-en {
  margin-left: 4px;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--text-faint);
}

@media (pointer: coarse) {
  .pill {
    min-height: 46px;
  }
}
</style>
