/**
 * 剧情引擎（V3.0 · r4 结局机制）
 *
 * 职责：节点读取 → 条件过滤 → 应用 effects（双轴 0–6 钳制）→ 跳转
 *       进度 localStorage（刷新可续）· 回看 · 重新开始 · 调试跳转
 *
 * V3.0 机制（步骤 28）：
 *  - visitedNodes：进入节点即记录，驱动「必看全／解锁另一条」；
 *  - 三错位排队（C1）：带 `setFlags.c1Spot` 的选项按 c1Order 去重——
 *    已看过的错位不再展示，剩余按玩家所选顺序续播；全部看完按 nextNodeId 汇合；
 *  - 两路体验（C2）：带 `setFlags.c2First` 的选项按目标节点访问记录去重（补看轮）；
 *  - 序章蒙太奇：`kind='montage'` 可跳过（skipMontage 沿链路走到第一个非蒙太奇节点）；
 *  - 审核透明层：stage/note 行由 `settings.showStageNotes` 控制演示／审核显示。
 *
 * r4 机制（结局由数值决定）：
 *  - `resolveEnding()`：T≥3 且 I≥3 → C《两条河》；否则 T≥I → A；否则 → B（平手归灯）；
 *  - `resolveEndingTier()`：A 空版／温吞／坚定，B 温吞／坚定，C 不分层；
 *  - `isBalancedEp()`：|T−I|≤1 且 T+I≥3 且非双高 → 追加「一日一篾」尾声；
 *  - `kind='settle'`（C4-S）：进入即结算，行过滤可用 `ending／endingTier／balancedEp` 条件，
 *    播完按 `nextByEnding` 分派到对应结局链。
 *
 * 边界：AI 只做判定；节点跳转与变量计算全部由本文件控制。
 */
import { computed, reactive, ref } from 'vue'
import { START_NODE_ID, getNode, nodeProgress } from '@/data/story'
import { useSettings } from '@/composables/useSettings'
import { CAST_MAX, canStandOnStage, limitCast } from '@/data/characters'
import { ASHUN_FALLBACK_LINES } from '@/data/fallbackDialogue'
import { buildStanceReportLine } from '@/utils/report'
import {
  AiTimeoutError,
  requestAshunReply,
  requestJourneySummary,
  requestStanceJudgement,
} from '@/services/aiClient'
import {
  MAX_AXIS,
  isBalancedEp,
  resolveEnding,
  resolveEndingTier,
} from '@/utils/ending'
import type {
  Choice,
  ChoiceEffects,
  ChoiceFlags,
  Condition,
  GameState,
  Line,
  StoryNode,
} from '@/types/story'

const SAVE_KEY = 'chuandengren.save.v4'

/** 分派器对外再导出（组件／调试面板可直接引用） */
export { MAX_AXIS, isBalancedEp, resolveEnding, resolveEndingTier }

export type Phase = 'lines' | 'choice' | 'input' | 'ai' | 'end' | 'break'
export type AiStatus = 'idle' | 'thinking' | 'done' | 'failed'

export interface HistoryEntry {
  nodeId: string
  speaker?: string
  text: string
  type: string
  aiGenerated?: boolean
}

/** 数值统一 0–6 封顶（下限 0，负增量按 0 截断） */
export function addScore(value: number, delta: number, max = MAX_AXIS): number {
  return Math.max(0, Math.min(max, value + delta))
}

export function evalCondition(s: GameState, c: Condition): boolean {
  switch (c.key) {
    case 'tradition':
      if (c.gte !== undefined && s.tradition < c.gte) return false
      if (c.lte !== undefined && s.tradition > c.lte) return false
      return true
    case 'innovation':
      if (c.gte !== undefined && s.innovation < c.gte) return false
      if (c.lte !== undefined && s.innovation > c.lte) return false
      return true
    case 'axisDiff': {
      // 守旧值 − 创新值：C3-8 之后据此自动进入 C3-A（>0）／C3-B（<0）／C3-C（=0）
      const d = s.tradition - s.innovation
      if (c.gte !== undefined && d < c.gte) return false
      if (c.lte !== undefined && d > c.lte) return false
      return true
    }
    case 'ending':
      return s.ending === c.eq
    case 'endingTier':
      return s.endingTier === c.eq
    case 'balancedEp':
      return Boolean(s.balancedEp) === c.eq
    case 'visited':
      return s.visitedNodes.includes(c.has)
    case 'c1Order':
      return s.c1Order.length === c.size
    default:
      return true
  }
}

export function matchAll(s: GameState, conds?: Condition[]): boolean {
  if (!conds || conds.length === 0) return true
  return conds.every((c) => evalCondition(s, c))
}

function createInitialState(): GameState {
  return {
    currentNodeId: START_NODE_ID,
    tradition: 0,
    innovation: 0,
    stances: [],
    ending: undefined,
    endingTier: undefined,
    balancedEp: false,
    c1Order: [],
    c2First: null,
    appliedOnce: [],
    visitedNodes: [],
    freeInputs: [],
  }
}

export function useStoryEngine() {
  const { settings } = useSettings()
  const state = reactive<GameState>(createInitialState())

  const started = ref(false)
  const nodeId = ref(START_NODE_ID)
  const lines = ref<Line[]>([])
  const lineIndex = ref(0)
  const phase = ref<Phase>('lines')
  const pendingNext = ref<string | null>(null)
  const history = ref<HistoryEntry[]>([])
  const freeInputDone = ref(false)
  const aiStatus = ref<AiStatus>('idle')
  const missingNodeId = ref<string | null>(null)
  const journeySummary = ref<Line[]>([])
  const journeyLoading = ref(false)
  /** 是否存在可继续的存档（响应式标记，标题页「继续上次」按钮用；RISK-7 修复） */
  const saveExists = ref(false)
  /** 纯图片镜头（montage + backdrop + holdMs）停留定时器 */
  let holdTimer: number | undefined

  /* ---------------- 派生状态 ---------------- */
  const node = computed<StoryNode | undefined>(() => getNode(nodeId.value))
  const currentLine = computed<Line | null>(() => lines.value[lineIndex.value] ?? null)
  const visibleChoices = computed<Choice[]>(() =>
    (node.value?.choices ?? []).filter((c) => isChoiceVisible(c))
  )
  const canAdvance = computed(() => phase.value === 'lines')
  const isTyping = computed(() => phase.value === 'ai' && aiStatus.value === 'thinking')
  const progress = computed(() => nodeProgress(nodeId.value))
  const chapter = computed(() => node.value?.chapter ?? '')
  const sectionTitle = computed(() => node.value?.sectionTitle ?? '')
  const sceneKey = computed(() => node.value?.scene ?? 'lantern_workshop')

  /**
   * 在场人物（立绘常驻，2026-10-19 用户要求与市面 galgame 一致）：
   * 立绘不随「这一行是谁在说」闪进闪出，而是**一场戏里持续在场**——
   *  - 换场景 → 按新节点重建（旧场景的人不跟过去）；
   *  - 同场景换节点 → 与本节点说话人合并（**上限 2**，超出按 CAST_PRIORITY 让位）；
   *  - 节点显式 `cast` → 直接采用（用于「人散了」这类同场景内离场）；
   *  - 旁白行不动 cast → 旁白时立绘不消失。
   * 只收「能站上舞台」的角色（有立绘、非第一人称主角）；阿鲟也算角色。
   */
  const cast = ref<string[]>([])

  /* ---------------- 内部工具 ---------------- */
  /**
   * 行过滤：
   *  ① 审核透明层——演示模式（showStageNotes=false）隐藏 stage/note（剧本题注）；
   *  ② when 条件全部成立才保留。
   */
  function filterLines(list: Line[]): Line[] {
    const showNotes = settings.showStageNotes
    return list.filter((l) => {
      if (!showNotes && (l.type === 'stage' || l.type === 'note')) return false
      return matchAll(state, l.when)
    })
  }

  /**
   * 选项可见性（V3.0 补看轮）：
   *  - showIf / requiresVisited：条件不满足不渲染；
   *  - c1Spot 选项：其错位已入 c1Order 则不再展示（三错位「三个必看全」）；
   *  - c2First 选项：其体验节点已访问则不再展示（两路「体验完自动解锁另一条」）。
   */
  function isChoiceVisible(c: Choice): boolean {
    if (!matchAll(state, c.showIf)) return false
    if (
      c.requiresVisited?.length &&
      !c.requiresVisited.every((id) => state.visitedNodes.includes(id))
    ) {
      return false
    }
    if (c.setFlags?.c1Spot && state.c1Order.includes(c.setFlags.c1Spot)) return false
    if (c.setFlags?.c2First && state.visitedNodes.includes(c.nextNodeId)) return false
    return true
  }

  /** 追加一条回看记录（相邻同文同行去重；会话内截断与存档 slice(-120) 口径一致） */
  function pushHistory(nid: string, l: Line) {
    const last = history.value[history.value.length - 1]
    if (last && last.text === l.text && last.speaker === l.speaker) return
    history.value.push({
      nodeId: nid,
      speaker: l.speaker,
      text: l.text,
      type: l.type ?? 'narration',
      aiGenerated: l.aiGenerated,
    })
    // OPT-9：防长会话内存无限增长（与存档 slice(-120) 口径一致）
    if (history.value.length > 300) history.value.splice(0, history.value.length - 300)
  }

  function recordLine() {
    const l = currentLine.value
    if (!l) return
    pushHistory(nodeId.value, l)
  }

  function recordChoiceLabel(text: string) {
    history.value.push({ nodeId: nodeId.value, speaker: '系统', text: `［选择］${text}`, type: 'choice' })
  }

  /** 记录一次表态（触点）：写入 stances，供倾向报告与结局结算使用 */
  function recordStance(
    nid: string,
    source: 'preset' | 'free',
    text: string,
    tradition: number,
    innovation: number,
    evidence?: string,
    presetKey?: 'A' | 'B' | 'C'
  ) {
    state.stances.push({
      nodeId: nid,
      source,
      presetKey,
      text,
      tradition,
      innovation,
      evidence,
      resolved: true,
    })
  }

  /** 双轴增量（0–6 钳制；两轴互不联动） */
  function applyEffects(effects?: ChoiceEffects) {
    if (effects?.tradition) state.tradition = addScore(state.tradition, effects.tradition)
    if (effects?.innovation) state.innovation = addScore(state.innovation, effects.innovation)
  }

  /**
   * 结局结算（C4-S 进入时调用；幂等——已结算则不重算，避免调试跳转反复覆盖）。
   * 写入 ending／endingTier／balancedEp，供行过滤与跳转使用。
   */
  function settleEnding(force = false) {
    if (state.ending && !force) return
    const t = state.tradition
    const i = state.innovation
    state.ending = resolveEnding(t, i)
    state.endingTier = resolveEndingTier(state.ending, t, i)
    state.balancedEp = isBalancedEp(t, i)
  }

  /** 结构标记：c1Spot → 维护 c1Order（观看顺序）；c2First → 仅首次写入 */
  function applyFlags(flags?: ChoiceFlags) {
    if (!flags) return
    if (flags.c1Spot && !state.c1Order.includes(flags.c1Spot)) state.c1Order.push(flags.c1Spot)
    if (flags.c2First && !state.c2First) state.c2First = flags.c2First
  }

  function showLines(list: Line[], next?: string | null) {
    const filtered = filterLines(list)
    pendingNext.value = next ?? null
    if (filtered.length === 0) {
      lines.value = []
      lineIndex.value = 0
      afterLines()
      return
    }
    lines.value = filtered
    lineIndex.value = 0
    phase.value = 'lines'
    recordLine()
    persist()
  }

  /* ---------------- 节点流转 ---------------- */
  function clearHoldTimer() {
    if (holdTimer) {
      window.clearTimeout(holdTimer)
      holdTimer = undefined
    }
  }

  /**
   * 节点的可见行（唯一入口）：
   * 普通节点＝`filterLines(n.lines)`；报告节点（C3-R）还要按 s1／s2 组合追加报告句。
   * **enterNode 与 loadSave 必须共用**——否则刷新恢复时动态行会丢（曾导致 C3-R 刷新后
   * 跳过报告直接进 C4）。
   */
  function resolveNodeLines(n: StoryNode): Line[] {
    if (n.kind === 'report' && n.report) {
      return filterLines([
        ...n.lines,
        {
          speaker: '阿鲟',
          text: buildStanceReportLine(state.stances, n.report),
          type: 'dialogue',
        },
      ])
    }
    return filterLines(n.lines)
  }

  function enterNode(id: string) {
    const n = getNode(id)
    if (!n) {
      // 该章尚未接入（分章开发期间的正常状态）
      missingNodeId.value = id
      phase.value = 'break'
      persist()
      return
    }
    clearHoldTimer()
    missingNodeId.value = null
    // 在场人物：换场景重建／同场景合并／显式 cast 覆盖（见 cast 的注释）
    const prevScene = node.value?.scene
    const nodeSpeakers = n.lines
      .filter((l) => (l.type === 'dialogue' || l.type === 'sms') && canStandOnStage(l.speaker))
      .map((l) => l.speaker as string)
    if (n.cast) {
      cast.value = limitCast(n.cast)
    } else if (prevScene !== undefined && prevScene !== n.scene) {
      cast.value = limitCast(nodeSpeakers)
    } else {
      // 同场景合并：**本节点说话人先占位**（说谁就看见谁），余下名额按优先级补
      cast.value = limitCast([...cast.value, ...nodeSpeakers], CAST_MAX, nodeSpeakers)
    }
    nodeId.value = id
    state.currentNodeId = id
    if (!state.visitedNodes.includes(id)) state.visitedNodes.push(id)
    // C4-S：进入即结算，后续行过滤与跳转都依赖 ending／endingTier／balancedEp
    if (n.kind === 'settle') settleEnding()
    freeInputDone.value = false
    aiStatus.value = 'idle'
    pendingNext.value = null
    lines.value = resolveNodeLines(n)
    lineIndex.value = 0
    phase.value = 'lines'
    recordLine()
    if (lines.value.length === 0) {
      // 纯图片镜头（序章 montage：无玩家可见文本行但有 backdrop + holdMs）——
      // 展示图片停留 holdMs 后自动推进（点击可跳过）
      if (n.kind === 'montage' && n.backdrop && n.holdMs) {
        holdTimer = window.setTimeout(() => {
          holdTimer = undefined
          if (nodeId.value === id && phase.value === 'lines') afterLines()
        }, n.holdMs)
        persist()
        return
      }
      afterLines()
      return
    }
    persist()
  }

  /** 当前节点/分支的行播完之后的流转判定 */
  function afterLines() {
    const n = node.value
    if (!n) {
      phase.value = 'break'
      return
    }
    if (pendingNext.value) {
      const target = pendingNext.value
      pendingNext.value = null
      enterNode(target)
      return
    }
    if (n.kind === 'ending') {
      phase.value = 'end'
      void loadJourneySummary()
      persist()
      return
    }
    // C4-S 走向结算屏：播完按结局分派（未命中则回落 nextNodeId）
    if (n.kind === 'settle') {
      const next = (state.ending && n.nextByEnding?.[state.ending]) || n.nextNodeId
      if (next) {
        enterNode(next)
        return
      }
      console.warn(`[story] 结算节点 ${n.id} 没有匹配 ${state.ending} 的下一节点`)
    }
    // 触点（stance）：行播完进入「3 预设 + 自由输入」界面（可否跳过由节点配置决定）
    if (n.kind === 'stance' && n.stance && !freeInputDone.value) {
      phase.value = 'input'
      persist()
      return
    }
    if (n.freeInput && !freeInputDone.value) {
      phase.value = 'input'
      persist()
      return
    }
    // 报告（report）流程：行已在 resolveNodeLines 里按 s1／s2 追加
    if (visibleChoices.value.length > 0) {
      phase.value = 'choice'
      persist()
      return
    }
    // 条件跳转（如 balancedEp → EP_BAL）：先于 nextNodeId 判定
    if (n.nextIf?.length) {
      const hit = n.nextIf.find((b) => matchAll(state, b.when))
      if (hit?.nodeId) {
        enterNode(hit.nodeId)
        return
      }
    }
    if (n.nextNodeId) {
      enterNode(n.nextNodeId)
      return
    }
    // 兜底：无下一步且非结局 —— 开发期应视为死路
    console.warn(`[story] 节点 ${n.id} 没有合法的下一步`)
    phase.value = 'end'
    persist()
  }

  function advance() {
    if (phase.value !== 'lines') return
    if (lineIndex.value < lines.value.length - 1) {
      lineIndex.value += 1
      recordLine()
      persist()
      return
    }
    afterLines()
  }

  /**
   * 序章蒙太奇「可跳过不可快进」：沿链路走到第一个非蒙太奇节点。
   * 2026-10-18 用户决议：**跳过后回看仍要包含序章全部内容**——沿途每个节点的
   * 可见文本（caption 等；演示模式下已滤掉 stage）按各自 nodeId 补记入 history，
   * 回看按章分组时归入「序章」。visitedNodes 仍不记（跳过不计访问，不影响分支判定）。
   */
  function skipMontage() {
    const start = nodeId.value
    const chain: string[] = []
    let id = start
    for (let i = 0; i < 32; i++) {
      const n = getNode(id)
      if (!n || n.kind !== 'montage' || !n.nextNodeId) break
      chain.push(id)
      id = n.nextNodeId
    }
    if (chain.length === 0 || !getNode(id)) return
    for (const nid of chain) {
      const n = getNode(nid)
      if (!n) continue
      for (const l of filterLines(n.lines)) pushHistory(nid, l)
    }
    enterNode(id)
  }

  /** 真正执行一个选项（无阶段门控；供 choose 与 C1 补看轮自动进入共用） */
  function performChoice(c: Choice) {
    // 死路防护（RISK-5）：空 outcome 且无 nextNodeId 时拒绝执行——
    // 否则 afterLines 会回落到本节点选项，玩家可重复选择、effects 被重复结算
    if (!c.nextNodeId && filterLines(c.outcome ?? []).length === 0) {
      console.warn(`[story] 选项 ${c.id}（${c.text}）既无 outcome 也无 nextNodeId，已拦截`)
      return
    }
    // 首次计分去重（r5）：C1 三错位／C2 两条路共用 onceKey，补看不重复加分
    const scored = !c.onceKey || !state.appliedOnce.includes(c.onceKey)
    if (c.onceKey && scored) state.appliedOnce.push(c.onceKey)
    if (scored) applyEffects(c.effects)
    applyFlags(c.setFlags)
    recordChoiceLabel(c.text)
    showLines(c.outcome ?? [], c.nextNodeId)
  }

  function choose(choiceId: string) {
    // 幂等防护：选项只在 choice 阶段生效——防止连点 / 选项离场动画期间误触
    // 导致 effects 重复结算、历史重复（纵深防御；UI 层另有 selectedId 锁 + ready 门控）
    if (phase.value !== 'choice') return
    const c = visibleChoices.value.find((x) => x.id === choiceId)
    if (!c) return
    performChoice(c)
  }

  function usePreset(presetId: string) {
    // 幂等防护：预设只在自由输入阶段有效（防连点重复结算）
    if (phase.value !== 'input') return
    const n = node.value
    if (!n) return
    // 触点（C2-X／C3-4）：预设走固定判定（不调 AI），播收束台词后按 preset.nextNodeId 或节点 nextNodeId 跳转
    if (n.stance) {
      const p = n.stance.presets.find((x) => x.id === presetId)
      if (!p) return
      freeInputDone.value = true
      state.tradition = addScore(state.tradition, p.tradition)
      state.innovation = addScore(state.innovation, p.innovation)
      const key = p.id.slice(-1) as 'A' | 'B' | 'C'
      recordStance(n.id, 'preset', p.text, p.tradition, p.innovation, undefined, key)
      recordChoiceLabel(p.text)
      showLines(p.close, p.nextNodeId ?? n.nextNodeId)
      return
    }
    const cfg = n.freeInput
    if (!cfg) return
    const p = cfg.presets.find((x) => x.id === presetId)
    if (!p) return
    freeInputDone.value = true
    applyEffects(p.effects)
    recordChoiceLabel(p.text)
    showLines(p.response, n.nextNodeId)
  }

  /** 触点①：跳过表态（仅 skippable 节点可用）——不记录、不加减值，播「未记录。跳过。」后继续 */
  function skipStance() {
    if (phase.value !== 'input') return
    const n = node.value
    if (!n?.stance?.skippable) return
    freeInputDone.value = true
    recordChoiceLabel('（跳过表态）')
    showLines(n.stance.skipClose ?? [], n.nextNodeId)
  }

  /** 自由输入 → AI：触点走双轴判定（只返回增量，不写剧情文本）；普通输入沿用回应式 mock */
  async function submitFreeInput(text: string) {
    // 幂等防护：仅在等待输入时接受提交（防连点重复请求 / 重复计入 freeInputs）
    if (phase.value !== 'input') return
    const n = node.value
    if (!n) return
    const cfg = n.freeInput
    const stance = n.stance
    if (!cfg && !stance) return
    const limit = stance ? stance.limit : cfg!.limit
    const trimmed = text.trim()
    if (!trimmed) return
    const clipped = trimmed.slice(0, limit)
    state.freeInputs.push(clipped)
    // 提交即记录（OPT-10）：成败都进回看，与 state.freeInputs 口径一致
    recordChoiceLabel(`（自由输入）${clipped}`)
    freeInputDone.value = true
    aiStatus.value = 'thinking'
    phase.value = 'ai'
    // 竞态防护（BUG-3）：记录提交时所在节点，返回时比对——
    // 期间若 jumpTo/重新开始导致节点变化，丢弃过期结果，不污染当前剧情
    const submitNodeId = nodeId.value
    persist()
    try {
      if (stance) {
        // 触点①：双轴判定（合法值域 ±1；失败/非法一律 0/0，见《开发文档》§3.7）
        const judge = await requestStanceJudgement(clipped, state)
        if (nodeId.value !== submitNodeId) return
        state.tradition = addScore(state.tradition, judge.tradition)
        state.innovation = addScore(state.innovation, judge.innovation)
        recordStance(n.id, 'free', clipped, judge.tradition, judge.innovation, judge.evidence)
        aiStatus.value = 'done'
        // 倾向用词（§3.7.1）：只有至少一轴为正时才报倾向；
        // 0/0（含双负）一律回固定句，绝不把"没听懂"说成"两条都要"。
        const dir =
          judge.tradition > 0 && judge.innovation > 0
            ? '两条都要'
            : judge.tradition > 0
              ? '先做扎实'
              : judge.innovation > 0
                ? '先被看见'
                : null
        showLines(
          dir
            ? [
                // 复述原话：引号由 DialogueBox／HistoryPanel 的呈现层统一加，数据层不带（否则显示「「…」」）
                { speaker: '阿鲟', text: clipped, type: 'dialogue' },
                { speaker: '阿鲟', text: `记录。倾向：${dir}。`, type: 'dialogue', aiGenerated: true },
                // 对方角色的收束台词（如 C3-4 九婆「你说的，我听着了。」）——与判定值无关
                ...(stance.freeClose ?? []),
              ]
            : [
                // 0/0：固定回退句（人工撰写，不标 AI）
                { speaker: '阿鲟', text: ASHUN_FALLBACK_LINES[0].text, type: 'dialogue' },
                ...(stance.freeClose ?? []),
              ],
          n.nextNodeId
        )
        return
      }
      const res = await requestAshunReply(clipped, state)
      if (nodeId.value !== submitNodeId) return
      aiStatus.value = 'done'
      showLines(res.lines, n.nextNodeId)
    } catch (err) {
      if (nodeId.value !== submitNodeId) return
      console.warn('[ai] 判定/回应失败', err)
      aiStatus.value = 'failed'
      if (stance) {
        // 触点判定失败：按 0/0 记录并继续，不阻断剧情（避免玩家卡死在输入界面）
        recordStance(n.id, 'free', clipped, 0, 0, '判定失败，按 0/0 记录')
        phase.value = 'lines'
        showLines(
          [
            { speaker: '阿鲟', text: ASHUN_FALLBACK_LINES[0].text, type: 'dialogue' },
            // 判定失败也要接对方收束——剧情不能卡在阿鲟的失败态上
            ...(stance.freeClose ?? []),
          ],
          n.nextNodeId
        )
        return
      }
      if (err instanceof AiTimeoutError) {
        // 界面显示「阿鲟正在整理思路……」+「使用备用判定」
      }
      persist()
    }
  }

  /** AI 失败 / 超时后落到备用文本 */
  function useFallbackReply() {
    // 幂等防护：仅在「AI 失败」态可用，防按钮重复点击重复播放备用段
    if (aiStatus.value !== 'failed') return
    const n = node.value
    if (!n) return
    aiStatus.value = 'done'
    showLines(ASHUN_FALLBACK_LINES, n.nextNodeId)
  }

  /** 结局页 AI 回顾（结局页在步骤 35–38 重做；保留能力，失败静默省略） */
  async function loadJourneySummary() {
    if (journeySummary.value.length || journeyLoading.value) return
    journeyLoading.value = true
    try {
      const res = await requestJourneySummary(state)
      journeySummary.value = res.lines
    } catch (err) {
      console.warn('[ai] 旅程回顾失败，按规格省略该段', err)
      journeySummary.value = []
    } finally {
      journeyLoading.value = false
    }
  }

  /* ---------------- 生命周期 ---------------- */
  function startFresh() {
    Object.assign(state, createInitialState())
    history.value = []
    journeySummary.value = []
    missingNodeId.value = null
    started.value = true
    enterNode(START_NODE_ID)
  }

  function restart() {
    localStorage.removeItem(SAVE_KEY)
    startFresh()
  }

  function goTitle() {
    started.value = false
    persist()
  }

  function startOrResume(resume: boolean) {
    if (resume && loadSave()) return true
    startFresh()
    return false
  }

  /* ---------------- 调试 ---------------- */
  function jumpTo(target: string) {
    started.value = true
    enterNode(target)
  }

  /* ---------------- 进度持久化 ---------------- */
  function persist() {
    if (!started.value) return
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          state,
          nodeId: nodeId.value,
          /** 断点屏（下一章未接入）要显示节点号；不存的话刷新后就成了"下一节点 （空）" */
          missingNodeId: missingNodeId.value,
          lineIndex: lineIndex.value,
          // 'ai' 为瞬时状态，恢复时交给玩家重新选择：显示「使用备用判定」
          phase: phase.value === 'ai' ? 'ai' : phase.value,
          history: history.value.slice(-120),
          freeInputDone: freeInputDone.value,
          aiStatus: aiStatus.value,
          journeySummary: journeySummary.value,
        })
      )
      saveExists.value = true
    } catch (e) {
      console.warn('[save] 写入失败', e)
    }
  }

  function loadSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as {
        state: GameState
        nodeId: string
        missingNodeId?: string | null
        lineIndex: number
        phase: Phase
        history: HistoryEntry[]
        freeInputDone: boolean
        aiStatus: AiStatus
        journeySummary: Line[]
      }
      if (!data?.nodeId || !getNode(data.nodeId)) return false
      Object.assign(state, createInitialState(), data.state)
      nodeId.value = data.nodeId
      missingNodeId.value = data.missingNodeId ?? null
      history.value = data.history ?? []
      freeInputDone.value = data.freeInputDone ?? false
      journeySummary.value = data.journeySummary ?? []
      started.value = true
      const n = getNode(data.nodeId)!
      // 旧存档没有 missingNodeId：从当前节点的下一步反推，断点屏才不会显示空节点号
      if (data.phase === 'break' && !missingNodeId.value) missingNodeId.value = n.nextNodeId ?? null
      lines.value = resolveNodeLines(n)
      // 在场人物同样要重建，否则刷新后立绘会空一屏。
      // 只按本节点重建的话，同场景换节点后刷新会"少人"（比如 C3-3 只剩九婆），
      // 所以再并上**同场景最近访问过**的那个节点的说话人，接近连续游玩时的状态。
      const speakersOf = (nd: StoryNode) =>
        nd.lines
          .filter((l) => (l.type === 'dialogue' || l.type === 'sms') && canStandOnStage(l.speaker))
          .map((l) => l.speaker as string)
      const prevSameScene = [...state.visitedNodes]
        .reverse()
        .map((id) => getNode(id))
        .find((x) => x && x.id !== n.id && x.scene === n.scene)
      cast.value = limitCast(
        n.cast
          ? n.cast
          : [...new Set([...(prevSameScene ? speakersOf(prevSameScene) : []), ...speakersOf(n)])],
        CAST_MAX,
        // 与 enterNode 同规则：本节点说话人先占位
        n.cast ? n.cast : speakersOf(n)
      )
      lineIndex.value = Math.min(data.lineIndex ?? 0, Math.max(0, lines.value.length - 1))
      if (data.phase === 'ai') {
        // 上次卡在 AI 生成中：回到行播放末态，由界面提供备用判定
        aiStatus.value = 'failed'
        phase.value = 'lines'
        lineIndex.value = Math.max(0, lines.value.length - 1)
      } else {
        phase.value = data.phase
        aiStatus.value = data.aiStatus ?? 'idle'
      }
      saveExists.value = true
      return true
    } catch (e) {
      console.warn('[save] 读取失败', e)
      return false
    }
  }

  function hasSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) {
        saveExists.value = false
        return false
      }
      const data = JSON.parse(raw) as { nodeId?: string }
      const ok = !!data?.nodeId && !!getNode(data.nodeId)
      saveExists.value = ok
      return ok
    } catch {
      saveExists.value = false
      return false
    }
  }

  return {
    // 状态
    state,
    started,
    nodeId,
    node,
    lines,
    lineIndex,
    phase,
    currentLine,
    visibleChoices,
    canAdvance,
    isTyping,
    progress,
    chapter,
    sectionTitle,
    sceneKey,
    cast,
    history,
    freeInputDone,
    aiStatus,
    missingNodeId,
    journeySummary,
    journeyLoading,
    saveExists,
    // 操作
    startOrResume,
    startFresh,
    restart,
    goTitle,
    advance,
    choose,
    usePreset,
    submitFreeInput,
    skipStance,
    useFallbackReply,
    jumpTo,
    skipMontage,
    hasSave,
    settleEnding,
  }
}

export type StoryEngine = ReturnType<typeof useStoryEngine>
