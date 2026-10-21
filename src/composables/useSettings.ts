/**
 * 界面与体验设置（本地持久化）
 * 审核模式：显示剧本舞台提示 / 音效提示 / 选项编号（便于逐字比对《传灯人·游鱼_互动叙事剧本》V3.0·r8）
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
  /** 主音量 0–100（0 = 静音；驱动 BGM 与入场 CG 原声，见 useAudio.ts） */
  volume: number
  /**
   * 自动播放（galgame 的 AUTO）：逐行自动推进正文。
   * 遇选项／自由输入触点时**自动关闭**，玩家做出选择后也不恢复（防"手离开也替他选"）。
   */
  autoPlay: boolean
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
    autoPlay: false,
    fontScale: 1,
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    // autoPlay 属「本次播放模式」而非偏好：不跨会话记忆，
    // 免得玩家下次打开发现剧情自己在走（遇选项还会自己关掉，观感很怪）
    return { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>), autoPlay: false }
  } catch {
    return defaults()
  }
}

/** 全应用共享同一份设置（模块级单例，避免多组件各自持有副本） */
let singleton: SettingsBundle | null = null

/**
 * 全局字号基准倍率（叠加在玩家档位之上）。
 * 2026-10-19 用户要求「默认字体再改大」：+10%（对白 20px → 22px）。
 * **2026-10-21 用户要求「全局字体加大」：1.1 → 1.2**，对白约 24px、名字约 25px、
 * 字卡约 26.4px，对白框随 `--font-scale` 等比联动（立绘靠实测 `--dbox-top` 自动适配）。
 */
const FONT_BASE = 1.2

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
    // immediate：把「载入时被强制关闭」的 autoPlay 立刻写回，
    // 免得存档里留着一个与运行时不一致的 true
    { deep: true, immediate: true }
  )

  /**
   * 字号缩放写入全局变量（--font-scale）：正文、对白框高度与字卡等比联动。
   * 在玩家档位（小 0.9 / 标准 1 / 大 1.2）之上再乘一个**全局基准**——
   * 2026-10-19 用户要求「默认字体再改大」：整体 +10%，三档语义不变、旧存档无需迁移。
   */
  function applyFontScale() {
    document.documentElement.style.setProperty(
      '--font-scale',
      String(settings.fontScale * FONT_BASE)
    )
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
