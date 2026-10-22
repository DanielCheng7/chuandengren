<script setup lang="ts">
/**
 * 底图上的「投影字」叠加层（2026-10-22）
 *
 * 用途：AI 生图写不出稳定文字，而剧本里又有必须"看见"的字——C3-8 的四行字
 * （全剧题眼）就是典型：剧本写「四行字依次亮起，像点灯——投影在竹架上」，
 * 但 `ch3/C3-5-8.webp` 里只有一条蓝色鱼骨全息，一个字都没有。
 * 与其等美术重画（AI 也画不好），不如让这四行字由页面合成：底图不动，
 * 字按剧情逐行"点亮"。
 *
 * 亮起时机由 `StoryScreen` 算好传入（`lit` = 已亮的行数）——
 * 锚在台词上（读到哪句亮哪行），而不是进节点就一次全亮，
 * 这样玩家读一句、墙上亮一行，四行字读完全是亮的。
 *
 * 视觉：暖金 #F4C97A + 强暗边阴影，字后一层柔光板（径向渐变，边缘归零），
 * 不压暗整幅画面（2026-10-22 用户对"给画面加蒙版"明确否决过）。
 */
defineProps<{
  /** 依次亮起的投影文字（每项一行） */
  lines: string[]
  /** 已亮的行数（0 = 全暗；lines.length = 全亮） */
  lit: number
  /**
   * 版式：
   * - `center`（默认）＝画幅上方居中的"投影/灯谱"（C3-8 四行字）；
   * - `screen-tr` ＝屏幕右上角的小字读数（C2-B3「渲染精度 99.2%」），
   *   等宽小字、低对比，读起来像界面标注而不是字幕。
   */
  pos?: 'center' | 'screen-tr'
}>()
</script>

<template>
  <div class="projection" :class="pos === 'screen-tr' ? 'screen-tr' : 'center'" aria-hidden="true">
    <p v-for="(t, i) in lines" :key="i" class="pl" :class="{ on: i < lit }">
      {{ t }}
    </p>
  </div>
</template>

<style scoped>
.projection {
  position: absolute;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.projection.center {
  /* 画幅上方中部：避开对白带（底 19%）与两张脸（中段） */
  left: 50%;
  top: 6.5%;
  transform: translateX(-50%);
  width: min(66vw, 1000px);
  align-items: center;
  gap: 0.55em;
  text-align: center;
}

/* 柔光板：字压得住画面，又看不出是一块底 */
.projection.center::before {
  content: '';
  position: absolute;
  inset: -22% -14%;
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(6, 10, 20, 0.7) 0%,
    rgba(6, 10, 20, 0.4) 46%,
    rgba(6, 10, 20, 0) 76%
  );
  z-index: -1;
  pointer-events: none;
}

/* 屏幕右上角的界面读数：贴在大屏蓝底的空处 */
.projection.screen-tr {
  right: 14.5%;
  top: 7%;
  align-items: flex-end;
  gap: 0.3em;
  text-align: right;
}
.projection.screen-tr::before {
  content: '';
  position: absolute;
  inset: -60% -30%;
  background: radial-gradient(
    ellipse at 70% 50%,
    rgba(4, 14, 34, 0.55) 0%,
    rgba(4, 14, 34, 0) 72%
  );
  z-index: -1;
  pointer-events: none;
}

.pl {
  margin: 0;
  font-size: clamp(18px, 1.9vw, 30px);
  line-height: 1.45;
  letter-spacing: 0.18em;
  color: #f4c97a;
  /* 未点亮：暗、虚、略低一点——像还没通光的字 */
  opacity: 0;
  transform: translateY(6px);
  filter: blur(7px);
  text-shadow:
    0 0 2px rgba(16, 10, 4, 0.9),
    0 2px 10px rgba(0, 0, 0, 0.85);
  transition:
    opacity 0.85s ease,
    filter 0.85s ease,
    transform 0.85s ease;
}

/* 界面读数版：等宽、小、偏冷，像屏幕自己画的 */
.screen-tr .pl {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: clamp(12px, 1.02vw, 17px);
  letter-spacing: 0.06em;
  color: rgba(214, 236, 255, 0.92);
  text-shadow: 0 1px 3px rgba(0, 8, 20, 0.9);
}

/* 点亮：再补一层暖光晕 + 一次"通光"的微闪 */
.pl.on {
  opacity: 1;
  transform: none;
  filter: blur(0);
  text-shadow:
    0 0 2px rgba(16, 10, 4, 0.9),
    0 0 18px rgba(255, 168, 72, 0.5),
    0 2px 10px rgba(0, 0, 0, 0.85);
  animation: pl-light 1.5s ease-out;
}

@keyframes pl-light {
  0% {
    opacity: 0.25;
    text-shadow:
      0 0 2px rgba(16, 10, 4, 0.9),
      0 0 34px rgba(255, 168, 72, 0.85),
      0 2px 10px rgba(0, 0, 0, 0.85);
  }
  100% {
    opacity: 1;
  }
}
</style>
