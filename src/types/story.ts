/**
 * 《传灯人·游鱼》剧情数据结构定义（V3.0）
 *
 * 依据：《传灯人·游鱼_开发文档》v1.0 §6.2 数据模型（步骤 27 实施）
 * 文案唯一事实源：《开发文档》§2 剧情（整合自剧本 V3.0·r1/r2）
 *
 * V3.0 变更要点（与 V2.0 体系不兼容）：
 *  - 旧变量（memory／aiTrust／handMade／hasLetter／lightingChoice／routeClue 与旧 Route 枚举）整体废弃；
 *  - 双轴判定：tradition（守旧）／innovation（创新），各 0–5、互不联动；
 *  - 新增 Stance（表态记录）、c1Order（三错位观看顺序）、c2First、visitedNodes（必看全／解锁驱动）；
 *  - 节点类型新增 montage（序章蒙太奇）／stance（判定触点）／report（倾向报告屏）；
 *  - Choice 新增 setFlags（c1Spot／c2First）／unlock／requiresVisited。
 */

/* ---------- 结构类型 ---------- */

/** C4 最终链：守旧 / 创新 */
export type Route = 'A' | 'B' | null
/** C1 三个错位：展柜 / 货架 / 摊位 */
export type C1Spot = 'museum' | 'gift' | 'stall'
/** C2 先走哪条：九婆的竹篾 / 阿禾的数字鱼 */
export type C2Path = 'jiupo' | 'ahe' | null

/**
 * 场景 key —— 与《开发文档》§4.2 场景表对齐（13 个在用 key）。
 * 素材到位后按 key 替换，代码零改动。
 * 留档停用：home_door／flashback（V2.0 家庭线遗产，见 scenes.ts LEGACY_SCENES）。
 */
export type SceneKey =
  | 'train'
  | 'laoxu_street'
  | 'lantern_workshop'
  | 'museum_case'
  | 'gift_shop'
  | 'night_stall'
  | 'jiupo_courtyard'
  | 'studio_night'
  | 'banyan_night'
  | 'fish_parade'
  | 'workshop_next_year'
  | 'city_facade'
  | 'dry_field'

/** 一次表态记录（触点写入；C2-X / C3-4） */
export interface Stance {
  /** C2-X / C3-4 */
  nodeId: string
  source: 'preset' | 'free'
  /** 预设标签 or 玩家原话 */
  text: string
  /** 本次增量（-1 ~ +2） */
  tradition: number
  innovation: number
  /** AI 依据（仅自由输入） */
  evidence?: string
  resolved?: boolean
}

/** 游戏状态（《开发文档》§6.2；不得新增未在此声明的变量） */
export interface GameState {
  currentNodeId: string
  /** 双轴判定：守旧值 0–5（互不联动） */
  tradition: number
  /** 双轴判定：创新值 0–5（互不联动） */
  innovation: number
  stances: Stance[]
  /** C4 最终链（只由 C4 写定） */
  route: Route
  /** 三个错位的观看顺序（三个必看全） */
  c1Order: C1Spot[]
  c2First: C2Path
  /** 驱动「必看全／解锁另一条」 */
  visitedNodes: string[]
  /** 自由输入原文（仅本地） */
  freeInputs: string[]
}

/**
 * 条件表达式（when / showIf / 结局微差）。
 * visited：某节点已访问过（用于解锁类判断）。
 */
export type Condition =
  | { key: 'tradition'; gte?: number; lte?: number }
  | { key: 'innovation'; gte?: number; lte?: number }
  | { key: 'route'; eq: 'A' | 'B' }
  | { key: 'visited'; has: string }

export type Speaker =
  | '旁白'
  | '知遥'
  | '阿鲟'
  | '九婆'
  | '阿禾'
  | '周经理'
  | '管理员'

/** 行的呈现形态 */
export type LineType =
  | 'narration' // 旁白 / 内心独白（走底部对白框）
  | 'dialogue' // 角色对白（走底部对白框，台词「」为呈现层包装）
  | 'sms' // 短信 / 纸条文字（能力保留）
  | 'caption' // 画面题注：中央字卡，渐隐 + 自动推进
  | 'stage' // 剧本题注（画面／声音／舞台提示）——仅审核模式显示
  | 'note' // 编剧条件备注——仅审核模式显示
  | 'quote' // 引用式文本（C3-8 共识框架四行等）
  | 'subtitle' // 字幕 / 字卡（章题、结局、尾声）

/** 道具亮相 id（光雾中浮出的关键道具，视图见 ItemShowcase.vue；素材到位后可替换为图片） */
export type ShowcaseItem = 'ledger' | 'letter' | 'note'

export interface Line {
  speaker?: Speaker
  text: string
  type?: LineType
  /** 全部条件成立才显示本行 */
  when?: Condition[]
  /** 剧本题注的场景 key（如 `train`；审核模式拼回「场景 key｜描述」） */
  sceneTag?: string
  /** 含提示符号的剧本原文（仅审核模式显示） */
  scriptRaw?: string
  /** 道具亮相：本行在整屏光雾中以「道具 + 文字」呈现（文案不变，仅呈现方式） */
  item?: ShowcaseItem
  /** 运行时标记：本行由 AI 生成（固定文本禁止标记） */
  aiGenerated?: boolean
}

/** 双轴增量（触点／抉择用；幅度按《开发文档》§3 锁 -1 ~ +2） */
export interface ChoiceEffects {
  tradition?: number
  innovation?: number
}

/** 抉择写入的结构标记（引擎据此维护 c1Order / c2First / route） */
export interface ChoiceFlags {
  route?: Route
  /** 本选项进入的错位（引擎据此维护 c1Order）——同时驱动「补看轮」去重 */
  c1Spot?: C1Spot
  /** C2 先走哪条（首次选择写入）——同时驱动「体验完自动解锁另一条」 */
  c2First?: C2Path
}

export interface Choice {
  /** 剧本编号，如 C1-3-A —— 仅审核模式展示 */
  id: string
  text: string
  /** 选择后展开的专属叙述（先播再汇合；无用例时为空数组） */
  outcome: Line[]
  nextNodeId: string
  effects?: ChoiceEffects
  setFlags?: ChoiceFlags
  /** 解锁另一条（C2 体验段）：选择后目标可在补看轮中继续呈现（C2 数据化时接入） */
  unlock?: string
  /** 未看全则排队续播（三个必看）：列出需先访问过的节点，未满足则本选项不展示 */
  requiresVisited?: string[]
  /** 不满足则不渲染 */
  showIf?: Condition[]
  /** 剧本备注，审核模式显示（如选项字母 A/B/C） */
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

/** 触点预设（固定判定值，不调 AI；收束台词走剧本） */
export interface StancePreset {
  id: string
  /** 预设答案按钮文案（剧本选项原文） */
  text: string
  /** 固定判定值（幅度按《开发文档》§3.4／§3.5 表写死） */
  tradition: number
  innovation: number
  /** 收束台词（阿鲟／对方角色固定语） */
  close: Line[]
}

/** 判定触点配置（C2-X 次触点 / C3-4 主触点；步骤 33 起接入） */
export interface StanceConfig {
  question: string
  placeholder: string
  /** 汉字数上限（触点为 100） */
  limit: number
  /** 可跳过（C2-X 次触点；跳过入口「先不记录，跳过」） */
  skippable?: boolean
  /** 跳过收束（如「未记录。跳过。」） */
  skipClose?: Line[]
  presets: StancePreset[]
  /** AI 判定提示词模板 key（步骤 29 重写） */
  aiPromptKey: string
}

export interface FreeInputConfig {
  question: string
  placeholder: string
  /** 汉字数上限（V3.0 触点为 100） */
  limit: number
  presets: FreeInputPreset[]
  /** AI 提示词模板 key（见 services/aiClient.ts；步骤 29 重写为双轴判定） */
  aiPromptKey: string
  /** 可跳过（C2-X 次触点；跳过入口文案「先不记录，跳过」） */
  skippable?: boolean
}

/**
 * 节点类型：
 *  - normal  常规线性
 *  - montage 序章蒙太奇（可跳过不可快进）
 *  - choice  抉择（选项组）
 *  - stance  判定触点（3 预设 + 自由输入）★步骤 33 接入
 *  - report  倾向报告屏（C3-R）★步骤 35 接入
 *  - ending  结局页
 */
export type NodeKind = 'normal' | 'montage' | 'choice' | 'stance' | 'report' | 'ending'

export interface StoryNode {
  /** 剧本节点号，如 PRO-1 / C1-4a */
  id: string
  /** 章节归属（回看分组用），如「第一章·灯往何处去」 */
  chapter: string
  /** 段落小标题（如「C1-1｜归途」），仅审核模式展示 */
  sectionTitle?: string
  scene: SceneKey
  lines: Line[]
  kind?: NodeKind
  choices?: Choice[]
  nextNodeId?: string
  /**
   * 自由输入配置（V2.0 能力保留：预设 + 自由输入界面 `FreeInput.vue` 即 §5.9 触点界面）。
   * V3.0 的两处触点（C2-X／C3-4）由 `stance` 接管时复用同一界面。
   */
  freeInput?: FreeInputConfig
  /** 判定触点配置（kind='stance' 时；步骤 33 接入） */
  stance?: StanceConfig
  /**
   * 序章单屏背景图（相对 `/assets/scenes/` 的路径，如 `prologue/PRO-1a_竹林晨光.jpg`）。
   * 图片优先、无图回落场景渐变（见 SceneBackdrop）。
   */
  backdrop?: string
  /**
   * 纯图片镜头停留时长（ms）：montage 节点无玩家可见文本行时，
   * 展示 `backdrop` 停留该时长后自动推进（如序章「手与刀」无字镜头）。
   */
  holdMs?: number
  /** 幕末节点 */
  endOfAct?: boolean
  /** 编剧备注 */
  note?: string
}
