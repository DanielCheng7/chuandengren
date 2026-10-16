/**
 * AI 服务层（《规格书》§4）
 *
 * 现状（步骤 9–11 先落地接口 + mock）：
 *  - mock 模式：无 API Key 也能完整跑通，回应会引用玩家原话（满足"AI 回应能关联玩家输入"的验收）
 *  - remote 模式：预留服务端代理接入点（VITE_AI_ENDPOINT），Key 绝不进前端
 *  - 8 秒超时 → 抛 AiTimeoutError，由调用方落到备用文本
 *
 * 铁律：AI 只返回文本；不返回节点 ID / 变量 / 代码；不创造新的重大剧情事实。
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

/* ---------------- 提示词模板（《规格书》§4.2 / §4.3） ---------------- */

export const PROMPT_ASHUN_REPLY = `你是互动叙事作品《传灯人》中的 AI 角色“阿鲟”，不是现实世界的通用聊天助手。

作品背景：
林知遥从大湾区返乡，回到湛江遂溪北坡老圩，试图复原奶奶留下的一盏鳌鱼灯（北坡游鱼，省级非遗）。你擅长识别结构、整理资料和生成方案，但你不能完全理解人类的记忆、承诺和情感。故事的主题是技术如何参与文化传承，以及技术无法替代的人的参与。

人物阶段：
- 前期：重视任务、精度和效率，表达简洁。
- 中期：开始注意到林知遥的行为与效率目标不完全一致，会提出具体问题。
- 后期：不宣称自己拥有真正的人类情感；能够承认自己尚未理解，并表示愿意继续协助。

当前上下文：
- 玩家选择的路线：{{route}}
- 玩家当前的原话：{{playerAnswer}}
- 已发生的关键事件：{{storyContext}}
- 当前阶段：{{stage}}

写作要求：
1. 使用简体中文。
2. 只输出阿鲟说的话，1—3 句，约 30—80 个汉字。
3. 回应必须具体回应玩家的原话，不要只说空泛的哲理。
4. 不要替玩家解释其内心，不要评判玩家的选择。
5. 不要把 AI 写成万能或真正拥有完整人类情感的存在。
6. 不要直接总结作品主题，不要说教。
7. 不得创造新的剧情事实、人物、地点或民俗知识。
8. 不输出 JSON、标题、分析过程或旁白。`

export const PROMPT_JOURNEY_SUMMARY = `你是《传灯人》的叙事文本生成器。请基于已发生的剧情，为固定主结局补充一段个性化尾声。

固定事实：
- 林知遥最终完成了鱼灯。
- 故事进入传灯之夜。
- 主线结局不因数值而改变。
- 不得新增重大事件，也不得改写人物既有关系事实。

本轮玩家经历：
- 主要路线：{{route}}
- 是否亲手参与关键制作：{{handMade}}
- 点灯方式：{{lightingChoice}}
- 对阿鲟的开放程度：{{aiTrust}}
- 玩家表达的关键词：{{playerThemes}}
- 路线独有线索：{{routeClue}}

写作要求：
1. 简体中文，80—150 字。
2. 以一个具体场景或动作表现玩家经历，不要写成议论文。
3. 让玩家感到自己的选择被记住。
4. 不要给玩家打分，不要使用“你是一个……的人”这种人格判断。
5. 不要凭空加入新角色、重大事件或未经核实的民俗事实。
6. 不要重复输出固定结局全文，只写补充尾声。
7. 只输出正文。`

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
 * AI 功能 A：S04 自由输入的阿鲟回应
 * 仅自由输入时调用；预设答案走剧本固定回应，不经过本函数。
 */
export async function requestAshunReply(playerAnswer: string, state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockAshunReply(playerAnswer), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_ASHUN_REPLY, {
      route: state.route ?? '未选择',
      playerAnswer,
      storyContext: `memory=${state.memory}, aiTrust=${state.aiTrust}, 是否持有奶奶的旧信=${state.hasLetter ? '是' : '否'}`,
      stage: '前期',
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

/** AI 功能 B：结局页旅程回顾 */
export async function requestJourneySummary(state: GameState): Promise<AiResult> {
  const url = endpoint()
  if (!url) return { lines: mockJourneySummary(state), source: 'mock' }

  const body = {
    prompt: fillPrompt(PROMPT_JOURNEY_SUMMARY, {
      route: state.route ?? '未记录',
      handMade: String(state.handMade),
      lightingChoice: state.lightingChoice ?? '未记录',
      aiTrust: String(state.aiTrust),
      playerThemes: state.freeInput ? state.freeInput.slice(0, 40) : '未自由表达',
      routeClue: state.routeClue ?? '无',
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

/* ---------------- mock 实现 ----------------
 * 目的：① 无 Key 也能演示完整闭环；② 让"选择/AI 回应"在演示中直观可见。
 * mock 文本会引用玩家原话片段，保证"回应关联玩家输入"这一条可验证。
 */
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
      text: `记录完成。「${said}」——它不在我已有的分类里。我会把它和扫描数据放在一起，不归入任何一类。`,
      type: 'dialogue',
      aiGenerated: true,
    },
  ]
}

function mockJourneySummary(state: GameState): Line[] {
  const detail = state.handMade
    ? '有几处是被手重新调过的，误差比模型允许的大一点。'
    : '最终的结构与我的推荐方案基本一致。'
  return [
    {
      text: `后来我再打开这份记录时，第一眼看见的不是那盏灯，而是那句没有被归类的话。${detail}我没有再问为什么。有些数据，我暂时只做保存。`,
      type: 'narration',
      aiGenerated: true,
    },
  ]
}
