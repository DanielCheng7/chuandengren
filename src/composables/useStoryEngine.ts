/**
 * 剧情引擎（V3.0，《开发文档》§6.3「剧情引擎要求」）
 *
 * 职责：节点读取 → 条件过滤 → 应用 effects（双轴 0–5 钳制）→ 跳转
 *       进度 localStorage（刷新可续）· 回看 · 重新开始 · 调试跳转
 *
 * V3.0 机制（步骤 28）：
 *  - visitedNodes：进入节点即记录，驱动「必看全／解锁另一条」；
 *  - 三错位排队（C1）：带 `setFlags.c1Spot` 的选项按 c1Order 去重——
 *    已看过的错位不再展示，剩余按玩家所选顺序续播；全部看完按 nextNodeId 汇合；
 *  - 两路体验（C2）：带 `setFlags.c2First` 的选项按目标节点访问记录去重（补看轮）；
 *  - 序章蒙太奇：`kind='montage'` 可跳过（skipMontage 沿链路走到第一个非蒙太奇节点）；
 *  - 审核透明层：stage/note 行由 `settings.showStageNotes` 控制演示／审核显示；
 *  - 触点（stance／report）与倾向报告屏待步骤 33／35 接入，本轮不涉及。
 *
 * 边界：AI 只做判定；节点跳转与变量计算全部由本文件控制。
 */
import { computed, reactive, ref } from 'vue'
import { START_NODE_ID, getNode, nodeProgress } from '@/data/story'
import { useSettings } from '@/composables/useSettings'
import { ASHUN_FALLBACK_LINES } from '@/data/fallbackDialogue'
import { AiTimeoutError, requestAshunReply, requestJourneySummary } from '@/services/aiClient'
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

export type Phase = 'lines' | 'choice' | 'input' | 'ai' | 'end' | 'break'
export type AiStatus = 'idle' | 'thinking' | 'done' | 'failed'

export interface HistoryEntry {
  nodeId: string
  speaker?: string
  text: string
  type: string
  aiGenerated?: boolean
}

/** 数值统一 0–5 封顶（下限 0，负增量按 0 截断） */
export function addScore(value: number, delta: number, max = 5): number {
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
    case 'route':
      return s.route === c.eq
    case 'visited':
      return s.visitedNodes.includes(c.has)
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
    route: null,
    c1Order: [],
    c2First: null,
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

  function recordLine() {
    const l = currentLine.value
    if (!l) return
    const last = history.value[history.value.length - 1]
    if (last && last.text === l.text && last.speaker === l.speaker) return
    history.value.push({
      nodeId: nodeId.value,
      speaker: l.speaker,
      text: l.text,
      type: l.type ?? 'narration',
      aiGenerated: l.aiGenerated,
    })
    // 会话内同步截断，与存档 slice(-120) 口径一致（OPT-9：防长会话内存无限增长）
    if (history.value.length > 300) history.value.splice(0, history.value.length - 300)
  }

  function recordChoiceLabel(text: string) {
    history.value.push({ nodeId: nodeId.value, speaker: '系统', text: `［选择］${text}`, type: 'choice' })
  }

  /** 双轴增量（0–5 钳制；两轴互不联动） */
  function applyEffects(effects?: ChoiceEffects) {
    if (effects?.tradition) state.tradition = addScore(state.tradition, effects.tradition)
    if (effects?.innovation) state.innovation = addScore(state.innovation, effects.innovation)
  }

  /** 结构标记：c1Spot → 维护 c1Order（观看顺序）；c2First → 仅首次写入；route → C4 写定 */
  function applyFlags(flags?: ChoiceFlags) {
    if (!flags) return
    if (flags.route) state.route = flags.route
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
  function enterNode(id: string) {
    const n = getNode(id)
    if (!n) {
      // 该章尚未接入（分章开发期间的正常状态）
      missingNodeId.value = id
      phase.value = 'break'
      persist()
      return
    }
    missingNodeId.value = null
    nodeId.value = id
    state.currentNodeId = id
    if (!state.visitedNodes.includes(id)) state.visitedNodes.push(id)
    freeInputDone.value = false
    aiStatus.value = 'idle'
    pendingNext.value = null
    lines.value = filterLines(n.lines)
    lineIndex.value = 0
    phase.value = 'lines'
    recordLine()
    if (lines.value.length === 0) afterLines()
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
    if (n.freeInput && !freeInputDone.value) {
      phase.value = 'input'
      persist()
      return
    }
    // 触点（stance）／报告（report）流程待步骤 33／35 接入：
    // 现阶段二者均按普通节点处理（有选项走选项、有下一节点走下一节点）。
    if (visibleChoices.value.length > 0) {
      phase.value = 'choice'
      persist()
      return
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

  /** 序章蒙太奇「可跳过不可快进」：沿链路走到第一个非蒙太奇节点（跳过不记 visited） */
  function skipMontage() {
    const start = nodeId.value
    let id = start
    for (let i = 0; i < 32; i++) {
      const n = getNode(id)
      if (!n || n.kind !== 'montage' || !n.nextNodeId) break
      id = n.nextNodeId
    }
    if (id !== start && getNode(id)) enterNode(id)
  }

  function choose(choiceId: string) {
    const c = visibleChoices.value.find((x) => x.id === choiceId)
    if (!c) return
    // 死路防护（RISK-5）：空 outcome 且无 nextNodeId 时拒绝执行——
    // 否则 afterLines 会回落到本节点选项，玩家可重复选择、effects 被重复结算
    if (!c.nextNodeId && filterLines(c.outcome ?? []).length === 0) {
      console.warn(`[story] 选项 ${c.id}（${c.text}）既无 outcome 也无 nextNodeId，已拦截`)
      return
    }
    applyEffects(c.effects)
    applyFlags(c.setFlags)
    recordChoiceLabel(c.text)
    showLines(c.outcome ?? [], c.nextNodeId)
  }

  function usePreset(presetId: string) {
    const cfg = node.value?.freeInput
    if (!cfg) return
    const p = cfg.presets.find((x) => x.id === presetId)
    if (!p) return
    freeInputDone.value = true
    applyEffects(p.effects)
    recordChoiceLabel(p.text)
    showLines(p.response, node.value?.nextNodeId)
  }

  /** 自由输入 → AI（判定层重写见步骤 29；现阶段沿用回应式 mock，保持可运行） */
  async function submitFreeInput(text: string) {
    const cfg = node.value?.freeInput
    if (!cfg) return
    const trimmed = text.trim()
    if (!trimmed) return
    const clipped = trimmed.slice(0, cfg.limit)
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
      const res = await requestAshunReply(clipped, state)
      if (nodeId.value !== submitNodeId) return
      aiStatus.value = 'done'
      showLines(res.lines, node.value?.nextNodeId)
    } catch (err) {
      if (nodeId.value !== submitNodeId) return
      console.warn('[ai] 回应失败', err)
      aiStatus.value = 'failed'
      if (err instanceof AiTimeoutError) {
        // 界面显示「阿鲟正在整理思路……」+「使用备用判定」
      }
      persist()
    }
  }

  /** AI 失败 / 超时后落到备用文本 */
  function useFallbackReply() {
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
      history.value = data.history ?? []
      freeInputDone.value = data.freeInputDone ?? false
      journeySummary.value = data.journeySummary ?? []
      started.value = true
      const n = getNode(data.nodeId)!
      lines.value = filterLines(n.lines)
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
    useFallbackReply,
    jumpTo,
    skipMontage,
    hasSave,
  }
}

export type StoryEngine = ReturnType<typeof useStoryEngine>
