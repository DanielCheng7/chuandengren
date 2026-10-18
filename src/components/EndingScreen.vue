<script setup lang="ts">
/**
 * 结局页（《规格书》§6.2-4 / §5）
 * 固定主结局 + 三段变量渲染（由节点数据的 when 条件完成）+ AI 旅程回顾（功能 B）
 */
import { computed } from 'vue'
import AiFish from './AiFish.vue'
import LanternVisual from './LanternVisual.vue'
import SceneBackdrop from './SceneBackdrop.vue'
import type { StoryEngine } from '@/composables/useStoryEngine'

const props = defineProps<{ engine: StoryEngine }>()
const e = props.engine

const routeLabel = computed(() => {
  switch (e.state.ending) {
    case 'A':
      return '守旧链·《灯还亮着》'
    case 'B':
      return '创新链·《鱼入海》'
    case 'C':
      return '合流链·《灯海相连》'
    default:
      return '未记录'
  }
})

/**
 * V3.0：全片不显示任何数值／评分／进度（《开发文档》§2.6）——结局页只呈现定性信息。
 * 注：本页将在步骤 38（三结局＋EP 三分派＋「一日一篾」变体）随数据一并重做；
 * 当前仅做 r4 口径对齐：结局名改由 `state.ending`（A/B/C）读取，
 * 不展示 endingTier／balancedEp 等内部标记。
 */
const report = computed(() => [{ k: '灯路', v: routeLabel.value }])
</script>

<template>
  <div class="ending">
    <SceneBackdrop scene="workshop_next_year" :dim="0.5" />

    <div class="scroll">
      <header class="head">
        <LanternVisual state="lit" :size="196" />
        <h1>灯亮之后</h1>
        <p class="subtitle">传灯人 · 结局</p>
      </header>

      <dl class="report">
        <div v-for="r in report" :key="r.k">
          <dt>{{ r.k }}</dt>
          <dd>{{ r.v }}</dd>
        </div>
      </dl>

      <div class="body">
        <p v-for="(l, i) in e.lines.value" :key="i" :class="`line-${l.type ?? 'narration'}`">
          <span v-if="l.speaker" class="who">{{ l.speaker }}</span>
          {{ l.text }}
        </p>
      </div>

      <section class="journey">
        <h2>旅程回顾 <span class="ai-badge">AI 生成</span></h2>
        <p v-if="e.journeyLoading.value" class="loading">
          <AiFish state="thinking" :size="64" />
          阿鲟正在整理思路……
        </p>
        <p v-else-if="e.journeySummary.value.length">
          <span v-for="(l, i) in e.journeySummary.value" :key="i">{{ l.text }}</span>
        </p>
        <p v-else class="muted">
          （本次没有生成补充回顾。固定结局与上面的回顾不受影响。）
        </p>
      </section>

      <div class="actions">
        <button class="btn btn-gold" type="button" @click="e.restart()">重新体验</button>
        <button class="btn btn-ghost" type="button" @click="e.goTitle()">返回标题</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ending {
  position: absolute;
  inset: 0;
  overflow-y: auto;
}

.scroll {
  position: relative;
  z-index: 3;
  width: min(640px, 100%);
  margin: 0 auto;
  padding: 32px 22px calc(32px + var(--safe-b));
  display: grid;
  gap: 20px;
}

.head {
  display: grid;
  justify-items: center;
  gap: 6px;
}

h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 32px;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  color: var(--paper);
  text-shadow: 0 0 22px rgba(255, 182, 92, 0.35);
}

.subtitle {
  margin: 0;
  font-size: 14.5px;
  letter-spacing: 0.16em;
  color: var(--gold);
}

.report {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 8px;
  margin: 0;
}

.report > div {
  padding: 10px 12px;
  background: var(--glass-bg-soft);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
}

dt {
  font-size: 13.5px;
  color: var(--text-faint);
  letter-spacing: 0.08em;
}

dd {
  margin: 2px 0 0;
  font-size: 17.5px;
  color: var(--paper);
}

.body {
  display: grid;
  gap: 10px;
  font-size: calc(18px * var(--font-scale));
  line-height: 1.9;
}

.who {
  color: var(--gold);
  font-family: var(--font-title);
  margin-right: 6px;
}

.journey {
  display: grid;
  gap: 8px;
  padding: 16px;
  background: var(--glass-bg-soft);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid rgba(232, 163, 61, 0.28);
  border-radius: var(--radius);
}

.journey h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-title);
  font-size: 17.5px;
  letter-spacing: 0.12em;
  color: var(--gold);
}

.journey p {
  margin: 0;
  font-size: calc(17px * var(--font-scale));
  line-height: 1.9;
  color: var(--text);
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--gold);
}

.muted {
  color: var(--text-faint);
  font-size: 15px;
}

.actions {
  display: grid;
  gap: 12px; /* UI 设计书 §4.9：主（金）在上、幽灵在下，间距 ≥12px */
}
</style>
