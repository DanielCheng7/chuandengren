/**
 * 剧情引擎（《规格书》§7「剧情引擎要求」）
 *
 * 职责：节点读取 → 条件过滤 → 应用 effects（0–5 钳制）→ 跳转
 *       进度 localStorage（刷新可续）· 回看 · 重新开始 · 调试跳转
 * 边界：AI 只提供文本；节点跳转与变量计算全部由本文件控制。
 */
import { computed, reactive, ref } from 'vue'
import { ACTS, START_NODE_ID, getNode, nodeProgress } from '@/data/story'
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

const SAVE_KEY = 'chuandengren.save.v3'

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
    case 'hasLetter':
      return s.hasLetter === c.is
    case 'handMade':
      return s.handMade === c.is
    case 'memory':
      if (c.gte !== undefined && s.memory < c.gte) return false
      if (c.lte !== undefined && s.memory > c.lte) return false
      return true
    case 'aiTrust':
      if (c.gte !== undefined && s.aiTrust < c.gte) return false
      if (c.lte !== undefined && s.aiTrust > c.lte) return false
      return true
    case 'route':
      return s.route === c.eq
    case 'lightingChoice':
      return s.lightingChoice === c.eq
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
    route: null,
    memory: 0,
    aiTrust: 0,
    handMade: false,
    hasLetter: false,
    lightingChoice: null,
    freeInput: undefined,
    routeClue: undefined,
  }
}

export function useStoryEngine() {
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

  /* ---------------- 派生状态 ---------------- */
  const node = computed<StoryNode | undefined>(() => getNode(nodeId.value))
  const currentLine = computed<Line | null>(() => lines.value[lineIndex.value] ?? null)
  const visibleChoices = computed<Choice[]>(() =>
    (node.value?.choices ?? []).filter((c) => matchAll(state, c.showIf))
  )
  const canAdvance = computed(() => phase.value === 'lines')
  const isTyping = computed(() => phase.value === 'ai' && aiStatus.value === 'thinking')
  const progress = computed(() => nodeProgress(nodeId.value))
  const chapter = computed(() => node.value?.chapter ?? '')
  const sectionTitle = computed(() => node.value?.sectionTitle ?? '')
  const sceneKey = computed(() => node.value?.scene ?? 'lantern_workshop')

  /* ---------------- 内部工具 ---------------- */
  function filterLines(list: Line[]): Line[] {
    return list.filter((l) => matchAll(state, l.when))
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
  }

  function recordChoiceLabel(text: string) {
    history.value.push({ nodeId: nodeId.value, speaker: '系统', text: `［选择］${text}`, type: 'choice' })
  }

  function applyEffects(effects?: ChoiceEffects, flags?: ChoiceFlags) {
    if (effects?.memory) state.memory = addScore(state.memory, effects.memory)
    if (effects?.aiTrust) state.aiTrust = addScore(state.aiTrust, effects.aiTrust)
    if (flags) {
      if (flags.handMade !== undefined) state.handMade = flags.handMade
      if (flags.hasLetter !== undefined) state.hasLetter = flags.hasLetter
      if (flags.route !== undefined) state.route = flags.route
      if (flags.lightingChoice !== undefined) state.lightingChoice = flags.lightingChoice
      if (flags.routeClue !== undefined) state.routeClue = flags.routeClue
    }
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
      // 该幕尚未接入（分幕开发期间的正常状态）
      missingNodeId.value = id
      phase.value = 'break'
      persist()
      return
    }
    missingNodeId.value = null
    nodeId.value = id
    state.currentNodeId = id
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
    if (n.kind === 'freeInput' && !freeInputDone.value) {
      phase.value = 'input'
      persist()
      return
    }
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

  function choose(choiceId: string) {
    const c = visibleChoices.value.find((x) => x.id === choiceId)
    if (!c) return
    applyEffects(c.effects, c.setFlags)
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

  /** S04 自由输入 → AI 功能 A（mock / remote） */
  async function submitFreeInput(text: string) {
    const cfg = node.value?.freeInput
    if (!cfg) return
    const trimmed = text.trim()
    if (!trimmed) return
    state.freeInput = trimmed.slice(0, cfg.limit)
    freeInputDone.value = true
    aiStatus.value = 'thinking'
    phase.value = 'ai'
    persist()
    try {
      const res = await requestAshunReply(state.freeInput, state)
      recordChoiceLabel(`（自由输入）${state.freeInput}`)
      aiStatus.value = 'done'
      showLines(res.lines, node.value?.nextNodeId)
    } catch (err) {
      console.warn('[ai] 回应失败', err)
      aiStatus.value = 'failed'
      if (err instanceof AiTimeoutError) {
        // 界面显示"阿鲟正在整理思路……" + "使用备用回应"
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

  /** 结局页 AI 功能 B：旅程回顾（失败时静默省略，不影响固定结局） */
  async function loadJourneySummary() {
    if (journeySummary.value.length || journeyLoading.value) return
    journeyLoading.value = true
    try {
      const res = await requestJourneySummary(state)
      journeySummary.value = res.lines
    } catch (err) {
      console.warn('[ai] 旅程回顾失败，按规格书 §4.4 省略该段', err)
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

  /* ---------------- 调试（步骤 8） ---------------- */
  function jumpTo(target: string) {
    started.value = true
    enterNode(target)
  }
  function jumpToAct(act: 1 | 2 | 3) {
    const entry = ACTS.find((a) => a.act === act)?.entry
    if (entry) jumpTo(entry)
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
          // 'ai' 为瞬时状态，恢复时交给玩家重新选择：显示"使用备用回应"
          phase: phase.value === 'ai' ? 'ai' : phase.value,
          history: history.value.slice(-120),
          freeInputDone: freeInputDone.value,
          aiStatus: aiStatus.value,
          journeySummary: journeySummary.value,
        })
      )
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
        // 上次卡在 AI 生成中：回到行播放末态，由界面提供备用回应
        aiStatus.value = 'failed'
        phase.value = 'lines'
        lineIndex.value = Math.max(0, lines.value.length - 1)
      } else {
        phase.value = data.phase
        aiStatus.value = data.aiStatus ?? 'idle'
      }
      return true
    } catch (e) {
      console.warn('[save] 读取失败', e)
      return false
    }
  }

  function hasSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as { nodeId?: string }
      return !!data?.nodeId && !!getNode(data.nodeId)
    } catch {
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
    jumpToAct,
    hasSave,
  }
}

export type StoryEngine = ReturnType<typeof useStoryEngine>
