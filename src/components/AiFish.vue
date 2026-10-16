<script setup lang="ts">
/**
 * 阿鲟的视觉形象 —— 纯代码绘制（制作计划 §0.2）
 * "一条由暖金细线构成的鱼"。不是人形角色，因此不依赖任何图片素材。
 * 状态：idle 待机 / thinking 思考（线条流动）/ scan 扫描（冷白线框展开）/ stuck 卡住（线条凝滞）
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    state?: 'idle' | 'thinking' | 'scan' | 'stuck'
    size?: number
    /** "鱼化龙"彩蛋：短暂勾出龙头轮廓 */
    dragonWhisper?: boolean
  }>(),
  { state: 'idle', size: 92, dragonWhisper: false }
)

const stroke = computed(() => (props.state === 'scan' ? '#cfeaf2' : '#e8a33d'))
const bodyOpacity = computed(() => (props.state === 'stuck' ? 0.72 : 1))
</script>

<template>
  <div class="ai-fish" :class="`is-${state}`" :style="{ width: `${size}px` }">
    <svg viewBox="0 0 128 84" role="img" aria-label="阿鲟">
      <g
        fill="none"
        :stroke="stroke"
        stroke-width="1.3"
        stroke-linecap="round"
        :opacity="bodyOpacity"
      >
        <!-- 鱼身 -->
        <path
          class="body"
          d="M12 42C24 24 56 17 78 27c12 5.5 20 11 25 15-5 4-13 9.5-25 15-22 10-54 3-66-15Z"
        />
        <!-- 尾鳍 -->
        <path class="tail" d="M103 42c5-8 11-13 16-15-4 8-4 22 0 30-5-2-11-7-16-15Z" />
        <!-- 背鳍 -->
        <path class="fin" d="M52 23c5-9 15-12 22-8-8 4-16 9-22 12Z" />
        <!-- 腹鳍 -->
        <path class="fin" d="M56 60c3 7 10 11 16 9-6-3-12-7-16-11Z" />
        <!-- 鳞（数据细线） -->
        <g opacity="0.75">
          <path d="M38 30c5 7 5 17 0 24" />
          <path d="M50 28c6 8 6 19 0 27" />
          <path d="M62 28c6 8 6 19 0 27" />
          <path d="M74 30c5 7 5 17 0 24" />
        </g>
        <!-- 眼 -->
        <circle cx="27" cy="39" r="1.9" :fill="stroke" stroke="none" />
        <!-- 鱼化龙彩蛋：短暂勾出龙头轮廓 -->
        <g v-if="dragonWhisper" class="dragon" opacity="0.9">
          <path d="M20 42c-6-6-14-8-19-6" />
          <path d="M14 34c-2-7-7-11-12-12" />
          <path d="M12 50c-3 6-9 9-14 9" />
          <path d="M22 28c1-5 4-8 8-9" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ai-fish {
  display: block;
  line-height: 0;
  filter: drop-shadow(0 0 6px rgba(232, 163, 61, 0.35));
}

.ai-fish.is-idle {
  animation: float 6s ease-in-out infinite;
}

.ai-fish.is-thinking .body,
.ai-fish.is-thinking .tail {
  stroke-dasharray: 6 5;
  animation: flow 1.6s linear infinite;
}

.ai-fish.is-scan .body {
  stroke-dasharray: 3 4;
  animation: flow 1.1s linear infinite;
}

.ai-fish.is-stuck {
  animation: none;
}

.ai-fish.is-stuck .body,
.ai-fish.is-stuck .tail {
  stroke-dasharray: 14 3;
  animation: stall 2.4s steps(2, end) infinite;
}

.dragon {
  animation: fade-in 0.4s ease both;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes flow {
  to {
    stroke-dashoffset: -22;
  }
}

@keyframes stall {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.85;
  }
}
</style>
