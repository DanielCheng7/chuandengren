/**
 * 界面与体验设置（本地持久化）
 * 审核模式：显示剧本舞台提示 / 音效提示 / 选项编号（便于逐字比对《剧本 V2.0》）
 * 演示模式：隐藏一切开发与剧本痕迹，只留作品本身
 */
import { reactive, watch } from 'vue'

const KEY = 'chuandengren.settings.v4'

export interface Settings {
  /** 打字机效果 */
  typewriter: boolean
  /** 每字毫秒 */
  typewriterSpeed: number
  /** 显示剧本舞台 / 音效 / 交互提示（审核用） */
  showStageNotes: boolean
  /** 显示选项的剧本编号（审核用） */
  showChoiceIds: boolean
  /** 显示开发调试面板 */
  showDevPanel: boolean
  /** 主音量 0–100（音频素材接入后生效，0 = 静音） */
  volume: number
  /** 正文字号缩放（小 0.9 / 标准 1 / 大 1.2，写入全局 --font-scale） */
  fontScale: number
}

function defaults(): Settings {
  return {
    typewriter: true,
    typewriterSpeed: 26,
    // 默认＝玩家视角（演示模式）：舞台/音效注记、选项编号均隐藏；
    // 创作团队核对时用 Shift+D 打开调试面板 → 「审核模式」一键显形（2026-10-16 用户决议）
    showStageNotes: false,
    showChoiceIds: false,
    showDevPanel: false,
    volume: 70,
    fontScale: 1,
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    return { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return defaults()
  }
}

/** 全应用共享同一份设置（模块级单例，避免多组件各自持有副本） */
let singleton: SettingsBundle | null = null

export interface SettingsBundle {
  settings: Settings
  enterDemoMode: () => void
  enterReviewMode: () => void
}

export function useSettings(): SettingsBundle {
  if (singleton) return singleton
  singleton = createSettings()
  return singleton
}

function createSettings(): SettingsBundle {
  const settings = reactive<Settings>(load())

  watch(
    settings,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v))
      } catch {
        /* 忽略写入失败 */
      }
    },
    { deep: true }
  )

  /** 字号缩放写入全局变量（--font-scale）：正文、对白框高度与字卡等比联动 */
  function applyFontScale() {
    document.documentElement.style.setProperty('--font-scale', String(settings.fontScale))
  }

  applyFontScale()
  watch(() => settings.fontScale, applyFontScale)

  /** 一键切到"评审演示"状态：干净画面 */
  function enterDemoMode() {
    settings.showStageNotes = false
    settings.showChoiceIds = false
    settings.showDevPanel = false
  }

  /** 一键切回"审核"状态：看得到剧本痕迹 */
  function enterReviewMode() {
    settings.showStageNotes = true
    settings.showChoiceIds = true
    settings.showDevPanel = true
  }

  return { settings, enterDemoMode, enterReviewMode }
}
