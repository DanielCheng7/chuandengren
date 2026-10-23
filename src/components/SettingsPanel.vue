<script setup lang="ts">
/**
 * 设置面板（UI 设计书 r3 ⑧ · 2026-10-16 改版）
 *
 * 参考同类作品设置页（System 设置）：中文大标题 + 英文小签、分节标题带英文小签与
 * 下划线分隔、滑杆两端「慢/快」式端点标注、右下「重置 / 返回」。
 * 项目：文字大小（小/标准/大）· 文字显示速度 · 音量；即时生效并经 useSettings 持久化。
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'
import {
  DEFAULT_BASE_URL,
  maskKey,
  normalizeBaseUrl,
  useAiConfig,
  validateProfile,
  type AiProfile,
} from '@/composables/useAiConfig'
import { probeAiConnection } from '@/services/aiClient'

const emit = defineEmits<{ (e: 'close'): void }>()
const { settings } = useSettings()

/* ---------------- 自定义大模型（2026-10-23） ---------------- */
const ai = useAiConfig()

const draft = reactive({ id: '', label: '', baseUrl: DEFAULT_BASE_URL, model: '', apiKey: '' })
/** 表单默认收起：没配过才自动展开（首次进来的队友要看到三栏），配过的人只想切一下 */
const aiOpen = ref(false)
const showKey = ref(false)
const testing = ref(false)
const aiMsg = ref('')
const aiMsgOk = ref(false)

/** 当前生效的是哪一套（服务端默认 / 某条自定义） */
const aiCurrent = computed(() => (ai.active.value ? ai.active.value.label : '服务端默认'))

function say(text: string, ok: boolean) {
  aiMsg.value = text
  aiMsgOk.value = ok
}

function fillDraft(p: AiProfile | null) {
  draft.id = p?.id ?? ''
  draft.label = p?.label ?? ''
  draft.baseUrl = p?.baseUrl ?? DEFAULT_BASE_URL
  draft.model = p?.model ?? ''
  draft.apiKey = p?.apiKey ?? ''
  showKey.value = false
}

/** 保存并启用：同 id 就地改；新填的则新建一条 */
function saveAi() {
  const err = validateProfile(draft)
  if (err) {
    say(err, false)
    return
  }
  const saved = ai.save({
    id: draft.id || undefined,
    label: draft.label,
    baseUrl: draft.baseUrl,
    model: draft.model,
    apiKey: draft.apiKey,
  })
  fillDraft(saved)
  say(`已保存并启用「${saved.label}」`, true)
}

/** 切到某条已存配置（顺便把表单换成它，方便接着改） */
function pickProfile(p: AiProfile) {
  ai.activate(p.id)
  fillDraft(p)
  say(`已切换到「${p.label}」`, true)
}

function dropProfile(p: AiProfile) {
  ai.remove(p.id)
  if (draft.id === p.id) fillDraft(null)
  say(`已删除「${p.label}」（Key 只在本机，删了就找不回，请自行留存）`, true)
}

function useServerDefault() {
  ai.useServerDefault()
  say('已切回服务端默认配置', true)
}

/** 测试连接：优先测表单里这套（可以先测再存），表单为空才测当前生效的 */
async function testAi() {
  const hasDraft = draft.model.trim() && draft.apiKey.trim()
  testing.value = true
  say('正在连接上游…', true)
  const r = await probeAiConnection(
    hasDraft
      ? {
          apiKey: draft.apiKey.trim(),
          baseUrl: normalizeBaseUrl(draft.baseUrl),
          model: draft.model.trim(),
        }
      : undefined
  )
  testing.value = false
  if (r.ok) say(`连接成功，上游回：${r.text || '（空）'}`, true)
  else say(`连接失败：${r.error || '未知错误'}`, false)
}

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

onMounted(() => {
  // 打开面板时把当前生效的配置填进表单：改哪条就是哪条，不必先"选中"
  fillDraft(ai.active.value)
  aiOpen.value = ai.profiles.length === 0
  window.addEventListener('keydown', onKeydown)
})
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

        <!-- 分节：大模型（2026-10-23 用户要求：团队成员各用各的 Key） -->
        <section class="group">
          <div class="group-head">
            <span class="group-name">AI 模型</span>
            <span class="group-en">MODEL</span>
          </div>

          <p class="ai-hint">
            触点判定用这里配的模型。<b>Key 只存在这台设备的浏览器里</b>，不写进代码、不进仓库；
            没填或点「用服务端默认」时，走服务端配置的模型。
          </p>

          <div class="row stacked">
            <span class="row-label">
              当前使用
              <span class="row-en">ACTIVE</span>
            </span>
            <div class="ai-active">
              <span class="ai-chip" :class="{ 'is-default': !ai.active.value }">{{ aiCurrent }}</span>
              <button
                v-if="ai.active.value"
                class="mini"
                type="button"
                @click="useServerDefault()"
              >
                用服务端默认
              </button>
              <button class="mini" type="button" @click="aiOpen = !aiOpen">
                {{ aiOpen ? '收起配置' : '填写 / 修改' }}
              </button>
            </div>

            <ul v-if="ai.profiles.length" class="ai-list">
              <li
                v-for="p in ai.profiles"
                :key="p.id"
                class="ai-item"
                :class="{ 'is-on': p.id === ai.activeId }"
              >
                <button class="ai-pick" type="button" @click="pickProfile(p)">
                  <span class="ai-name">{{ p.label }}</span>
                  <span class="ai-meta">{{ p.model }} · {{ maskKey(p.apiKey) }}</span>
                </button>
                <button
                  class="ai-del"
                  type="button"
                  :aria-label="`删除配置 ${p.label}`"
                  @click="dropProfile(p)"
                >
                  删
                </button>
              </li>
            </ul>
          </div>

          <div v-if="aiOpen" class="ai-form">
            <label class="field">
              <span class="field-name">模型名称</span>
              <input
                v-model="draft.model"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="如 deepseek-v4-1-flash-economy-261017"
              />
            </label>
            <label class="field">
              <span class="field-name">API Base URL</span>
              <input
                v-model="draft.baseUrl"
                type="url"
                autocomplete="off"
                spellcheck="false"
                placeholder="https://ark.cn-beijing.volces.com/api/v3"
              />
            </label>
            <label class="field">
              <span class="field-name">API Key</span>
              <span class="field-row">
                <input
                  v-model="draft.apiKey"
                  :type="showKey ? 'text' : 'password'"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="只保存在本机浏览器"
                />
                <button class="mini" type="button" @click="showKey = !showKey">
                  {{ showKey ? '隐藏' : '显示' }}
                </button>
              </span>
            </label>
            <label class="field">
              <span class="field-name">备注名（可选）</span>
              <input
                v-model="draft.label"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="留空则用模型名，方便列表里区分"
              />
            </label>
          </div>

          <div v-if="aiOpen" class="ai-actions">
            <button class="pill is-primary" type="button" @click="saveAi()">
              保存并启用 <span class="pill-en">SAVE</span>
            </button>
            <button class="pill" type="button" :disabled="testing" @click="testAi()">
              {{ testing ? '连接中…' : '测试连接' }}
            </button>
            <button class="pill" type="button" @click="fillDraft(null)">
              新建
            </button>
          </div>

          <p v-if="aiMsg" class="ai-msg" :class="aiMsgOk ? 'is-ok' : 'is-err'" role="status">
            {{ aiMsg }}
          </p>
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

/* ---------- AI 模型分节（2026-10-23） ---------- */
.ai-hint {
  margin: 10px 0 2px;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--text-dim);
}

.ai-hint b {
  color: var(--candle);
  font-weight: 500;
}

.ai-active {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-chip {
  padding: 3px 12px;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--candle);
  background: rgba(232, 163, 61, 0.12);
  border: 1px solid rgba(232, 163, 61, 0.38);
  border-radius: 999px;
}

.ai-chip.is-default {
  color: var(--text-dim);
  background: transparent;
  border-color: var(--glass-border);
}

/* 小按钮：显示/隐藏 Key、用服务端默认、删除 */
.mini {
  flex: none;
  min-height: 32px;
  padding: 4px 10px;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  background: rgba(36, 54, 90, 0.4);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease;
}

@media (hover: hover) and (pointer: fine) {
  .mini:hover {
    color: var(--paper);
    border-color: rgba(232, 163, 61, 0.4);
  }
}

.ai-list {
  display: grid;
  gap: 6px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.ai-item {
  display: flex;
  align-items: stretch;
  gap: 6px;
  border: 1px solid rgba(245, 239, 226, 0.09);
  border-radius: 10px;
  overflow: hidden;
}

.ai-item.is-on {
  background: rgba(232, 163, 61, 0.08);
  border-color: rgba(232, 163, 61, 0.45);
}

.ai-pick {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  font-family: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
}

.ai-name {
  font-size: 14.5px;
  color: var(--paper);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-item.is-on .ai-name {
  color: var(--candle);
}

.ai-meta {
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-del {
  flex: none;
  width: 44px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-faint);
  background: transparent;
  border: none;
  border-left: 1px solid rgba(245, 239, 226, 0.08);
  cursor: pointer;
  transition: color 0.18s ease;
}

@media (hover: hover) and (pointer: fine) {
  .ai-del:hover {
    color: #e08a6b;
  }
}

.ai-form {
  display: grid;
  gap: 10px;
  padding: 4px 0 2px;
}

.field {
  display: grid;
  gap: 5px;
}

.field-name {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.field input {
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  font-family: inherit;
  font-size: 14.5px;
  color: var(--paper);
  background: rgba(16, 26, 46, 0.55);
  border: 1px solid var(--glass-border);
  border-radius: 9px;
}

.field input::placeholder {
  color: var(--text-faint);
}

.field input:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 1px;
  border-color: rgba(232, 163, 61, 0.4);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-row input {
  flex: 1;
  min-width: 0;
}

.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0 2px;
}

.ai-actions .pill {
  min-height: 40px;
  padding: 8px 16px;
  font-size: 14.5px;
}

.ai-actions .pill[disabled] {
  opacity: 0.55;
  cursor: default;
}

.ai-msg {
  margin: 8px 0 2px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}

.ai-msg.is-ok {
  color: #8fbf9f;
}

.ai-msg.is-err {
  color: #e08a6b;
}

@media (pointer: coarse) {
  .pill {
    min-height: 46px;
  }
}
</style>
