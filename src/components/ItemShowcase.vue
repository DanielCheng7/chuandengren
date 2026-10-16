<script setup lang="ts">
/**
 * 道具亮相（UI 设计书 r4 §4.6）
 *
 * 带 `item` 标记的行以「整屏暖光雾 + 中央道具 + 下方文字」呈现：
 *   渐入 0.8s → 停留（按文字长度自动推进，点击可跳过）→ 渐隐 0.6s。
 * 连续带标记的行构成一个「注视段」：道具图形保持不动，文字逐行渐换；
 * 推进到无标记行时整段落幕，道具自然淡出。
 *
 * 道具为代码绘制 SVG（与阿鲟 / 鱼灯同一「永久纯代码」资产策略）：
 *   ledger＝手工线装灯谱（摊开，右缘一条干净的撕痕）；letter＝奶奶的旧信；note＝便条（后续幕用）。
 * 素材到位后可整图替换（替换对应 SVG，接口不变）。
 * 停留时长与自动推进由 StoryScreen 统一调度（与场景字卡同一套计时器）。
 */
import type { Line } from '@/types/story'

defineProps<{
  /** 当前行（仅带 item 标记的行；其余一律 null） */
  line: Line | null
  /** 展示文字（审核模式由 StoryScreen 拼回剧本原文） */
  text: string | null
  /** 行变化标识（nodeId:lineIndex），用于段内文字切换 */
  lineKey: string
}>()
</script>

<template>
  <Transition name="show">
    <div v-if="line && line.item" class="showcase" aria-live="polite">
      <!-- 暖灯柔光雾：把场景轻轻糊化，道具「从光里浮出」 -->
      <div class="haze" aria-hidden="true" />

      <div class="inner">
        <Transition name="fig">
          <div v-if="line.item" :key="line.item" class="fig">
            <!-- 灯谱：手工线装，摊开；右缘留一条干净的撕痕（最后一页被齐齐撕掉） -->
            <svg
              v-if="line.item === 'ledger'"
              class="art"
              viewBox="0 0 260 210"
              fill="none"
              aria-hidden="true"
            >
              <!-- 左页 -->
              <path
                d="M130 30 Q 92 20 46 32 L46 170 Q 92 158 130 168 Z"
                fill="rgba(245,239,226,0.1)"
                stroke="rgba(255,196,110,0.92)"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <!-- 右页（右缘即撕口：微曲的干净撕痕） -->
              <path
                d="M130 30 Q 168 20 214 32 C 216 62 212 102 215 132 C 216 152 214 162 215 170 Q 168 158 130 168 Z"
                fill="rgba(245,239,226,0.1)"
                stroke="rgba(255,196,110,0.92)"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <!-- 撕痕内线：强调「最后一页被齐齐撕掉」 -->
              <path
                d="M205 34 C 207 62 203 102 206 134 C 207 152 205 162 206 170"
                stroke="rgba(255,182,92,0.6)"
                stroke-width="1.2"
              />
              <!-- 书脊与线装结 -->
              <path d="M130 30 L130 168" stroke="rgba(255,196,110,0.98)" stroke-width="1.6" />
              <path
                d="M124 56 h12 M124 86 h12 M124 116 h12 M124 146 h12"
                stroke="rgba(255,196,110,0.6)"
                stroke-width="1.8"
              />
              <!-- 字迹：左页四行、右页三行 -->
              <path
                d="M64 66 h50 M60 88 h46 M66 110 h42 M64 132 h38"
                stroke="rgba(255,244,228,0.44)"
                stroke-width="1.3"
                stroke-linecap="round"
              />
              <path
                d="M148 66 h48 M152 88 h44 M148 110 h40"
                stroke="rgba(255,244,228,0.44)"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>

            <!-- 旧信：三折信纸，字迹褪色，其中一行仍认得出（暖金） -->
            <svg
              v-else-if="line.item === 'letter'"
              class="art"
              viewBox="0 0 220 250"
              fill="none"
              aria-hidden="true"
            >
              <g transform="rotate(-2.2 110 125)">
                <!-- 信纸（四角微不平，手工感） -->
                <path
                  d="M54 32 L166 26 L172 216 L60 224 Z"
                  fill="rgba(245,239,226,0.1)"
                  stroke="rgba(255,196,110,0.9)"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
                <!-- 折痕（三折的信） -->
                <path
                  d="M56 98 L169 92 M58 162 L171 156"
                  stroke="rgba(245,239,226,0.24)"
                  stroke-width="1"
                />
                <!-- 褪色的字迹 -->
                <path
                  d="M74 56 h66 M72 74 h58 M76 116 h62 M78 174 h56 M76 192 h44"
                  stroke="rgba(255,244,228,0.4)"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
                <!-- 认得出的那一行（暖金，更实） -->
                <path
                  d="M74 134 h58"
                  stroke="rgba(255,196,110,0.95)"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
                <!-- 折角 -->
                <path
                  d="M54 32 L67 37 L54 47 Z"
                  fill="rgba(245,239,226,0.18)"
                  stroke="rgba(255,196,110,0.6)"
                  stroke-width="1"
                />
              </g>
            </svg>

            <!-- 便条：上下齐、左右撕边的小纸条（预留，后续幕使用） -->
            <svg v-else class="art" viewBox="0 0 230 150" fill="none" aria-hidden="true">
              <path
                d="M44 44 L188 40 L192 104 L48 110 Z"
                fill="rgba(245,239,226,0.1)"
                stroke="rgba(255,196,110,0.9)"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <!-- 左右撕边锯齿 -->
              <path
                d="M44 44 l-6 11 l6 11 l-6 11 l6 11 l-6 11 l6 11"
                stroke="rgba(255,196,110,0.68)"
                stroke-width="1.1"
                fill="none"
              />
              <path
                d="M192 104 l6 -11 l-6 -11 l6 -11 l-6 -11 l6 -11 l-6 -11"
                stroke="rgba(255,196,110,0.68)"
                stroke-width="1.1"
                fill="none"
              />
              <!-- 短句：普通行 + 暖金重点行 -->
              <path
                d="M66 62 h60 M64 84 h52"
                stroke="rgba(255,244,228,0.42)"
                stroke-width="1.3"
                stroke-linecap="round"
              />
              <path
                d="M64 84 h52"
                stroke="rgba(255,196,110,0.95)"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </Transition>

        <Transition name="txt" mode="out-in">
          <p v-if="text" :key="lineKey" class="word" :class="{ 'is-script': line?.type === 'sms' }">
            {{ text }}
          </p>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.showcase {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  padding: 0 24px 48px; /* 略上移，给底部对白框与快捷键让位 */
  pointer-events: none;
}

/* 暖灯柔光雾：光雾 + 背景轻糊化（「在光里」看清道具） */
.haze {
  position: absolute;
  inset: 0;
  -webkit-backdrop-filter: blur(6px) brightness(1.06) saturate(1.04);
  backdrop-filter: blur(6px) brightness(1.06) saturate(1.04);
  background:
    radial-gradient(
      circle at 50% 42%,
      rgba(255, 219, 160, 0.34) 0%,
      rgba(255, 200, 128, 0.16) 38%,
      rgba(255, 200, 128, 0) 72%
    ),
    linear-gradient(180deg, rgba(255, 231, 190, 0.24) 0%, rgba(255, 205, 140, 0.12) 100%);
  animation: haze-breathe 4.2s ease-in-out infinite;
}

@keyframes haze-breathe {
  0%,
  100% {
    opacity: 0.86;
  }
  50% {
    opacity: 1;
  }
}

.inner {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 22px;
  max-width: 640px;
}

/* 道具：暖光描边 + 墨色沉底（在亮雾中「沉」出来，线条始终清晰） */
.fig {
  position: relative;
  filter: drop-shadow(0 0 30px rgba(10, 16, 30, 0.55))
    drop-shadow(0 0 26px rgba(255, 182, 92, 0.38));
}

.art {
  position: relative;
  width: min(72vw, 320px);
  height: auto;
}

.word {
  margin: 0;
  max-width: 24em;
  text-align: center;
  font-family: var(--font-title);
  font-size: calc(21px * var(--font-scale));
  line-height: 2;
  letter-spacing: 0.09em;
  color: rgba(245, 239, 226, 0.97);
  text-shadow: 0 2px 20px rgba(8, 14, 28, 0.8), 0 0 54px rgba(8, 14, 28, 0.46);
}

/* 道具上的文字（旧信的信文）：暖金色，像光线照在字迹上 */
.word.is-script {
  color: var(--candle);
  letter-spacing: 0.14em;
}

/* ---------- 过渡（UI 设计书 §6 动效白名单） ---------- */
.show-enter-active {
  transition: opacity 0.8s ease;
}

.show-leave-active {
  transition: opacity 0.6s ease;
}

.show-enter-from,
.show-leave-to {
  opacity: 0;
}

/* 道具图形：段开始时浮出一次（段内换行不重播） */
.fig-enter-active {
  transition: opacity 1.1s ease, transform 1.1s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.fig-leave-active {
  transition: opacity 0.4s ease;
}

.fig-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.fig-leave-to {
  opacity: 0;
}

/* 文字：段内逐行渐换 */
.txt-enter-active {
  transition: opacity 0.45s ease, transform 0.45s ease;
}

.txt-leave-active {
  transition: opacity 0.28s ease;
}

.txt-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.txt-leave-to {
  opacity: 0;
}

/* 桌面 16:9：道具更大一档 */
@media (min-width: 900px) and (min-height: 600px) {
  .art {
    width: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .show-enter-active,
  .show-leave-active,
  .fig-enter-active,
  .fig-leave-active,
  .txt-enter-active,
  .txt-leave-active {
    transition: none;
  }

  .haze {
    animation: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
