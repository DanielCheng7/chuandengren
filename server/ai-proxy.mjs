/**
 * AI 代理（服务端）：`POST /api/ai` → 上游大模型 `chat/completions`
 *
 * 为什么要这一层（《开发文档》§6.5 / §8.4）：
 *   **Key 不得进前端**。浏览器只能发到一个同源路径，默认 Key 只活在服务端进程的
 *   环境变量里（`app/.env.local`／`app/.env`，均已 .gitignore 排除）。
 *
 * 2026-10-23 起支持**每请求自定义配置**（设置页填的模型/Base URL/Key）：
 *   入参可带 `auth: { apiKey, baseUrl, model }`——缺项用环境变量补，三项都缺即走默认。
 *   这样团队各用各的 Key 测，仓库里一个密钥都不用留（项目要公开）。
 *   ⚠️ 代理**永远不回显、不打日志**客户端传来的 Key（环境变量那条启动日志只打前 8 位）。
 *
 * 协议：按 **OpenAI 兼容** 写死——火山方舟／DeepSeek／通义／智谱／各种中转网关
 * 都是这套 `POST {base}/chat/completions` + `Authorization: Bearer <key>`
 * + `choices[0].message.content`。换服务商只改设置页或 `.env.local` 三行，不动代码。
 *
 * 入参（前端 → 本代理）：`{ prompt: string, json?: boolean, auth?: object }`
 *   `json: true` 时附带 `response_format: { type: 'json_object' }`（触点判定要严格 JSON）
 * 出参：`{ text: string }`，失败：非 2xx + `{ error, detail }`
 *
 * 该函数同时被两处使用：
 *   ① `vite.config.ts` 的 `cdr-ai-route` 插件（dev 与 preview 都挂上）；
 *   ② 单独 `node server/ai-proxy.mjs` 起一个裸 Node 服务（纯静态部署时用）。
 */

const DEFAULT_BASE = 'https://ark.cn-beijing.volces.com/api/v3'

/** 从环境变量取配置；缺 Key 或缺模型即视为「未接入」，返回 503 而不是瞎发请求 */
export function readAiConfig(env = process.env) {
  return {
    apiKey: (env.AI_API_KEY || '').trim(),
    baseUrl: (env.AI_BASE_URL || DEFAULT_BASE).trim().replace(/\/+$/, ''),
    model: (env.AI_MODEL || '').trim(),
    // 默认 7s：比前端 8s 判定超时早一点，让「上游超时」以 504 干净地回到前端，
    // 而不是浏览器直接 abort（那样控制台只剩一句 AbortError）
    timeoutMs: Number(env.AI_TIMEOUT_MS || 7000),
    /**
     * 思考模式：`disabled`（默认）／`auto`／`enabled`／`default`（= 不传该参数）。
     *
     * 为什么要能关：DeepSeek-V4.1、doubao-seed 这类**思考模型**会先吐一大段
     * `reasoning_content`，`content` 在 token 用尽时是空的——判定任务只等 8s，
     * 又不能容忍空文本。实测 `thinking:{type:'disabled'}` 让 V4.1-Flash 经济版
     * 1.3s 直出严格 JSON（0 reasoning tokens）。
     *
     * 若换到不认这个参数的网关（个别中转会严格校验），设为 `default` 即完全不传。
     */
    thinking: (env.AI_THINKING || 'disabled').trim(),
  }
}

/**
 * 解析前端带来的自定义配置（「设置 → AI 模型」里填的）。
 *
 * 返回 `{ error }` 非空 → 这份配置不合用，直接 400（别拿去发请求）；
 * 返回 `patch: null` → 没带或三项全空，按环境变量走。
 * **这里只做形状校验，不校验 Key 真假**——Key 对不对由上游说了算（原文会带回前端）。
 */
function readClientAuth(payload) {
  const a = payload && typeof payload === 'object' ? payload.auth : null
  if (!a || typeof a !== 'object') return { error: '', patch: null }
  const apiKey = typeof a.apiKey === 'string' ? a.apiKey.trim() : ''
  const model = typeof a.model === 'string' ? a.model.trim() : ''
  const baseUrl = typeof a.baseUrl === 'string'
    ? a.baseUrl.trim().replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '')
    : ''
  if (!apiKey && !model && !baseUrl) return { error: '', patch: null }
  if (baseUrl) {
    if (!/^https?:\/\//i.test(baseUrl)) {
      return { error: 'API Base URL 必须以 http:// 或 https:// 开头', patch: null }
    }
    if (baseUrl.length > 300) return { error: 'API Base URL 过长', patch: null }
  }
  if (apiKey.length > 400) return { error: 'API Key 过长', patch: null }
  return { error: '', patch: { apiKey, model, baseUrl } }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * 处理一次 AI 请求。`cfg` 省略时读 process.env。
 * 不抛异常——所有失败都落到 HTTP 状态码 + JSON，前端据此回退（绝不断剧情）。
 */
export async function handleAiRequest(req, res, cfg = readAiConfig()) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: '只接受 POST' })
    return
  }

  let payload
  try {
    payload = JSON.parse((await readBody(req)) || '{}')
  } catch {
    sendJson(res, 400, { error: '请求体不是合法 JSON' })
    return
  }

  const prompt = String(payload.prompt || '').trim()
  if (!prompt) {
    sendJson(res, 400, { error: 'prompt 为空' })
    return
  }

  // 每请求自定义配置：客户端给了哪一项就盖哪一项，没给的仍用服务端默认
  const { error: authError, patch } = readClientAuth(payload)
  if (authError) {
    sendJson(res, 400, { error: '自定义 AI 配置无效', detail: authError })
    return
  }
  const eff = patch
    ? {
        ...cfg,
        apiKey: patch.apiKey || cfg.apiKey,
        model: patch.model || cfg.model,
        baseUrl: patch.baseUrl || cfg.baseUrl,
      }
    : cfg

  if (!eff.apiKey || !eff.model) {
    // 前端看到这条会退回 mock / 0-0，不会白屏
    sendJson(res, 503, {
      error: 'AI 未配置',
      detail: patch
        ? '自定义配置缺少 API Key 或模型名：到「设置 → AI 模型」补齐'
        : '缺少 API Key 或模型名：到「设置 → AI 模型」填自己的 Key，或在服务端 app/.env.local 配置（见 .env.example）',
    })
    return
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), eff.timeoutMs)
  try {
    /**
     * 发一次上游。`extras=false` 时**只发最小公共字段**（model/messages/temperature/max_tokens）。
     *
     * 为什么要分两档：`thinking` 是方舟/豆包系的扩展参数，`response_format` 也不是每家都收。
     * 团队各用各的模型时，遇到严格校验的网关就会直接 400「unknown field」。
     * 所以第一次按最优参数发，被拒就退回最小集重试一次——见下面的重试条件。
     */
    const attempt = async (extras) => {
      const r = await fetch(`${eff.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${eff.apiKey}`,
        },
        body: JSON.stringify({
          model: eff.model,
          messages: [{ role: 'user', content: prompt }],
          // 判定要稳，不要发挥：温度压低、长度给足（含 JSON 花括号也够）
          temperature: 0.2,
          max_tokens: 512,
          ...(extras && payload.json ? { response_format: { type: 'json_object' } } : {}),
          // 思考模型默认关掉（见 readAiConfig）；`default` 表示完全不带这个参数
          ...(extras && eff.thinking && eff.thinking !== 'default'
            ? { thinking: { type: eff.thinking } }
            : {}),
        }),
        signal: ac.signal,
      })
      return { r, raw: await r.text() }
    }

    let { r, raw } = await attempt(true)

    // 4xx 且报错提到这些扩展字段 → 判定为"网关不认"，剥掉扩展字段重试一次。
    // 不发情绪：只在 console 记一行，不打扰玩家。
    const rejectedExtras =
      !r.ok &&
      r.status >= 400 &&
      r.status < 500 &&
      /thinking|response_format|json_object|unsupported|unrecognized|unknown|invalid|extra/i.test(raw)
    if (rejectedExtras) {
      console.info('[ai] 上游疑似不认 thinking / response_format，已去掉扩展字段重试一次')
      ;({ r, raw } = await attempt(false))
    }

    if (!r.ok) {
      // 把上游原文带回去：Key 错／模型名错／欠费，前台 console 一眼能看出来
      sendJson(res, 502, {
        error: `上游 ${r.status}`,
        detail: raw.slice(0, 600),
      })
      return
    }

    let text = ''
    let reasoning = ''
    try {
      const data = JSON.parse(raw)
      text = (data?.choices?.[0]?.message?.content ?? '').trim()
      reasoning = (data?.choices?.[0]?.message?.reasoning_content ?? '').trim()
    } catch {
      sendJson(res, 502, { error: '上游返回不是 JSON', detail: raw.slice(0, 600) })
      return
    }
    if (!text) {
      // 思考模型的典型坑：token 全花在 reasoning 上，content 才是空的
      sendJson(res, 502, {
        error: reasoning ? '上游只返回了思考内容，没有正文' : '上游返回空文本',
        detail: reasoning
          ? `模型在思考态用满了 max_tokens（${eff.model}）。设 AI_THINKING=disabled，或调大 max_tokens。`
          : raw.slice(0, 600),
      })
      return
    }
    sendJson(res, 200, { text })
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    sendJson(res, aborted ? 504 : 502, {
      error: aborted ? '上游超时' : '请求上游失败',
      detail: String(e?.message || e).slice(0, 300),
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 单独跑：`node server/ai-proxy.mjs`（默认 8787 端口） */
if (process.argv[1] && process.argv[1].endsWith('ai-proxy.mjs')) {
  const { createServer } = await import('node:http')
  const port = Number(process.env.AI_PROXY_PORT || 8787)
  const cfg = readAiConfig()
  createServer((req, res) => {
    if ((req.url || '').split('?')[0] === '/api/ai') {
      handleAiRequest(req, res, cfg)
      return
    }
    res.statusCode = 404
    res.end('not found')
  }).listen(port, () => {
    console.log(`[ai-proxy] http://127.0.0.1:${port}/api/ai`)
    console.log(`[ai-proxy] 模型 ${cfg.model || '(未配置)'} ｜ 上游 ${cfg.baseUrl}`)
    console.log(`[ai-proxy] Key ${cfg.apiKey ? '已配置' : '缺失'}`)
  })
}
