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
 *  - remote 模式：预留服务端代理接入点（VITE_AI_ENDPOINT），Key 绝不进前端；
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

/** 路线显示名（双轴判定为数值；此处仅供提示词上下文与回顾使用） */
export function routeLabelOf(state: GameState): string {
  if (state.route === 'A') return '守旧链（留下来，把灯坊开起来）'
  if (state.route === 'B') return '创新链（跟阿禾走，让鱼先游出去）'
  return '未选择'
}

/* ---------------- 提示词模板（过渡版；步骤 29 重写为判定模块） ---------------- */

/** 过渡版提示词：自由输入的一句话回应（C2-X／C3-4 接入后被判定模块取代） */
export const PROMPT_ASHUN_REPLY = `你是互动叙事作品《传灯人·游鱼》中的 AI 角色"阿鲟"，不是现实世界的通用聊天助手。

作品背景：
林知遥返乡回到湛江遂溪北坡老圩，围绕一盏没扎完的鳌鱼灯（北坡游鱼，省级非遗）做毕业设计。你擅长识别结构、整理资料和生成方案，但你不能完全理解人类的记忆、承诺和情感。全剧你没有一句观点——数据由你说，判断由人物说，选择由用户做。

当前上下文：
- 玩家选择的道路：{{route}}
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
- 玩家选择的道路：{{route}}
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

function endpoint(): string | undefined {
  // 仅服务端代理地址可进前端；API Key 不得进入任何前端代码
  return import.meta.env.VITE_AI_ENDPOINT as string | undefined
}

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AiTimeoutError()), ms)
    p.then(
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
 * 过渡实现：自由输入的阿鲟回应。
 * ⚠️ 步骤 29 起由「双轴判定模块」取代（只返回严格 JSON {tradition, innovation, evidence}，
 * 不写剧情文本；本函数届时移除或改名）。
 */
export async function requestAshunReply(playerAnswer: string, state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockAshunReply(playerAnswer), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_ASHUN_REPLY, {
      route: routeLabelOf(state),
      playerAnswer,
      storyContext: `守旧值 ${state.tradition}／创新值 ${state.innovation}（0–5，互不联动），已表态 ${state.stances.length} 次`,
    }),
  }

  const text = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`AI 接口异常：${r.status}`)
      const data = (await r.json()) as { text?: string }
      const out = (data.text ?? '').trim()
      if (!out) throw new Error('AI 返回为空')
      return out
    })
  )

  return { lines: [{ speaker: '阿鲟', text, type: 'dialogue', aiGenerated: true }], source: 'remote' }
}

/** 过渡实现：结局页回顾（结局页在步骤 35–38 重做；失败静默省略，不影响固定结局） */
export async function requestJourneySummary(state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockJourneySummary(state), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_JOURNEY_SUMMARY, {
      route: routeLabelOf(state),
      stanceCount: String(state.stances.length),
      playerThemes: state.freeInputs.length
        ? state.freeInputs.join('；').slice(0, 60)
        : '未自由表达',
    }),
  }

  const text = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`AI 接口异常：${r.status}`)
      const data = (await r.json()) as { text?: string }
      const out = (data.text ?? '').trim()
      if (!out) throw new Error('AI 返回为空')
      return out
    })
  )

  return { lines: [{ text, type: 'narration', aiGenerated: true }], source: 'remote' }
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
