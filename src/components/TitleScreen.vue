<script setup lang="ts">
/**
 * 标题页（《规格书》§6.2-1）
 *
 * 排版参考同类高分作品封面（如《南栀》）：横向菜单带——大字主标 + 小字注、
 * 居中成排、底部一条浅色横带托底、按钮极简无框；交互沿用「点灯」语言：
 * 主行动「灯芯」常亮，悬停时灯芯线点亮（UI 设计书 r3 §4.2/§4.9）。
 */
import { computed, onMounted, ref } from 'vue'
import SettingsPanel from './SettingsPanel.vue'
import type { StoryEngine } from '@/composables/useStoryEngine'

const props = defineProps<{ engine: StoryEngine }>()
/** 「开始旅程」交给上层（App）先播开场 CG，播完再正式开局 */
const emit = defineEmits<{ (e: 'begin'): void }>()

// RISK-7 修复：改用引擎暴露的响应式 saveExists 标记（persist/loadSave/restart 时维护），
// 不再依赖"组件重挂载才重新读 localStorage"的隐式行为
const hasSave = computed(() => props.engine.saveExists.value)
const showSettings = ref(false)
/** 背景视频是否可用（加载失败时隐藏，回落渐变背景） */
const videoOk = ref(true)

// 进入标题页时同步一次存档标记（读取旧存档场景），此后由引擎变更自动驱动
onMounted(() => props.engine.hasSave())
</script>

<template>
  <div class="title-screen grain">
    <!-- 标题页背景视频（队友提供的高清动画；无视频/加载失败时回落渐变背景）。
         现状（2026-10-21 队友替换）：H.264 / 2560×1440 / 5.05s / ≈18 Mbps / **11.4MB** / 无音轨 /
         faststart。上一版是同一支片子压到 3.4MB 的版本，本次又换回高码率原片——
         首屏要多下 8MB，建议后续重压到 1080p（CRF 23 左右，约 1.5–2.5MB）。
         画面是**暖金米色底**，标题字是纱纸白（#F5EFE2），对比度约 1.6:1（偏淡）。
         2026-10-22 试过给视频压暗，用户否掉（金色变土褐）——**视频保持原色，可读性只在文字侧想办法**。 -->
    <video
      v-if="videoOk"
      class="bg-video"
      autoplay
      muted
      loop
      playsinline
      aria-hidden="true"
      src="/assets/scenes/主页面/标题页_h264.mp4"
      @error="videoOk = false"
    ></video>
    <div class="aurora" />
    <div class="scale-frame" aria-hidden="true" />

    <p class="sub">粤西·遂溪北坡游鱼 · 互动叙事</p>

    <div class="stage">
      <h1 class="name">传灯人</h1>
    </div>

    <!-- 菜单带：横向按键排（大字 + 小字注） -->
    <nav class="menu-band" aria-label="主菜单">
      <button class="menu-item is-primary" type="button" @click="emit('begin')">
        <span class="menu-main">开始旅程</span>
        <span class="menu-sub">START</span>
      </button>
      <button
        v-if="hasSave"
        class="menu-item"
        type="button"
        @click="props.engine.startOrResume(true)"
      >
        <span class="menu-main">继续上次</span>
        <span class="menu-sub">CONTINUE</span>
      </button>
      <button class="menu-item" type="button" @click="showSettings = true">
        <span class="menu-main">设置</span>
        <span class="menu-sub">CONFIG</span>
      </button>
    </nav>

    <div class="meta">
      <span class="proto-tag">原型版</span>
    </div>

    <SettingsPanel v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.title-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: radial-gradient(ellipse at 50% 18%, #33517b 0%, #203150 58%, #182541 100%);
}

/* 背景视频：铺满、覆盖裁剪、不参与交互；其上文字/菜单保持清晰。
   **不加任何滤镜**（2026-10-22 用户：压暗会把金色压成土褐）。原片颜色照原样呈现。 */
.bg-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.aurora {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 62%, rgba(255, 182, 92, 0.22) 0%, transparent 58%);
  animation: breathe 8s ease-in-out infinite;
}

/* 鱼鳞纹：只在四角与边线上克制使用 */
.scale-frame {
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(232, 163, 61, 0.18);
  border-radius: 6px;
  pointer-events: none;
}

.scale-frame::before,
.scale-frame::after {
  content: '';
  position: absolute;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(232, 163, 61, 0.34);
}

.scale-frame::before {
  left: -1px;
  top: -1px;
  border-right: none;
  border-bottom: none;
}

.scale-frame::after {
  right: -1px;
  bottom: -1px;
  border-left: none;
  border-top: none;
}

/* 中央海报区（灯笼 + 题名）在菜单带以上垂直居中 */
.stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 36px 24px 8px;
  text-align: center;
}

.name {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(68px, 17vw, 116px);
  font-weight: 400;
  letter-spacing: 0.16em;
  text-indent: 0.16em;
  color: var(--paper);
  text-shadow: 0 0 34px rgba(255, 182, 92, 0.42);
  animation: fade-in 0.9s ease both;
}

.sub {
  position: absolute;
  top: 5%;
  right: 4%;
  margin: 0;
  writing-mode: vertical-rl;
  font-family: var(--font-title);
  font-size: clamp(18px, 2.2vw, 22px);
  letter-spacing: 0.32em;
  color: var(--paper);
  text-shadow: 0 0 14px rgba(255, 182, 92, 0.28);
  animation: fade-in 1.1s ease both;
}

/* ---------- 菜单带（横向按键排） ---------- */
.menu-band {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: clamp(28px, 7vw, 76px);
  padding: 20px 20px 18px;
  /* 浅色横带：两端向中间渐显，托住菜单（参考封面排版） */
  background: linear-gradient(
    90deg,
    rgba(245, 239, 226, 0) 0%,
    rgba(245, 239, 226, 0.05) 15%,
    rgba(245, 239, 226, 0.08) 50%,
    rgba(245, 239, 226, 0.05) 85%,
    rgba(245, 239, 226, 0) 100%
  );
  border-top: 1px solid rgba(245, 239, 226, 0.1);
  border-bottom: 1px solid rgba(245, 239, 226, 0.1);
}

.menu-item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 6px 6px 14px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.22s ease;
}

.menu-main {
  font-family: var(--font-title);
  font-size: clamp(28px, 4.2vw, 34px);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  transition: color 0.22s ease, text-shadow 0.22s ease;
}

.menu-sub {
  font-size: 13.5px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--text-faint);
  transition: color 0.22s ease;
}

/* 「灯芯线」：主行动常亮一小段，悬停点亮整段（UI 设计书 §4.2） */
.menu-item::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 5px;
  transform: translateX(-50%);
  width: 0;
  height: 1px;
  background: var(--gold);
  transition: width 0.28s ease;
}

.menu-item.is-primary {
  color: var(--paper);
}

.menu-item.is-primary .menu-main {
  text-shadow: 0 0 18px rgba(255, 182, 92, 0.3);
}

.menu-item.is-primary::after {
  width: 26px;
}

@media (hover: hover) and (pointer: fine) {
  .menu-item:hover {
    color: var(--paper);
  }

  .menu-item:hover .menu-sub {
    color: var(--gold);
  }

  .menu-item:hover::after {
    width: 74%;
  }
}

.menu-item:focus-visible {
  outline: 2px solid rgba(232, 163, 61, 0.6);
  outline-offset: 2px;
  border-radius: 4px;
}

.menu-item:active {
  transform: translateY(1px);
}

/* ---------- 横带下的一行注记 + 角落版本标 ---------- */
.meta {
  position: relative;
  display: grid;
  justify-items: center;
  padding: 10px 24px calc(14px + var(--safe-b));
}

.proto-tag {
  position: absolute;
  right: 18px;
  bottom: calc(10px + var(--safe-b));
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--text-faint);
  opacity: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .aurora,
  .name,
  .sub {
    animation: none;
  }
}
</style>
