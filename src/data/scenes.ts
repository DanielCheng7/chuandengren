/**
 * 场景留白体系（制作计划 §0.2）
 *
 * 人物 / 场景素材未到位期间，不使用灰块占位图，而是用「氛围底版」：
 *   CSS 渐变（光源 + 底色）+ 纸纹颗粒 + 暗角 合成一张"有意图的"底图。
 * 每张底版对应一个 scene key，素材到位后只需替换 SceneBackdrop 内的图层，代码零改动。
 *
 * 2026-10-16 基调提亮：各场景底色由「深夜」整体提亮为「暮色」（暖光源不变，mood 节奏保持）。
 *
 * TODO(asset): 每个 scene 对应《人物设定与场景设计》§2 的一张图，命名建议：
 *   bg_laoxu_street.webp / bg_lantern_workshop.webp / ...
 */
import type { SceneKey } from '@/types/story'

export interface SceneDef {
  /** 场景中文名（审核模式展示，正式版隐藏） */
  name: string
  /** 底图主渐变（从上到下） */
  base: [string, string]
  /** 光源色（灯 / 夕阳 / 月色） */
  glow: string
  /** 光源位置 */
  glowPos: string
  /** 光源强度 0–1 */
  glowStrength: number
  /** 整体氛围：日 / 昏 / 夜 */
  mood: 'day' | 'dusk' | 'night'
  /** 素材文件名（到位后替换用） */
  asset?: string
}

export const SCENES: Record<SceneKey, SceneDef> = {
  train: {
    name: '归途列车',
    base: ['#1E314B', '#31486A'],
    glow: '#8FB4D6',
    glowPos: '70% 30%',
    glowStrength: 0.42,
    mood: 'night',
    asset: 'bg_train.webp',
  },
  laoxu_street: {
    name: '老圩街口·黄昏',
    base: ['#3A2A22', '#604632'],
    glow: '#E8A33D',
    glowPos: '80% 22%',
    glowStrength: 0.62,
    mood: 'dusk',
    asset: 'bg_laoxu_street.webp',
  },
  lantern_workshop: {
    name: '奶奶的灯坊',
    base: ['#2B2119', '#503B29'],
    glow: '#FFB65C',
    glowPos: '50% 18%',
    glowStrength: 0.58,
    mood: 'dusk',
    asset: 'bg_lantern_workshop.webp',
  },
  home_door: {
    name: '家中·父亲那扇门·夜',
    base: ['#1D2B40', '#2F425F'],
    glow: '#E8A33D',
    glowPos: '42% 55%',
    glowStrength: 0.48,
    mood: 'night',
    asset: 'bg_home_door.webp',
  },
  jiupo_courtyard: {
    name: '九婆家天井·午后',
    base: ['#3B382C', '#605A46'],
    glow: '#F5EFE2',
    glowPos: '65% 12%',
    glowStrength: 0.55,
    mood: 'day',
    asset: 'bg_jiupo_courtyard.webp',
  },
  banyan_night: {
    name: '圩口老榕树·传灯之夜',
    base: ['#1A2A46', '#26395C'],
    glow: '#FFB65C',
    glowPos: '50% 40%',
    glowStrength: 0.85,
    mood: 'night',
    asset: 'bg_banyan_night.webp',
  },
  fish_parade: {
    name: '游鱼夜·百鱼巡游',
    base: ['#1C2A45', '#2C4266'],
    glow: '#FFD79A',
    glowPos: '50% 64%',
    glowStrength: 0.8,
    mood: 'night',
    asset: 'bg_fish_parade.webp',
  },
  dry_field: {
    name: '旱坡地·黄昏',
    base: ['#4A3628', '#805C3A'],
    glow: '#FFB65C',
    glowPos: '84% 30%',
    glowStrength: 0.55,
    mood: 'dusk',
    asset: 'bg_dry_field.webp',
  },
  flashback: {
    name: '闪回·八岁的他',
    base: ['#3B3444', '#6C5C52'],
    glow: '#FFD9A0',
    glowPos: '46% 62%',
    glowStrength: 0.62,
    mood: 'night',
    asset: 'bg_flashback.webp',
  },
  workshop_next_year: {
    name: '一年后·传灯坊门口',
    base: ['#453A2B', '#705A3E'],
    glow: '#FFD79A',
    glowPos: '62% 20%',
    glowStrength: 0.62,
    mood: 'day',
    asset: 'bg_workshop_next_year.webp',
  },
}

export function getScene(key: SceneKey): SceneDef {
  return SCENES[key] ?? SCENES.lantern_workshop
}

/* ---------- 场景谐调色（对话带 / 选项带，2026-10-16 用户决议：随场景一并切换） ---------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/**
 * 由场景底版主渐变推导「谐调色」：取 base 两色 3:7 混合、整体压暗 18%——
 * 足够沉稳可承白字，又与场景同调（夜场偏蓝、黄昏室内偏暖棕、天井偏橄榄、
 * 闪回偏紫褐……）；素材底图到位后亦自动适配，无需手工维护。
 *
 * 返回 `"r, g, b"` 字符串，供 CSS `rgba(var(--tint), α)` 使用
 * （StoryScreen 将其写入 `--tint`，DialogueBox / ChoiceButtons 消费）。
 */
export function getSceneTint(key: SceneKey): string {
  const def = getScene(key)
  const a = hexToRgb(def.base[0])
  const b = hexToRgb(def.base[1])
  const dim = a.map((v, i) => Math.round((v * 0.68 + b[i] * 0.32) * 0.82))
  return `${dim[0]}, ${dim[1]}, ${dim[2]}`
}
