<script setup lang="ts">
/**
 * 角色立绘层（V3.0，2026-10-19 重定站位规则）
 *
 * **在场角色**：由引擎 `cast` 决定，整场常驻——旁白行不消失，只在换场景或离场时切换。
 * **阿鲟也是角色**（2026-10-19 用户决议）：**不套窗口/黑框**，跟人物同一套站位规则；
 * 只因自身是 2:1 横卧鱼灯，用宽度约束 + 悬空高度，避免与竖立绘混排时撑满画面。
 *
 * **站位规则（所有场景一致）**：
 *  ① **首次登场默认在左**——按 cast 顺序（= 登场顺序）从左往右排；
 *     1 人贴左 12%，2 人左右分列（左右各 12%），3／4 人均布；
 *  ② 多人互不重叠——由 flex 均分保证，不再逐人写死 left/right 导致撞车。
 *
 * **层级**：本层挂在 `.story` 下（不在可滚动的 `.stage` 里），z-index 低于舞台，
 * 因此对白带会自然盖住人物下半身，且不会给舞台添滚动条。
 *
 * **缺素材**：某个角色 404 → 只剔除该角色，其余照常；全部失败则整层不渲染，不留空框。
 */
import { computed, ref } from 'vue'
import { canStandOnStage, getCharacter } from '@/data/characters'

const props = defineProps<{
  /** 在场角色（引擎 cast，已含阿鲟、已排除第一人称主角） */
  cast?: string[]
}>()

/** 加载失败的角色（文件缺失是持久状态，切换场景不清空） */
const broken = ref<string[]>([])

const srcOf = (who: string) => {
  const def = getCharacter(who)
  return def?.asset ? `/assets/characters/${def.asset}` : ''
}

/** 场上角色：按 cast 顺序从左往右排，最多 4 位 */
const standers = computed(() =>
  (props.cast ?? [])
    .filter((who) => canStandOnStage(who) && srcOf(who) && !broken.value.includes(who))
    .slice(0, 4)
)

const total = computed(() => standers.value.length)
const isAshun = (who: string) => who === '阿鲟'
</script>

<template>
  <div v-if="total > 0" class="char-stage" :class="`n${total}`">
    <div class="row">
      <div v-for="who in standers" :key="who" class="char" :class="{ 'is-ashun': isAshun(who) }">
        <img :src="srcOf(who)" :alt="getCharacter(who)?.name" @error="broken.push(who)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 整层覆盖画面：挂在 .story 下、z-index 低于舞台，对白带会盖住人物下半身 */
.char-stage {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.32s ease;
}

/* 横排弹性布局：按 cast 顺序从左往右，天然不重叠 */
.row {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
}

/* 1 人：贴左（首次登场在左） */
.char-stage.n1 .row {
  justify-content: flex-start;
  padding-left: 12%;
}

/* 2 人：左右两侧分列 */
.char-stage.n2 .row {
  justify-content: space-between;
  padding: 0 12%;
}

/* 3／4 人：均布 */
.char-stage.n3 .row {
  justify-content: space-between;
  padding: 0 3%;
}
.char-stage.n4 .row {
  justify-content: space-between;
  padding: 0 2%;
}

/* ---------- 角色 ---------- */
.char {
  position: relative;
  flex: none;
  /* 底边下探：腿部被对白带裁掉（参考图效果）；素材底部留了 1% padding，不会切到鞋 */
  margin-bottom: -4vh;
  transition: opacity 0.28s ease, transform 0.28s ease;
  filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.55));
}

.char img {
  display: block;
  height: 100%;
  width: auto;
  object-fit: contain;
  opacity: 0.97;
  /* 统一压低一点亮度，避免比场景更"跳" */
  filter: brightness(0.94) saturate(0.96);
}

.char-stage.n1 .char {
  height: min(88vh, 1060px);
}
.char-stage.n2 .char {
  height: min(84vh, 1000px);
}
.char-stage.n3 .char {
  height: min(78vh, 900px);
}
.char-stage.n4 .char {
  height: min(70vh, 820px);
}

/* ---------- 阿鲟：2:1 横卧鱼灯 ----------
   它也是角色，**不套窗口/黑框**；只因横宽比例，改用宽度约束并悬空在人物腰际，
   否则按立绘高度缩放会撑满半幅画面。 */
.char.is-ashun {
  height: auto;
  width: min(30vw, 460px);
  /* 往上抬一截：像一盏漂在半空的灯，而不是蹲在地上的物件 */
  margin-bottom: 16vh;
  filter: drop-shadow(0 12px 30px rgba(0, 0, 0, 0.5))
    drop-shadow(0 0 30px rgba(255, 182, 92, 0.22));
}

.char.is-ashun img {
  width: 100%;
  height: auto;
  filter: brightness(1.02) saturate(1.03);
  animation: ashun-float 7s ease-in-out infinite;
}

/* 人多时阿鲟收一档，避免挤到邻居 */
.char-stage.n3 .char.is-ashun,
.char-stage.n4 .char.is-ashun {
  width: min(24vw, 380px);
  margin-bottom: 18vh;
}

@keyframes ashun-float {
  0%,
  100% {
    transform: translateY(0) rotate(-0.35deg);
  }
  50% {
    transform: translateY(-10px) rotate(0.45deg);
  }
}

/* 手机竖屏：整体收一档，左右各留一点 */
@media (max-width: 640px) {
  .char-stage.n1 .row {
    padding-left: 8%;
  }
  .char-stage.n2 .row {
    padding: 0 6%;
  }
  .char-stage.n1 .char {
    height: min(84vh, 760px);
  }
  .char-stage.n2 .char {
    height: min(80vh, 720px);
  }
  .char-stage.n3 .char {
    height: min(70vh, 640px);
  }
  .char-stage.n4 .char {
    height: min(64vh, 580px);
  }
  .char.is-ashun {
    width: min(38vw, 300px);
    margin-bottom: 14vh;
  }
  .char-stage.n3 .char.is-ashun,
  .char-stage.n4 .char.is-ashun {
    width: min(30vw, 240px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .char.is-ashun img {
    animation: none;
  }
}
</style>
