<script setup lang="ts">
/**
 * 人物立绘层（V3.0，2026-10-19 按 galgame 惯例重做）
 *
 * **常驻在场**：立绘不再跟着"这一行是谁在说"闪进闪出，而是由引擎的 `cast`（在场人物）
 * 决定——整场戏里持续显示，只在换场景或人物离场时切换／消失。旁白行不影响立绘。
 *
 * **版式（对齐参考图）**：人物放大到接近满幅（1 人 88vh、2 人 84vh、3 人 78vh），
 * 底边下探 4vh，让腿部被对白带裁掉。
 * **站位规则（2026-10-19 用户决议）**：
 *  ① **首次登场默认在左侧**——单人也站左，不再靠右；
 *  ② 同场两人**左右分列、互不重叠**（左 12% / 右 14%）；
 *  ③ 阿鲟出场时占**右上角小窗**，人物右列让到 26% 给它腾位（`.has-ashun`），保证两者不叠。
 *
 * **层级**：本层挂在 `.story` 下（不在可滚动的 `.stage` 里），z-index 低于舞台，
 * 因此对白带会自然盖住人物下半身，且不会给舞台添滚动条。
 *
 * **缺素材**：某个角色立绘 404 → 只剔除该角色，其余照常显示；全部失败则整层不渲染。
 * 阿鲟是横卧鱼灯（约 2:1），走独立档位，不参与并排布局。
 */
import { computed, ref } from 'vue'
import { canStandOnStage, getCharacter } from '@/data/characters'

const props = defineProps<{
  /** 在场人物（引擎 cast，已过滤过主角/阿鲟） */
  cast?: string[]
  /** 当前说话人（只用于判断阿鲟是否在场） */
  speaker?: string
}>()

/** 加载失败的角色（按角色记，切换场景不清空——文件缺失是持久状态） */
const broken = ref<string[]>([])

const srcOf = (who: string) => {
  const def = getCharacter(who)
  return def?.asset ? `/assets/characters/${def.asset}` : ''
}

/** 场上人物：过滤可站立角色 + 去掉加载失败的 */
const standers = computed(() =>
  (props.cast ?? [])
    .filter((who) => canStandOnStage(who) && srcOf(who) && !broken.value.includes(who))
    .slice(0, 3)
)

/** 阿鲟：只在它说话时浮出（鱼灯小窗，不算"站位"） */
const ashunOn = computed(() => props.speaker === '阿鲟' && !broken.value.includes('阿鲟'))

const total = computed(() => standers.value.length)
</script>

<template>
  <div v-if="total > 0 || ashunOn" class="char-stage" :class="{ 'has-ashun': ashunOn }">
    <!-- 人物：1 人靠右中；2 人左右分列；3 人左中右 -->
    <div
      v-for="(who, i) in standers"
      :key="who"
      class="char"
      :class="[`n${total}`, `i${i}`]"
    >
      <img
        :src="srcOf(who)"
        :alt="getCharacter(who)?.name"
        @error="broken.push(who)"
      />
    </div>

    <!-- 阿鲟：手机小窗形态，固定右上角（不参与人物并排、不压人物） -->
    <div v-if="ashunOn" class="ashun-window">
      <img
        :src="srcOf('阿鲟')"
        alt="阿鲟"
        @error="broken.push('阿鲟')"
      />
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

/* ---------- 人物立绘 ---------- */
.char {
  position: absolute;
  /* 底边下探：腿部被对白带裁掉（参考图效果）；素材底部留了 1% padding，不会切到鞋 */
  bottom: -4vh;
  transition: opacity 0.28s ease, transform 0.28s ease;
  filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.55));
}

.char img {
  height: 100%;
  width: auto;
  object-fit: contain;
  opacity: 0.97;
  /* 统一压低一点亮度，避免比场景更"跳" */
  filter: brightness(0.94) saturate(0.96);
}

/* 1 人：**首次登场默认在左**（2026-10-19 用户决议，不再靠右） */
.char.n1 {
  height: min(88vh, 1060px);
  left: 12%;
}

/* 2 人：左右分列，互不重叠（左 12% / 右 14%） */
.char.n2 {
  height: min(84vh, 1000px);
}
.char.n2.i0 {
  left: 12%;
}
.char.n2.i1 {
  right: 14%;
}

/* 3 人：左中右均分，缩小一档避免重叠 */
.char.n3 {
  height: min(78vh, 900px);
}
.char.n3.i0 {
  left: 3%;
}
.char.n3.i1 {
  left: 50%;
  transform: translateX(-50%);
}
.char.n3.i2 {
  right: 3%;
}

/* 阿鲟在右上角小窗时：人物右列让到 26%，把右上角空出来（两者不叠） */
.char-stage.has-ashun .char.n2.i1 {
  right: 26%;
}
.char-stage.has-ashun .char.n3.i2 {
  right: 26%;
}

/* ---------- 阿鲟：右上角「手机小窗」----------
   剧本里阿鲟是"立在桌上的手机小窗"，这里做成悬浮玻璃窗：
   固定右上角、不参与人物并排，也不压在水印上（top 8% 让开角标）。
   轻微浮动像"漂"着。 */
.ashun-window {
  position: absolute;
  top: 8%;
  right: 2%;
  width: min(20vw, 340px);
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(16, 24, 40, 0.42);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(232, 163, 61, 0.32);
  box-shadow:
    0 12px 30px rgba(0, 0, 0, 0.45),
    0 0 32px rgba(255, 182, 92, 0.18);
  animation: ashun-float 7s ease-in-out infinite;
}

.ashun-window img {
  display: block;
  width: 100%;
  height: auto;
  filter: brightness(1.02) saturate(1.03);
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

/* 手机竖屏：略收一档，避免两人贴边 */
@media (max-width: 640px) {
  .char.n1 {
    height: min(84vh, 760px);
    right: 4%;
  }
  .char.n2 {
    height: min(80vh, 720px);
  }
  .char.n2.i0 {
    left: -2%;
  }
  .char.n2.i1 {
    right: -2%;
  }
  .char.n3 {
    height: min(70vh, 640px);
  }
  .ashun-window {
    top: 7%;
    right: 2%;
    width: min(46vw, 220px);
    padding: 8px 9px;
    border-radius: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ashun-window {
    animation: none;
  }
}
</style>
