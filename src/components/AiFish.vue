<script setup lang="ts">
/**
 * 阿鲟的视觉形象 —— 鱼灯精灵（2026-10-17 重做，v3）
 * 一盏巴掌大的 mini 鲤鱼灯：竹篾为架、纱纸为皮、腹中一点烛火；悬空漂游，无提杆。
 * 状态：idle 待机 / thinking 思考（烛火变亮）/ scan 扫描（纱纸变透、竹骨结构显露）/ stuck 卡住（烛火将熄）
 * dragonWhisper：「灯影成龙」彩蛋——纱纸上短暂映出龙首影子
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    state?: 'idle' | 'thinking' | 'scan' | 'stuck'
    size?: number
    /** "灯影成龙"彩蛋：纱纸上短暂映出龙首影子 */
    dragonWhisper?: boolean
  }>(),
  { state: 'idle', size: 92, dragonWhisper: false }
)

const bone = computed(() => (props.state === 'scan' ? '#cfeaf2' : '#6e8b7a'))
const scaleColor = computed(() => (props.state === 'scan' ? '#cfeaf2' : '#c0392b'))
const paperOpacity = computed(() =>
  props.state === 'scan' ? 0.03 : props.state === 'stuck' ? 0.06 : 0.1
)
const fireOpacity = computed(() => (props.state === 'stuck' ? 0.35 : 1))
const glowOpacity = computed(() => (props.state === 'stuck' ? 0.35 : 1))
</script>

<template>
  <div class="ai-fish" :class="`is-${state}`" :style="{ width: `${size}px` }">
    <svg viewBox="0 0 128 96" role="img" aria-label="阿鲟">
      <defs>
        <radialGradient id="ai-fish-glow">
          <stop offset="0%" stop-color="#FFB65C" stop-opacity="0.40" />
          <stop offset="55%" stop-color="#FFB65C" stop-opacity="0.13" />
          <stop offset="100%" stop-color="#FFB65C" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- 烛火光晕 -->
      <circle class="glow" cx="64" cy="52" r="21" fill="url(#ai-fish-glow)" :opacity="glowOpacity" />

      <!-- 鱼身：纱纸（半透） -->
      <path
        class="paper"
        d="M12 48C16 34 34 24 58 24C84 24 102 34 108 48C102 62 84 72 58 72C34 72 16 62 12 48Z"
        :fill="`rgba(245,239,226,${paperOpacity})`"
        stroke="none"
      />

      <!-- 尾鳍 -->
      <path
        class="tail"
        d="M108 48C114 40 120 34 124 30C120 41 120 55 124 66C120 62 114 56 108 48Z"
        fill="none"
        :stroke="bone"
        stroke-width="1"
        stroke-linejoin="round"
      />
      <path
        d="M110 48C116 44 120 40 122 38M110 48C116 52 120 56 122 58"
        fill="none"
        :stroke="bone"
        stroke-width="0.55"
        opacity="0.7"
      />

      <!-- 背鳍 / 腹鳍 -->
      <path d="M56 24C60 15 70 11 78 14C72 18 64 22 60 27Z" fill="none" :stroke="bone" stroke-width="0.9" opacity="0.9" />
      <path d="M58 71C62 78 70 82 78 79C72 75 66 72 62 69Z" fill="none" :stroke="bone" stroke-width="0.9" opacity="0.9" />

      <!-- 鱼身轮廓 -->
      <path
        d="M12 48C16 34 34 24 58 24C84 24 102 34 108 48C102 62 84 72 58 72C34 72 16 62 12 48Z"
        fill="none"
        :stroke="bone"
        stroke-width="1.1"
        stroke-linejoin="round"
      />

      <!-- 环骨（竖弧）4 道 -->
      <g fill="none" :stroke="bone" stroke-width="0.55" opacity="0.78">
        <path d="M30 31C36 44 36 52 30 65" />
        <path d="M50 25C57 44 57 52 50 71" />
        <path d="M70 24C77 44 77 52 70 72" />
        <path d="M90 29C96 44 96 52 90 67" />
      </g>

      <!-- 纵骨 2 道 -->
      <g fill="none" :stroke="bone" stroke-width="0.55" opacity="0.65">
        <path d="M16 42C44 34 84 34 106 44" />
        <path d="M16 54C44 62 84 62 106 52" />
      </g>

      <!-- 彩绘鳞 3 道（金红手绘） -->
      <g fill="none" :stroke="scaleColor" stroke-width="0.85" opacity="0.9">
        <path d="M42 38C48 44 48 52 42 58" />
        <path d="M58 36C65 43 65 53 58 60" />
        <path d="M74 37C80 43 80 53 74 59" />
      </g>

      <!-- 点睛 -->
      <circle cx="22" cy="44" r="1.9" :fill="scaleColor" />

      <!-- 烛火 -->
      <g class="fire" :opacity="fireOpacity">
        <path d="M64 46C61.2 50.6 61.2 55 64 56.8C66.8 55 66.8 50.6 64 46Z" fill="#FFB65C" />
        <path d="M64 50C62.8 52.4 62.8 54.6 64 55.6C65.2 54.6 65.2 52.4 64 50Z" fill="#FFF3D6" opacity="0.9" />
      </g>

      <!-- 灯影成龙（彩蛋）：纱纸上的龙影 -->
      <g v-if="dragonWhisper" class="dragon" opacity="0.55">
        <path d="M16 38C20 30 26 26 32 25" fill="none" stroke="#101B2C" stroke-width="2.2" stroke-linecap="round" />
        <path d="M15 46C20 50 26 52 32 52" fill="none" stroke="#101B2C" stroke-width="2.2" stroke-linecap="round" />
        <path d="M22 35C24 40 24 44 22 48" fill="none" stroke="#101B2C" stroke-width="2" stroke-linecap="round" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ai-fish {
  display: block;
  line-height: 0;
  filter: drop-shadow(0 0 7px rgba(255, 182, 92, 0.26));
}

.ai-fish.is-idle {
  animation: drift 4.2s ease-in-out infinite;
}

.ai-fish.is-idle .fire {
  animation: breathe 3s ease-in-out infinite;
  transform-origin: 64px 52px;
}

.ai-fish.is-thinking {
  animation: drift 3.2s ease-in-out infinite;
}

.ai-fish.is-thinking .fire {
  animation: flicker 1.1s ease-in-out infinite;
  transform-origin: 64px 52px;
}

.ai-fish.is-thinking .glow {
  animation: glow-pulse 2.2s ease-in-out infinite;
}

.ai-fish.is-scan .glow {
  opacity: 0.35;
}

.ai-fish.is-stuck {
  animation: sink 5s ease-in-out infinite;
}

.dragon {
  animation: fade-in 0.4s ease both;
}

@keyframes drift {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.82;
  }
  50% {
    opacity: 1;
  }
}

@keyframes flicker {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }
  35% {
    opacity: 1;
    transform: scale(1.06);
  }
  70% {
    opacity: 0.78;
    transform: scale(0.97);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.75;
  }
  50% {
    opacity: 1;
  }
}

@keyframes sink {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(2px);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.55;
  }
}
</style>
