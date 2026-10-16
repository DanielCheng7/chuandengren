<script setup lang="ts">
/**
 * 转场角标水印（UI 设计书 r4 §6）
 *
 * 场景切换时右上角浮出半透明作品名：竖排衬线「传灯人」+ 一缕收尾灯线，
 * 约 2.4s 起落，与转场花光（SceneBackdrop ④）呼应 —— 灯光亮起，落款浮现。
 * 由 StoryScreen 以 `:key="sceneKey"` 重挂载，保证每次转场重放；
 * 仅作氛围与版权标识，不参与任何交互。
 */
</script>

<template>
  <div class="mark" aria-hidden="true">
    <span class="mark-cn">传灯人</span>
    <span class="mark-wick" />
  </div>
</template>

<style scoped>
.mark {
  position: absolute;
  top: calc(24px + env(safe-area-inset-top, 0px)); /* 顶栏已移除（r4），角标上移 */
  right: 20px;
  z-index: 6;
  display: grid;
  justify-items: center;
  gap: 7px;
  pointer-events: none;
  animation: mark-float 2.4s ease-in-out both;
}

.mark-cn {
  writing-mode: vertical-rl;
  font-family: var(--font-title);
  font-size: 16.5px;
  line-height: 1;
  letter-spacing: 0.34em;
  color: rgba(232, 163, 61, 0.85);
  text-shadow: 0 0 16px rgba(255, 182, 92, 0.4), 0 1px 8px rgba(8, 14, 28, 0.65);
}

/* 收尾灯线：一缕短灯芯，向下渐隐 */
.mark-wick {
  width: 1px;
  height: 16px;
  background: linear-gradient(180deg, rgba(232, 163, 61, 0.7), rgba(232, 163, 61, 0));
}

@keyframes mark-float {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }
  16% {
    opacity: 1;
  }
  72% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mark {
    display: none;
  }
}
</style>
