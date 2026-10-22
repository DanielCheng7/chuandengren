<script setup lang="ts">
/**
 * 页面级「AI辅助生成」角标（2026-10-22 用户要求：左上角、整页最上层、不抢眼）
 *
 * 与对白行里的「AI 生成」小标记（`global.css` 的 `.ai-badge`）不是一回事：
 * 那个标「这一句由模型现编」，这个标「整件作品的画面/配音/文案含 AI 参与」。
 * 所以**类名必须区分**（`.ai-gen-note`），否则全局那条金色内联样式会漏进来。
 *
 * 三条硬约束：
 *   ① **永远在最上层** —— `z-index: 80`：高于剧情页(4/6)、CG(20/30)、竖屏提示(35)、
 *      回看/设置面板(40)、审核面板(30)。以后再加更高的覆盖层，记得回头看这里。
 *   ② **不吃点击** —— `pointer-events: none`。左上角在剧情页正好是「点一下翻页」的热区，
 *      角标若挡住，玩家会以为卡住（同 `OrientationHint` 的教训）。
 *   ③ **不抢眼** —— 低对比纱纸白（46% 不透明度）＋极淡描边，只求"能被看到"，
 *      不做玻璃卡片、不加动效、不参与世界观 UI。
 */
</script>

<template>
  <div class="ai-gen-note" role="note" aria-label="本作品含 AI 辅助生成内容">AI辅助生成</div>
</template>

<style scoped>
.ai-gen-note {
  position: absolute;
  top: calc(11px + env(safe-area-inset-top, 0px));
  left: calc(14px + env(safe-area-inset-left, 0px));
  z-index: 80;

  padding: 1px 6px 2px;
  border: 1px solid rgba(245, 239, 226, 0.12);
  border-radius: 3px;
  background: rgba(5, 8, 15, 0.24);

  font-size: 11px;
  line-height: 1.45;
  letter-spacing: 0.12em;
  color: rgba(245, 239, 226, 0.52);
  /* 标题页／EP 成片是亮米金底，白字不加这点影子就浮不起来（仍是一点，不是描边） */
  text-shadow: 0 1px 2px rgba(5, 8, 15, 0.38);
  white-space: nowrap;

  /* 只管显示：绝不拦截左上角的翻页点击 */
  pointer-events: none;
  user-select: none;
}

/* 窄屏略收一点，别和竖屏提示挤在一起 */
@media (max-width: 480px) {
  .ai-gen-note {
    font-size: 10px;
    letter-spacing: 0.06em;
    padding: 1px 5px;
  }
}
</style>
