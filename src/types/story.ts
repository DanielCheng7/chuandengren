/**
 * 《传灯人》剧情数据结构定义
 * 依据：《规格书》§3 / §7，文案以《剧本 V2.0》为唯一事实源
 */

export type Route = 'algorithm' | 'memory' | 'community' | null
export type LightingChoice = 'solo' | 'father' | 'public' | null

/** 场景 key —— 与《剧本 V2.0》§3、《人物设定与场景设计 r2》§2 对齐（共 10 个）
 *  素材到位后按 key 替换，代码零改动 */
export type SceneKey =
  | 'train'
  | 'laoxu_street'
  | 'lantern_workshop'
  | 'home_door'
  | 'jiupo_courtyard'
  | 'banyan_night'
  | 'fish_parade'
  | 'workshop_next_year'
  | 'dry_field'
  | 'flashback'

/** 游戏状态（《规格书》§3，不得新增变量） */
export interface GameState {
  currentNodeId: string
  route: Route
  memory: number
  aiTrust: number
  handMade: boolean
  hasLetter: boolean
  lightingChoice: LightingChoice
  freeInput?: string
  routeClue?: string
}

/** 条件表达式：用于 when / showIf / 路线专属检查 */
export type Condition =
  | { key: 'hasLetter'; is: boolean }
  | { key: 'handMade'; is: boolean }
  | { key: 'memory'; gte?: number; lte?: number }
  | { key: 'aiTrust'; gte?: number; lte?: number }
  | { key: 'route'; eq: Exclude<Route, null> }
  | { key: 'lightingChoice'; eq: Exclude<LightingChoice, null> }

export type Speaker =
  | '旁白'
  | '知遥'
  | '阿鲟'
  | '林父'
  | '九婆'
  | '奶奶'
  | '字幕'
  | '系统'

/** 行的呈现形态 */
export type LineType =
  | 'narration' // 内心独白 / 旁白
  | 'dialogue' // 角色对白
  | 'sms' // 短信 / 纸条文字
  | 'caption' // 画面中央字卡：场景切换 / 画面描述，居中渐隐 + 自动推进
  | 'stage' // 剧本舞台、音效、交互提示（审核模式显示，演示模式隐藏）
  | 'note' // 编剧条件备注
  | 'quote' // 引用式文本（纸条、字幕）
  | 'subtitle' // 字幕

/** 道具亮相 id（光雾中浮出的关键道具，视图见 ItemShowcase.vue；素材到位后可替换为图片） */
export type ShowcaseItem = 'ledger' | 'letter' | 'note'

export interface Line {
  speaker?: Speaker
  text: string
  type?: LineType
  /** 全部条件成立才显示本行 */
  when?: Condition[]
  /**
   * 剧本题注的场景 key（如 `train`）。
   * 剧本原文写作「场景 train｜夜行列车。……」，此处把 key 与描述分开存：
   * 玩家看到的是纯描述字卡，审核模式额外显示 key 与完整剧本原文。
   */
  sceneTag?: string
  /**
   * 完整剧本原文（含剧本提示符号，如「→ 列车到站。进入 S02。」「汇合点 1｜……」）。
   * 仅审核模式显示；玩家看到的是剥离提示符号后的 `text`。
   */
  scriptRaw?: string
  /**
   * 道具亮相：本行在整屏光雾中以「道具 + 文字」呈现（文案不变，仅呈现方式；
   * 渐入 → 停留 → 渐隐 → 自动推进）。见 ItemShowcase.vue。
   */
  item?: ShowcaseItem
  /** 运行时标记：本行由 AI 生成（固定文本禁止标记） */
  aiGenerated?: boolean
}

export interface ChoiceEffects {
  memory?: number
  aiTrust?: number
}

export interface ChoiceFlags {
  handMade?: boolean
  hasLetter?: boolean
  route?: Route
  lightingChoice?: LightingChoice
  routeClue?: string
}

export interface Choice {
  /** 剧本编号，如 A1-1 / B0-2 / R1-A —— 仅审核模式展示 */
  id: string
  text: string
  /** 选择后展开的分支叙述（剧本中该选项下的正文） */
  outcome: Line[]
  nextNodeId: string
  effects?: ChoiceEffects
  setFlags?: ChoiceFlags
  /** 不满足则不渲染（例：B1-2 需 hasLetter） */
  showIf?: Condition[]
  /** 剧本备注，审核模式显示 */
  note?: string
}

export interface FreeInputPreset {
  id: string
  /** 预设答案按钮文案（剧本选项原文） */
  text: string
  /** 固定回应（走剧本，不调用 AI） */
  response: Line[]
  effects?: ChoiceEffects
  note?: string
}

export interface FreeInputConfig {
  question: string
  placeholder: string
  /** 汉字数上限（规格书建议 200） */
  limit: number
  presets: FreeInputPreset[]
  /** AI 提示词模板 key（见 services/aiClient.ts） */
  aiPromptKey: string
}

export type NodeKind = 'normal' | 'freeInput' | 'ending'

export interface StoryNode {
  id: string
  act: 1 | 2 | 3
  /** 幕名，如 第一幕「归」 */
  chapter: string
  /** 段落小标题（如 节点 S01｜归途列车），仅审核模式展示 */
  sectionTitle?: string
  scene: SceneKey
  lines: Line[]
  choices?: Choice[]
  nextNodeId?: string
  kind?: NodeKind
  freeInput?: FreeInputConfig
  /** 路线专属节点（R1-01 / R2-01 / R3-01） */
  routeOnly?: Exclude<Route, null>
  /** 幕末节点 */
  endOfAct?: boolean
  /** 编剧备注 */
  note?: string
}
