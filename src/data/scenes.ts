/**
 * 场景留白体系（V3.0，《开发文档》§4.2 场景表）
 *
 * 人物 / 场景素材未到位期间，不使用灰块占位图，而是用「氛围底版」：
 *   CSS 渐变（光源 + 底色）+ 纸纹颗粒 + 暗角 合成一张"有意图的"底图。
 * 每张底版对应一个 scene key，素材到位后只需替换 SceneBackdrop 内的图层，代码零改动。
 *
 * 2026-10-16 基调提亮：各场景底色由「深夜」整体提亮为「暮色」（暖光源不变，mood 节奏保持）。
 * 2026-10-16 V3.0 结构改造（步骤 30）：新增 museum_case／gift_shop／night_stall／
 *   studio_night／city_facade 五个 key（共 13 个在用）；home_door／flashback 停用（LEGACY_SCENES 留档）。
 *
 * 【（反）火】例外（§4.2）：museum_case／gift_shop／night_stall 三处是全片唯一允许"没有暖源"
 *   的场景，用于制造错位感；每处仍保留一个暖的"引线"（展柜的烛痕／货架前的阿禾／摊位外的孩子）。
 *
 * TODO(asset): 每个 scene 对应《人物设定与场景设计 r4》的一张图，命名 bg_<key>.webp。
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
  /* 错位一·展览（（反）火：冷射灯展厅，唯一暖＝玻璃深处的烛痕） */
  museum_case: {
    name: '县文化馆·展柜',
    base: ['#232C3E', '#3E4A61'],
    glow: '#D8E2EE',
    glowPos: '50% 26%',
    glowStrength: 0.44,
    mood: 'dusk',
    asset: 'bg_museum_case.webp',
  },
  /* 错位二·符号（（反）火：商业明亮，唯一暖＝货架前的阿禾） */
  gift_shop: {
    name: '文创店·货架',
    base: ['#3E3446', '#6A5666'],
    glow: '#F2D8AE',
    glowPos: '52% 20%',
    glowStrength: 0.6,
    mood: 'dusk',
    asset: 'bg_gift_shop.webp',
  },
  /* 错位三·纪念品（（反）火：白 LED 夜市，唯一暖＝摊位外的孩子） */
  night_stall: {
    name: '夜市摊·塑料鱼灯',
    base: ['#1F2C44', '#34405E'],
    glow: '#E6EFFA',
    glowPos: '50% 30%',
    glowStrength: 0.5,
    mood: 'night',
    asset: 'bg_night_stall.webp',
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
  /* 工作室：屏幕冷光（窗外真鱼灯的暖由数字鱼/场景素材承担） */
  studio_night: {
    name: '阿禾的工作室·夜',
    base: ['#1B2740', '#2C3A5C'],
    glow: '#9CC8E0',
    glowPos: '62% 28%',
    glowStrength: 0.5,
    mood: 'night',
    asset: 'bg_studio_night.webp',
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
  workshop_next_year: {
    name: '传灯坊·门口',
    base: ['#453A2B', '#705A3E'],
    glow: '#FFD79A',
    glowPos: '62% 20%',
    glowStrength: 0.62,
    mood: 'day',
    asset: 'bg_workshop_next_year.webp',
  },
  /* 城市幕墙：冷城市里的暖金鱼群——"鱼把灯带进了没有灯的地方" */
  city_facade: {
    name: '城市幕墙·数字鱼群',
    base: ['#131F36', '#25355A'],
    glow: '#FFD79A',
    glowPos: '50% 44%',
    glowStrength: 0.72,
    mood: 'night',
    asset: 'bg_city_facade.webp',
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
}

/**
 * 留档场景（V3.0 停用，保留定义备用：《开发文档》§4.2 表 L1/L2——家庭线遗产）。
 * 不参与 SceneKey 联合类型；如需启用，将其移回 SCENES 并补充 SceneKey。
 */
export const LEGACY_SCENES = {
  home_door: {
    name: '家中·父亲那扇门·夜（停用）',
    base: ['#1D2B40', '#2F425F'],
    glow: '#E8A33D',
    glowPos: '42% 55%',
    glowStrength: 0.48,
    mood: 'night',
  },
  flashback: {
    name: '闪回·八岁的他（停用）',
    base: ['#3B3444', '#6C5C52'],
    glow: '#FFD9A0',
    glowPos: '46% 62%',
    glowStrength: 0.62,
    mood: 'night',
  },
} satisfies Record<string, Omit<SceneDef, 'asset'>>

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
 * 展厅偏冷灰、工作室偏蓝紫……）；素材底图到位后亦自动适配，无需手工维护。
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
