<script setup lang="ts">
/**
 * 场景旁白字卡（UI 设计书 r3 §4.6）
 *
 * 舞台题注中 `场景 `key`｜描述` 形式的条目（前缀剥离后）在画面中央呈现：
 * 渐入 → 停留 → 渐隐（衬线小字卡，无底框）；停留与自动推进由 StoryScreen 统一调度
 * （按文字长度 2.5–7.5s，点击可提前跳过）。
 * 其余旁白（叙述 / 内心独白）与对白照常走底部对白框。
 */
defineProps<{
  text: string | null
  /** 行变化标识（nodeId:lineIndex），保证相邻同文卡片也能触发过场 */
  lineKey: string
}>()
</script>

<template>
  <div class="card-stage" aria-live="polite">
    <!-- mode="out-in"：旧卡先淡出、新卡再淡入，相邻旁白字卡切换时文字不重叠、更从容 -->
    <Transition name="card" mode="out-in">
      <p v-if="text" :key="lineKey" class="card-text">{{ text }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.card-stage {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  padding: 0 26px;
  pointer-events: none;
}

.card-text {
  margin: 0;
  max-width: 22em;
  padding: 16px 30px;
  text-align: center;
  font-family: var(--font-title);
  font-size: calc(22px * var(--font-scale));
  line-height: 2.05;
  letter-spacing: 0.1em;
  color: rgba(245, 239, 226, 0.97);
  /* 文字后方一层极淡的压暗 + 光晕阴影，保证在光源处也可读 */
  background: radial-gradient(ellipse at center, rgba(12, 20, 36, 0.4) 0%, rgba(12, 20, 36, 0) 72%);
  text-shadow: 0 2px 22px rgba(8, 14, 28, 0.85), 0 0 60px rgba(8, 14, 28, 0.5);
}

/* 弹出：从容淡入 + 轻微上浮收拢（序章蒙太奇旁白，慢节奏，柔和 ease-out） */
.card-enter-active {
  transition:
    opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 消失：轻盈上浮淡出（0.95s，2026-10-18 用户决议：淡出加长 0.5s，更从容） */
.card-leave-active {
  transition:
    opacity 0.95s cubic-bezier(0.55, 0, 0.55, 0.2),
    transform 0.95s cubic-bezier(0.55, 0, 0.55, 0.2);
}

.card-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.985);
}

.card-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .card-enter-active,
  .card-leave-active {
    transition: none;
  }
}
</style>
