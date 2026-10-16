<script setup lang="ts">
/**
 * 开发调试面板（步骤 8）
 * 显示当前节点 ID 与全部变量；支持一键跳幕（分幕审核时快速进入某一幕）；
 * 演示模式一键隐藏（《规格书》§7）。
 */
import { computed } from 'vue'
import { ACTS } from '@/data/story'
import { useSettings } from '@/composables/useSettings'
import type { StoryEngine } from '@/composables/useStoryEngine'

const props = defineProps<{ engine: StoryEngine }>()
const { settings, enterDemoMode, enterReviewMode } = useSettings()

const e = props.engine

const nodeId = computed(() => e.nodeId.value)
const phase = computed(() => e.phase.value)
const aiStatus = computed(() => e.aiStatus.value)
const title = computed(() => e.sectionTitle.value)
const scene = computed(() => e.sceneKey.value)
const linePos = computed(() => `${e.lineIndex.value + 1}/${e.lines.value.length}`)
const s = computed(() => e.state)

const vars = computed(() => [
  ['route', s.value.route ?? 'null'],
  ['memory', String(s.value.memory)],
  ['aiTrust', String(s.value.aiTrust)],
  ['handMade', String(s.value.handMade)],
  ['hasLetter', String(s.value.hasLetter)],
  ['lightingChoice', s.value.lightingChoice ?? 'null'],
  ['routeClue', s.value.routeClue ?? 'null'],
  ['freeInput', s.value.freeInput ? `“${s.value.freeInput.slice(0, 24)}…”` : 'undefined'],
])

const visibleChoiceIds = computed(() => e.visibleChoices.value.map((c) => c.id).join(' / ') || '—')

const acts = ACTS
</script>

<template>
  <section class="dev">
    <header>
      <strong>调试面板</strong>
      <div class="acts">
        <button
          v-for="a in acts"
          :key="a.act"
          class="mini"
          type="button"
          :title="`跳到 ${a.title}（入口节点 ${a.entry}）`"
          @click="e.jumpToAct(a.act)"
        >
          跳 {{ a.entry }}
        </button>
        <button class="mini" type="button" @click="e.jumpTo('S01')">回 S01</button>
        <button class="mini danger" type="button" @click="e.restart()">重开</button>
      </div>
    </header>

    <dl class="rows">
      <div><dt>节点</dt><dd>{{ nodeId }} · {{ linePos }}</dd></div>
      <div><dt>段落</dt><dd>{{ title || '—' }}</dd></div>
      <div><dt>场景</dt><dd>{{ scene }}</dd></div>
      <div><dt>阶段</dt><dd>{{ phase }} / ai:{{ aiStatus }}</dd></div>
      <div><dt>可见选项</dt><dd>{{ visibleChoiceIds }}</dd></div>
    </dl>

    <dl class="rows vars">
      <div v-for="v in vars" :key="v[0]">
        <dt>{{ v[0] }}</dt>
        <dd>{{ v[1] }}</dd>
      </div>
    </dl>

    <div class="toggles">
      <label><input v-model="settings.showStageNotes" type="checkbox" /> 舞台/音效提示</label>
      <label><input v-model="settings.showChoiceIds" type="checkbox" /> 选项编号</label>
      <label><input v-model="settings.typewriter" type="checkbox" /> 打字机</label>
      <label>
        音量
        <input
          v-model.number="settings.volume"
          type="range"
          min="0"
          max="100"
          step="5"
          style="width: 88px; vertical-align: middle"
        />
        {{ settings.volume }}%
      </label>
    </div>

    <div class="acts bottom">
      <button class="mini" type="button" @click="enterReviewMode()">审核模式</button>
      <button class="mini" type="button" @click="enterDemoMode()">演示模式（隐藏剧本痕迹）</button>
    </div>
  </section>
</template>

<style scoped>
.dev {
  position: fixed;
  right: 12px;
  bottom: calc(12px + var(--safe-b));
  z-index: 30;
  width: min(330px, calc(100vw - 24px));
  padding: 10px 12px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-dim);
  background: rgba(6, 12, 22, 0.92);
  border: 1px solid rgba(232, 163, 61, 0.28);
  border-radius: 10px;
  font-family: ui-monospace, Consolas, monospace;
  max-height: 62dvh;
  overflow-y: auto;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

strong {
  color: var(--gold);
  letter-spacing: 0.08em;
}

.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.acts.bottom {
  margin-top: 8px;
}

.mini {
  padding: 2px 7px;
  font-size: 11px;
  background: rgba(232, 163, 61, 0.12);
  border: 1px solid rgba(232, 163, 61, 0.34);
  border-radius: 5px;
  color: var(--text);
}

.mini:hover {
  background: rgba(232, 163, 61, 0.24);
}

.mini.danger {
  background: rgba(140, 59, 46, 0.35);
  border-color: rgba(200, 106, 80, 0.5);
}

.rows {
  margin: 0 0 6px;
  display: grid;
  gap: 2px;
}

.rows > div {
  display: flex;
  gap: 6px;
}

dt {
  flex: 0 0 74px;
  color: rgba(232, 163, 61, 0.7);
}

dd {
  margin: 0;
  flex: 1;
  color: var(--text);
  word-break: break-all;
}

.toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(232, 163, 61, 0.24);
}

.toggles label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.toggles input {
  accent-color: #e8a33d;
}
</style>
