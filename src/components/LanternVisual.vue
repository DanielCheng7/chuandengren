<script setup lang="ts">
/**
 * 鳌鱼灯主视觉 —— 纯代码绘制（制作计划 §0.2，素材到位前不留空框）
 * 三态（《人物设定与场景设计》§1.6）：
 *   half   半成品：竹篾扎骨、纱纸糊身、鳞片只绘一半、龙首还是光秃秃的竹篾骨架
 *   digital 数字模型：冷白／青蓝线框，悬浮在深色界面中
 *   lit    完成点亮：纱纸透暖光，金红鳞片层叠，烛火在体内
 * TODO(asset): 素材到位后可替换为 images/ao_fish_{half|digital|lit}.webp
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ state?: 'half' | 'digital' | 'lit'; size?: number }>(),
  { state: 'half', size: 260 }
)

const isLit = computed(() => props.state === 'lit')
const isDigital = computed(() => props.state === 'digital')
const isHalf = computed(() => props.state === 'half')

const skeletonStroke = computed(() => (isDigital.value ? '#bfe3ea' : '#9a7442'))
const paperFill = computed(() => {
  if (isLit.value) return 'rgba(247, 227, 192, 0.94)'
  if (isHalf.value) return 'rgba(245, 239, 226, 0.16)'
  return 'rgba(191, 227, 234, 0.06)'
})
const scaleStroke = computed(() => (isLit.value ? '#c86a2c' : isDigital.value ? '#8fc9d8' : '#8a6a44'))
</script>

<template>
  <div class="lantern" :class="[`is-${state}`, { 'has-glow': isLit }]" :style="{ width: `${size}px` }">
    <svg viewBox="0 0 240 180" role="img" aria-label="鳌鱼灯">
      <defs>
        <radialGradient id="lantern-halo">
          <stop offset="0%" stop-color="#ffb65c" stop-opacity="0.62" />
          <stop offset="45%" stop-color="#e8a33d" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#e8a33d" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="lantern-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff4dc" />
          <stop offset="55%" stop-color="#f7dfb2" />
          <stop offset="100%" stop-color="#e7c489" />
        </linearGradient>
        <filter id="lantern-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <!-- 点亮时的外部光晕 -->
      <ellipse
        v-if="isLit"
        class="halo"
        cx="120"
        cy="94"
        rx="118"
        ry="86"
        fill="url(#lantern-halo)"
      />

      <!-- 数字模型：界面网格 -->
      <g v-if="isDigital" class="grid" stroke="#8fc9d8" stroke-width="0.6" opacity="0.28" fill="none">
        <path d="M20 60h200M20 128h200M70 34v112M170 34v112" />
        <path d="M20 44h8M20 60h8M220 44h-8M220 60h-8" />
      </g>

      <!-- 身体：纱纸 / 纸面 -->
      <path
        class="body-paper"
        d="M64 96c10-34 56-46 92-34 20 7 32 18 40 30-8 14-20 24-40 32-36 12-82-2-92-28Z"
        :fill="isLit ? 'url(#lantern-paper)' : paperFill"
        :stroke="isLit ? 'rgba(200,106,44,0.55)' : skeletonStroke"
        stroke-width="1.2"
      />

      <!-- 竹篾骨架：环箍 + 纵骨（三种状态都保留，是"骨"） -->
      <g class="frame" fill="none" :stroke="skeletonStroke" stroke-width="1" opacity="0.9">
        <path d="M78 62c-5 12-5 56 0 68" />
        <path d="M102 55c-5 14-5 68 0 82" />
        <path d="M126 54c-5 14-5 70 0 84" />
        <path d="M150 58c-4 13-4 62 0 74" />
        <path d="M64 96c32-9 70-9 100 0" />
        <path d="M176 62c9 8 18 20 22 32-4 12-13 24-22 32" />
      </g>

      <!-- 鳞片：半成品只绘一半，点亮时层层发光 -->
      <g class="scales" fill="none" :stroke="scaleStroke" stroke-width="1.05">
        <path d="M92 66c6 8 6 20 0 28" />
        <path d="M114 60c6 9 6 24 0 34" />
        <path d="M136 58c6 10 6 26 0 36" />
        <path d="M158 62c5 9 5 22 0 30" />
        <template v-if="!isHalf">
          <path d="M84 92c7 6 16 8 24 6" />
          <path d="M106 88c8 7 18 9 26 6" />
          <path d="M128 86c8 7 18 9 26 6" />
          <path d="M150 88c7 6 15 7 22 5" />
        </template>
        <template v-else>
          <path d="M84 92c7 6 16 8 24 6" opacity="0.5" />
        </template>
      </g>

      <!-- 尾鳍 -->
      <g class="tail" fill="none" :stroke="skeletonStroke" stroke-width="1.1">
        <path d="M196 92c12-7 22-17 26-29 3 15 3 30 0 45-4-12-14-22-26-29Z" :fill="paperFill" />
        <path d="M204 92c8-5 14-11 17-18M204 92c8 5 14 11 17 18" />
      </g>

      <!-- 背鳍 / 腹鳍 -->
      <g class="fins" fill="none" :stroke="skeletonStroke" stroke-width="1.1">
        <path d="M104 58c7-16 27-24 41-17-15 3-29 10-41 17Z" :fill="paperFill" />
        <path d="M104 122c5 12 17 18 27 15-10-4-20-9-27-15Z" :fill="paperFill" />
      </g>

      <!-- 龙首：半成品＝光秃秃的竹篾骨架；点亮＝青金完整龙首 -->
      <g class="head" fill="none" :stroke="skeletonStroke" stroke-width="1.2">
        <template v-if="isHalf">
          <path d="M64 96 32 72l30-16" />
          <path d="M64 96 32 118" />
          <path d="M32 118 22 96l10-40" />
          <path d="M40 56c-5-9-3-16 3-21" />
        </template>
        <template v-else>
          <path
            d="M64 96c-14-4-27-13-33-25 6-11 19-17 32-16 6 0 10 3 12 8 4 11 1 24-11 33Z"
            :fill="isLit ? 'rgba(245, 236, 214, 0.9)' : 'rgba(191, 227, 234, 0.08)'"
          />
          <path d="M41 55c-7-10-5-19 2-25 2 8 7 15 13 19" />
          <path d="M36 92c-14 3-22 9-26 19" />
          <path d="M55 78c4 2 5 5 3 8" />
          <circle cx="47" cy="73" r="2.6" :fill="scaleStroke" stroke="none" />
        </template>
      </g>

      <!-- 点亮：体内烛火 -->
      <g v-if="isLit" class="flame">
        <ellipse cx="128" cy="96" rx="9" ry="14" fill="#ffd79a" opacity="0.85" filter="url(#lantern-soft)" />
        <path d="M128 84c3 6 1 10-1 13-2-3-3-7 1-13Z" fill="#fff2cf" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.lantern {
  display: block;
  line-height: 0;
}

.has-glow {
  filter: drop-shadow(0 0 22px rgba(255, 182, 92, 0.35));
}

.halo {
  animation: lantern-breathe 5.5s ease-in-out infinite;
}

.is-half .scales,
.is-half .head {
  opacity: 0.85;
}

.is-digital {
  animation: digital-float 7s ease-in-out infinite;
}

@keyframes lantern-breathe {
  0%,
  100% {
    opacity: 0.78;
  }
  50% {
    opacity: 1;
  }
}

@keyframes digital-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
</style>
