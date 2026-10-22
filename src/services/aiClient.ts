/**
 * AI 服务层（V3.0 过渡实现；《开发文档》§3、§6.5）
 *
 * ⚠️ 本轮（步骤 27–32）为「编译对齐的过渡实现」：
 *    - V3.0 的 AI 职责＝**只判定、不写剧情**（双轴判定模块，两处触点 C2-X／C3-4）——
 *      该模块按计划在**步骤 29** 重写（严格 JSON、temperature 0.2、8s 超时、
 *      幅度锁 -1~+1、非法一律 0/0、倾向报告模板 + AI 只填次数）；
 *    - 本文件当前保留的能力（回应式 mock / 结局回顾）只为保证工程可运行，
 *      第一幕（序章 ＋ 第一章）无任何 AI 触点调用；C2／C3 数据化时整体切换为新模块。
 *
 * 现状：
 *  - mock 模式：无 API Key 也能完整跑通；
 *  - remote 模式：前端只发同源 `/api/ai`（`vite.config.ts` 的 `cdr-ai-route` 转发上游，
 *    实现见 `server/ai-proxy.mjs`），**Key 只在服务端 `.env.local`，绝不进前端**；
 *  - 8 秒超时 → 抛 AiTimeoutError，由调用方落到备用文本（不改剧情、不清进度）。
 */
import type { GameState, Line } from '@/types/story'

const TIMEOUT_MS = 8000

export type AiSource = 'mock' | 'remote' | 'fallback'

export interface AiResult {
  lines: Line[]
  source: AiSource
}

export class AiTimeoutError extends Error {
  constructor() {
    super('AI 请求超时')
    this.name = 'AiTimeoutError'
  }
}

/* ---------------- 辅助 ---------------- */

/** 结局显示名（r4：结局由双轴派生，仅供提示词上下文与回顾使用） */
export function endingLabelOf(state: GameState): string {
  switch (state.ending) {
    case 'A':
      return '守旧链（留下来，把灯坊开起来）'
    case 'B':
      return '创新链（跟阿禾走，让鱼先游出去）'
    case 'C':
      return '合流链《灯海相连》（灯坊与工作室都开着）'
    default:
      return '尚未结算'
  }
}

/* ---------------- 提示词模板（过渡版；步骤 29 重写为判定模块） ---------------- */

/** 过渡版提示词：自由输入的一句话回应（C2-X／C3-4 接入后被判定模块取代） */
export const PROMPT_ASHUN_REPLY = `你是互动叙事作品《传灯人·游鱼》中的 AI 角色"阿鲟"，不是现实世界的通用聊天助手。

作品背景：
林知遥返乡回到湛江遂溪北坡老圩，围绕一盏没扎完的鳌鱼灯（北坡游鱼，省级非遗）做毕业设计。你擅长识别结构、整理资料和生成方案，但你不能完全理解人类的记忆、承诺和情感。全剧你没有一句观点——数据由你说，判断由人物说，选择由用户做。

当前上下文：
- 当前走向：{{route}}
- 玩家当前的原话：{{playerAnswer}}
- 状态记录：{{storyContext}}

写作要求：
1. 使用简体中文，1–2 句，约 20–50 个汉字。
2. 只陈述事实与记录行为，不评价、不建议、不抒情。
3. 不创造新的剧情事实、人物、地点或民俗知识。
4. 不输出 JSON、标题、分析过程或旁白。`

/** 过渡版提示词：结局页回顾（V3.0 §3 未含该触点；结局页重做时决定去留） */
export const PROMPT_JOURNEY_SUMMARY = `你是《传灯人·游鱼》的文本助手。请基于已发生的事件，为结局页补一段克制的回顾文字。

当前上下文：
- 当前走向：{{route}}
- 表态次数：{{stanceCount}}
- 玩家表达的关键词：{{playerThemes}}

写作要求：
1. 简体中文，80—150 字；以一个具体场景或动作表现玩家经历，不写成议论文。
2. 不给玩家打分，不做人格判断，不新增重大事件或未经核实的事实。
3. 只输出正文。`

/** 把模板中的 {{占位}} 替换为上下文 */
export function fillPrompt(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => ctx[k] ?? '')
}

/* ---------------- 调用入口 ---------------- */

/**
 * 代理可用性：`unknown` 未探过｜`ok` 通｜`missing` 不存在或未配置。
 * 探到 `missing` 后本次会话不再请求，直接走 mock —— 保证没有服务端时也能完整演示。
 */
let proxyState: 'unknown' | 'ok' | 'missing' = 'unknown'

function endpoint(): string | undefined {
  // ① 显式配置优先（前端直连别的代理服务时用）
  const explicit = import.meta.env.VITE_AI_ENDPOINT as string | undefined
  if (explicit) return explicit
  // ② 默认走同源 `/api/ai`：`vite.config.ts` 的 `cdr-ai-route` 把请求转给上游，
  //    **Key 只在服务端 `.env.local` 里**，前端与构建产物都不含密钥。
  // ③ 纯静态托管时该路由不存在 → 第一次探到就永久退回 mock，别再白试
  return proxyState === 'missing' ? undefined : '/api/ai'
}

/**
 * 带超时的请求执行器（BUG-4 修复）：
 * 超时通过 AbortController 真正中止底层 fetch，不再让请求在后台悬挂。
 * task 拿到 signal，应将其传给 fetch；超时 reject AiTimeoutError。
 */
function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController()
    const t = setTimeout(() => {
      controller.abort()
      reject(new AiTimeoutError())
    }, ms)
    task(controller.signal).then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/**
 * 统一的 POST 调用：非 2xx / 空文本均抛错，由调用方落到备用文本。
 * 失败时把代理带回来的 `{error, detail}` 拼进异常消息——控制台一眼能看出
 * 是 Key 格式错、模型名错还是欠费，不必翻服务端日志。
 */
async function postAiText(
  url: string,
  body: { prompt: string; json?: boolean },
  signal: AbortSignal
): Promise<string> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  // 404＝没有挂代理（纯静态托管）；503＝代理在但没配 Key/模型。
  // 两种都算「本次会话没有 AI」，退回 mock，别每个触点再试一次。
  if ((r.status === 404 || r.status === 503) && !import.meta.env.VITE_AI_ENDPOINT) {
    proxyState = 'missing'
    throw new Error(`AI 代理不可用（${r.status}）→ 改用本地 mock`)
  }
  if (!r.ok) {
    let detail = ''
    try {
      const j = (await r.json()) as { error?: string; detail?: string }
      detail = `${j.error ?? ''} ${j.detail ?? ''}`.trim()
    } catch {
      /* 上游不是 JSON，忽略 */
    }
    throw new Error(`AI 接口异常：${r.status}${detail ? ` — ${detail}` : ''}`)
  }
  proxyState = 'ok'
  const data = (await r.json()) as { text?: string }
  const out = (data.text ?? '').trim()
  if (!out) throw new Error('AI 返回为空')
  return out
}

/**
 * 过渡实现：自由输入的阿鲟回应。
 * ⚠️ 步骤 29 起由「双轴判定模块」取代（只返回严格 JSON {tradition, innovation, evidence}，
 * 不写剧情文本；本函数届时移除或改名）。
 */
export async function requestAshunReply(playerAnswer: string, state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockAshunReply(playerAnswer), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_ASHUN_REPLY, {
      route: endingLabelOf(state),
      playerAnswer,
      storyContext: `守旧值 ${state.tradition}／创新值 ${state.innovation}（0–6，互不联动），已表态 ${state.stances.length} 次`,
    }),
  }

  try {
    const text = await withTimeout((signal) => postAiText(url, body, signal))
    return { lines: [{ speaker: '阿鲟', text, type: 'dialogue', aiGenerated: true }], source: 'remote' }
  } catch (e) {
    // 没有服务端（静态托管）→ 退回 mock；上游真出错则照旧抛，让引擎走失败态
    if (proxyState === 'missing') return { lines: mockAshunReply(playerAnswer), source: 'mock' }
    throw e
  }
}

/** 过渡实现：结局页回顾（结局页在步骤 35–38 重做；失败静默省略，不影响固定结局） */
export async function requestJourneySummary(state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockJourneySummary(state), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_JOURNEY_SUMMARY, {
      route: endingLabelOf(state),
      stanceCount: String(state.stances.length),
      playerThemes: state.freeInputs.length
        ? state.freeInputs.join('；').slice(0, 60)
        : '未自由表达',
    }),
  }

  try {
    const text = await withTimeout((signal) => postAiText(url, body, signal))
    return { lines: [{ text, type: 'narration', aiGenerated: true }], source: 'remote' }
  } catch (e) {
    if (proxyState === 'missing') return { lines: mockJourneySummary(state), source: 'mock' }
    throw e
  }
}

/* ---------------- 触点双轴判定（C2-X 次触点 / C3-4 主触点） ---------------- */

/** 双轴判定结果：只给增量与依据，不写剧情文本（《开发文档》§3.7） */
export interface StanceJudgement {
  /** 守旧增量（-1 | 0 | 1） */
  tradition: number
  /** 创新增量（-1 | 0 | 1） */
  innovation: number
  evidence?: string
}

export const PROMPT_STANCE_JUDGE = `你是互动叙事作品《传灯人·游鱼》的判定模块。你只做一件事：判断玩家这句话，在"非遗传承该先做什么"上更倾向哪一侧。

当前上下文：
- 玩家原话：{{playerAnswer}}
- 状态记录：{{storyContext}}

判定规则：
1. 两轴独立判定，不此消彼长（可以同时为正、也可以都为 0）。
2. 只有倾向明确时才给 ±1；含糊、两头都说、跑题，一律给 0。
3. 不评价玩家、不给建议、不写剧情。

严格只输出一行 JSON，不要解释、不要 markdown 代码块：
{"tradition": -1|0|1, "innovation": -1|0|1, "evidence": "不超过 20 字的依据"}`

function clampJudge(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0
  return Math.max(-1, Math.min(1, v))
}

/** 严格 JSON 解析（容忍 ```json 包裹；非法一律 0/0） */
function parseJudge(text: string): StanceJudgement {
  const s = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  const m = /\{[\s\S]*\}/.exec(s)
  if (!m) return { tradition: 0, innovation: 0 }
  try {
    const o = JSON.parse(m[0]) as { tradition?: unknown; innovation?: unknown; evidence?: unknown }
    return {
      tradition: clampJudge(o.tradition),
      innovation: clampJudge(o.innovation),
      evidence: typeof o.evidence === 'string' ? o.evidence.slice(0, 40) : undefined,
    }
  } catch {
    return { tradition: 0, innovation: 0 }
  }
}

/** mock 判定：关键词粗判（无服务端代理时的过渡实现；倾向不明显一律 0/0，避免误判） */
function mockStanceJudge(answer: string): StanceJudgement {
  const keep = (answer.match(/扎|篾|手|骨|手艺|工序|学|练|打磨|扎实|基本功|沉|慢|细/g) ?? [])
    .length
  const innovate = (
    answer.match(/看见|传播|视频|拍|分享|市场|年轻|更多人|流量|曝光|推广|平台|屏幕/g) ?? []
  ).length
  const diff = keep - innovate
  if (diff >= 2) return { tradition: 1, innovation: 0, evidence: '提到手艺／工序与沉下心' }
  if (diff <= -2) return { tradition: 0, innovation: 1, evidence: '提到传播／被看见与平台' }
  if (keep >= 1 && innovate >= 1) return { tradition: 1, innovation: 1, evidence: '两条都提到' }
  return { tradition: 0, innovation: 0 }
}

/**
 * 触点判定入口：有服务端代理则请求严格 JSON，否则走关键词 mock；
 * 任何异常（超时／非 2xx／JSON 非法）一律回落 0/0，不阻断剧情。
 */
export async function requestStanceJudgement(
  answer: string,
  state: GameState
): Promise<StanceJudgement> {
  const url = endpoint()
  if (!url) return mockStanceJudge(answer)
  try {
    const text = await withTimeout((signal) =>
      postAiText(url, {
        prompt: fillPrompt(PROMPT_STANCE_JUDGE, {
          playerAnswer: answer,
          storyContext: `守旧值 ${state.tradition}／创新值 ${state.innovation}（0–6，互不联动）`,
        }),
        // 判定必须是严格 JSON：让代理带上 response_format: json_object
        json: true,
      }, signal)
    )
    return parseJudge(text)
  } catch (e) {
    // 代理根本没起来（静态托管）→ 用关键词粗判，演示才有区分度；
    // 代理在但上游失败（Key/模型/超时）→ 按规格一律 0/0，不猜。
    if (proxyState === 'missing') return mockStanceJudge(answer)
    // 上游真错也要留痕：否则现场看到"判定永远 0/0"却查不出是 Key 还是模型没开通
    console.warn('[ai] 触点判定失败，按 0/0 记录：', e)
    return { tradition: 0, innovation: 0 }
  }
}

/* ---------------- mock 实现（过渡版） ---------------- */

function quote(input: string, max = 10): string {
  const t = input.replace(/\s+/g, '')
  if (!t) return '（未输入）'
  return t.length > max ? `${t.slice(0, max)}……` : t
}

function mockAshunReply(playerAnswer: string): Line[] {
  const said = quote(playerAnswer)
  return [
    {
      speaker: '阿鲟',
      text: `记录完成。「${said}」我把它存进档案，暂时不做分类。`,
      type: 'dialogue',
      aiGenerated: true,
    },
  ]
}

function mockJourneySummary(state: GameState): Line[] {
  const detail = state.stances.length
    ? `你留下的 ${state.stances.length} 次表态，我都记着。`
    : '你没有多说，我也都记着。'
  return [
    {
      text: `后来我再打开这份记录时，最先跳出来的不是哪盏灯，而是那些没有被归类的句子。${detail}有些数据，我暂时只做保存。`,
      type: 'narration',
      aiGenerated: true,
    },
  ]
}
