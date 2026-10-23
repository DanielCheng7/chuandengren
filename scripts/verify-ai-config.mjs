#!/usr/bin/env node
/**
 * 「设置 → AI 模型」自定义大模型配置 走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-ai-config.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:5173/（dev）。**先起 dev**：`npm run dev`。
 *
 * 做法：脚本自己起一个**假的 OpenAI 兼容上游**（`/v1/chat/completions`），
 * 让设置页把 Base URL 指过去，然后看它到底收到了什么——
 * 这样能同时验证「前端有没有带 Key / 模型」「代理有没有按请求覆盖」。
 * 全程不碰真实服务商，也不打印任何真实 Key。
 *
 * 验证点：
 *   ① 设置页出现「AI 模型」分节：当前使用状态 + 模型名 / Base URL / Key 三栏；
 *   ② 「测试连接」打到自定义上游：Bearer 是自定义 Key、model 是自定义模型、尾斜杠被归一；
 *   ③ 「保存并启用」写入 localStorage（key 只在本机），列表出现一项且为启用态；
 *   ④ 刷新整页后配置仍在（不依赖内存）；
 *   ⑤ 触点判定走自定义配置：上游收到 `response_format: json_object` + 自定义 Key；
 *   ⑥ 「用服务端默认」后请求里不再带自定义 auth（交给服务端配置）。
 *   ⑦ 严格网关（直接 400「unknown field: thinking」）时，代理剥掉扩展字段重试一次仍成功；
 *      顺手验证「误粘完整 /chat/completions」不会拼成双路径。
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/'
const OUT = resolve(process.argv[3] || '.verify-ai-config')
const PORT = 9419
const STUB_PORT = 9530
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) {
  console.error('未找到 Edge 可执行文件')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------- 假上游：记下每次请求 ---------------- */
const hits = []
/** 模拟"严格网关"：不认方舟系的 thinking / response_format 扩展字段，直接 400 */
let strict = false
const stub = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let json = {}
    try {
      json = JSON.parse(body)
    } catch {}
    hits.push({
      path: (req.url || '').split('?')[0],
      auth: req.headers.authorization || '',
      model: json.model || '',
      jsonMode: !!json.response_format,
      thinking: !!json.thinking,
      at: Date.now(),
    })
    if (strict && (json.thinking || json.response_format)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'unknown field: thinking' } }))
      return
    }
    const content = json.response_format
      ? '{"tradition": 1, "innovation": 0, "evidence": "stub 判定"}'
      : '可用'
    const payload = JSON.stringify({
      choices: [{ message: { content, reasoning_content: '' } }],
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(payload)
  })
})
await new Promise((r) => stub.listen(STUB_PORT, '127.0.0.1', r))

/* ---------------- Edge + CDP（同 verify-*.mjs 的写法） ---------------- */
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `wb-aicfg-${Date.now()}`)}`,
    '--window-size=1600,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = l.find((t) => t.type === 'page')
      if (p) return p.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('no cdp')
}

let id = 0
const pend = new Map()
const ws = new WebSocket(await getWs())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) {
    const { res, rej } = pend.get(m.id)
    pend.delete(m.id)
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id
    pend.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const ev = async (x) => {
  const r = await send('Runtime.evaluate', {
    expression: x,
    returnByValue: true,
    awaitPromise: true,
  })
  return r.exceptionDetails ? null : r.result.value
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'))
}

await send('Runtime.enable')
await send('Page.enable')
try {
  await send('Page.setDownloadBehavior', { behavior: 'deny' })
} catch {}

let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) {
    pass++
    console.log(`PASS  ${name}  — ${detail}`)
  } else {
    fail++
    console.log(`FAIL  ${name}  — ${detail}`)
  }
}

/** 在设置页里按「标签文字」填一个输入框（v-model 靠 input 事件） */
const fillField = (name, value) => `(() => {
  const label = [...document.querySelectorAll('.ai-form .field')]
    .find(f => f.querySelector('.field-name')?.textContent.includes(${JSON.stringify(name)}));
  const el = label?.querySelector('input');
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`

const clickByText = (sel, text) => `(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})]
    .find(x => x.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(text)}));
  if (!el) return false;
  el.click();
  return true;
})()`

/** 设置面板里的「AI 模型」表单默认收起（配过才收起）——没有就点开 */
const openAiForm = `(() => {
  if (document.querySelector('.ai-form')) return true;
  const b = [...document.querySelectorAll('.mini')].find(x => /填写|修改/.test(x.textContent));
  if (b) { b.click(); return true; }
  return false;
})()`

const STORE = `JSON.parse(localStorage.getItem('chuandengren.ai.v1') || 'null')`

/* ---------- 打开应用 + 设置面板 ---------- */
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})
await send('Page.navigate', { url: URL_ })
await sleep(1200)
await ev(`localStorage.clear()`)
await send('Page.navigate', { url: `${URL_}?v=${Date.now()}` })
for (let i = 0; i < 50; i++) {
  if (await ev(`!!document.querySelector('.menu-item')`)) break
  await sleep(300)
}
await ev(clickByText('.menu-item', '设置'))
for (let i = 0; i < 30; i++) {
  if (await ev(`!!document.querySelector('.ai-form')`)) break
  await sleep(200)
}
await ev(openAiForm)

/* ---------- ① 表单存在 ---------- */
const fields = await ev(`(() => {
  const names = [...document.querySelectorAll('.ai-form .field-name')].map(x => x.textContent.trim());
  const inputs = document.querySelectorAll('.ai-form input').length;
  return { names, inputs, hasChip: !!document.querySelector('.ai-chip'),
           chip: document.querySelector('.ai-chip')?.textContent.trim() || '' };
})()`)
check(
  '① 设置页有「AI 模型」分节：模型名 / Base URL / Key 三栏 + 当前使用状态',
  !!fields && fields.inputs >= 3 && fields.hasChip && fields.names.join('|').includes('模型名称'),
  fields ? `字段=${fields.names.join('、')}（${fields.inputs} 个输入框）当前=${fields.chip}` : '未找到 .ai-form'
)
await shot('01-settings')

/* ---------- ② 测试连接打到自定义上游 ---------- */
const TEST_KEY = 'sk-local-test-1234567890'
await ev(fillField('模型名称', 'stub-model-x'))
// 故意带结尾斜杠：代理要把它归一成 .../v1 再拼 /chat/completions
await ev(fillField('Base URL', `http://127.0.0.1:${STUB_PORT}/v1/`))
await ev(fillField('API Key', TEST_KEY))
const before = hits.length
await ev(clickByText('.ai-actions .pill', '测试连接'))
for (let i = 0; i < 60; i++) {
  if (hits.length > before) break
  await sleep(250)
}
const h1 = hits[hits.length - 1]
check(
  '② 「测试连接」打到自定义上游：Bearer / model / 路径都对，尾斜杠已归一',
  hits.length > before &&
    h1.auth === `Bearer ${TEST_KEY}` &&
    h1.model === 'stub-model-x' &&
    h1.path === '/v1/chat/completions',
  hits.length > before
    ? `${h1.path} ｜ Bearer ${h1.auth.replace('Bearer ', '').slice(0, 6)}… ｜ model=${h1.model}`
    : `上游没收到请求（hits=${hits.length}）`
)
const okMsg = await ev(`document.querySelector('.ai-msg')?.textContent.trim() || ''`)
check('②-2 结果回显在面板里（成功文案）', /连接成功/.test(okMsg), okMsg || '（无提示）')

/* ---------- ③ 保存并启用 ---------- */
await ev(clickByText('.ai-actions .pill', '保存并启用'))
await sleep(400)
const store = await ev(STORE)
const saved = store?.profiles?.[0]
const activeId = store?.activeId
check(
  '③ 「保存并启用」写入 localStorage，并成为当前启用项',
  !!saved &&
    saved.apiKey === TEST_KEY &&
    saved.model === 'stub-model-x' &&
    saved.baseUrl === `http://127.0.0.1:${STUB_PORT}/v1` &&
    !!activeId &&
    activeId === saved.id,
  saved ? `配置 ${store.profiles.length} 条，启用 ${saved.label}（key 尾 4 位 …${saved.apiKey.slice(-4)}）` : '未写入'
)
const listed = await ev(
  `[...document.querySelectorAll('.ai-item.is-on .ai-name')].map(x=>x.textContent.trim())`
)
check('③-2 列表里出现该配置且为选中态', Array.isArray(listed) && listed.length === 1, `选中=${listed}`)
await shot('02-saved')

/* ---------- ④ 刷新后仍在 ---------- */
await send('Page.reload')
await sleep(1500)
await ev(clickByText('.menu-item', '设置'))
for (let i = 0; i < 30; i++) {
  if (await ev(`!!document.querySelector('.ai-form')`)) break
  await sleep(200)
}
await ev(openAiForm)
const afterReload = await ev(`(() => ({
  chip: document.querySelector('.ai-chip')?.textContent.trim() || '',
  model: [...document.querySelectorAll('.ai-form input')][0]?.value || '',
  key: [...document.querySelectorAll('.ai-form input')][2]?.value || '',
}))()`)
check(
  '④ 整页刷新后配置仍在（localStorage 持久化，不靠内存）',
  afterReload?.chip === 'stub-model-x' &&
    afterReload?.model === 'stub-model-x' &&
    afterReload?.key === TEST_KEY,
  `芯片=${afterReload?.chip} 模型=${afterReload?.model} Key 已回填=${afterReload?.key === TEST_KEY}`
)
await ev(clickByText('.pill', '返回'))
await sleep(400)

/* ---------- ⑤ 触点判定走自定义配置 ---------- */
await ev(`(() => {
  const k = 'chuandengren.save.v4';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.nodeId = 'C2-X2'; s.phase = 'input'; s.lineIndex = 0; s.missingNodeId = null;
  s.state = s.state || {}; s.state.ending = 'A';
  localStorage.setItem(k, JSON.stringify(s));
})()`)
await send('Page.reload')
await sleep(1400)
await ev(clickByText('.menu-item', '继续上次'))
for (let i = 0; i < 40; i++) {
  if (await ev(`!!document.querySelector('.free-input')`)) break
  await sleep(250)
}
const before2 = hits.length
await ev(`(() => {
  const ta = document.querySelector('.free-input textarea');
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  set.call(ta, '先把扎骨架的手艺练扎实，急不得');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
await sleep(200)
await ev(`document.querySelector('.free-input .btn.submit')?.click()`)
for (let i = 0; i < 60; i++) {
  if (hits.length > before2) break
  await sleep(250)
}
const h2 = hits[hits.length - 1]
check(
  '⑤ 触点判定请求带上了自定义配置（Bearer + model + json_object）',
  hits.length > before2 &&
    h2.auth === `Bearer ${TEST_KEY}` &&
    h2.model === 'stub-model-x' &&
    h2.jsonMode === true,
  hits.length > before2
    ? `Bearer …${h2.auth.slice(-4)} ｜ model=${h2.model} ｜ json_object=${h2.jsonMode}`
    : '上游没收到判定请求'
)
// stub 固定回 1/0：等它落到「倾向报告」或状态里，证明链路真的产出了判定
// 判定要等引擎把结果写进存档（上游回包 → 解析 → 落盘），轮询最多 10s
let judged = null
for (let i = 0; i < 40; i++) {
  judged = await ev(`(() => {
    const s = JSON.parse(localStorage.getItem('chuandengren.save.v4') || '{}');
    return { t: s.state?.tradition ?? null, i: s.state?.innovation ?? null,
             stances: (s.state?.stances || []).length };
  })()`)
  if (judged && judged.t === 1) break
  await sleep(250)
}
check(
  '⑤-2 判定结果落进存档（stub 回 1/0 → tradition=1）',
  judged && judged.t === 1 && judged.i === 0,
  `tradition=${judged?.t} innovation=${judged?.i} 表态数=${judged?.stances}`
)
await shot('03-stance')

/* ---------- ⑥ 切回服务端默认 ---------- */
await ev(clickByText('.tool', '设置'))
for (let i = 0; i < 30; i++) {
  if (await ev(`!!document.querySelector('.ai-form')`)) break
  await sleep(200)
}
await ev(openAiForm)
await ev(clickByText('.mini', '用服务端默认'))
await sleep(300)
const storeAfter = await ev(STORE)
check(
  '⑥ 「用服务端默认」清掉启用项，但保留已存的配置',
  storeAfter && storeAfter.activeId === null && storeAfter.profiles.length === 1,
  `activeId=${storeAfter?.activeId} 配置数=${storeAfter?.profiles?.length}`
)
await shot('04-default')
await ev(clickByText('.pill', '返回'))
await sleep(300)

/* ---------- ⑥-2 切回默认后，请求里不该再有 auth ---------- */
// 这里**不能真打上游**（默认 Base URL 是方舟，会花真实额度），也不该指望 stub 收到请求。
// 改成在页面里给 fetch 打桩：记下发往 /api/ai 的请求体，直接回一个假的 200。
// 用 addScriptToEvaluateOnNewDocument 注入，刷新后依然生效。
const PATCH_FETCH = `(() => {
  window.__aiBodies = [];
  const orig = window.fetch;
  window.fetch = function (input, init) {
    // 后面「严格网关」那项要真打 stub，用这个开关把桩让开，不必重新加载
    if (window.__aiStubOff) return orig.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/ai') >= 0 && init && init.body) {
        window.__aiBodies.push(JSON.parse(init.body));
      }
    } catch (e) {}
    return Promise.resolve(new Response(JSON.stringify({ text: '{"tradition":0,"innovation":0}' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
})()`
await send('Page.addScriptToEvaluateOnNewDocument', { source: PATCH_FETCH })

await ev(`(() => {
  const k = 'chuandengren.save.v4';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.nodeId = 'C2-X2'; s.phase = 'input'; s.lineIndex = 0; s.missingNodeId = null;
  localStorage.setItem(k, JSON.stringify(s));
})()`)
await send('Page.reload')
await sleep(1400)
await ev(clickByText('.menu-item', '继续上次'))
for (let i = 0; i < 40; i++) {
  if (await ev(`!!document.querySelector('.free-input')`)) break
  await sleep(250)
}
await ev(`(() => {
  const ta = document.querySelector('.free-input textarea');
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  set.call(ta, '先把扎骨架的手艺练扎实，急不得');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
await sleep(200)
await ev(`document.querySelector('.free-input .btn.submit')?.click()`)
await sleep(1500)
const bodies = await ev(`window.__aiBodies || []`)
const last = bodies[bodies.length - 1]
check(
  '⑥-2 切回服务端默认后，请求体里不再带自定义 auth（交给服务端配置）',
  Array.isArray(bodies) && bodies.length > 0 && !('auth' in (last || {})),
  bodies?.length ? `请求体字段=${Object.keys(last).join('、')}` : '页面没发出 /api/ai 请求'
)
check(
  '⑥-3 该请求仍是触点判定的严格 JSON 请求（json: true）',
  !!last && last.json === true && typeof last.prompt === 'string' && last.prompt.length > 20,
  last ? `json=${last.json} prompt 长度=${last.prompt.length}` : '无请求'
)

/* ---------- ⑦ 严格网关：不认 thinking / response_format 时自动降级重试 ---------- */
// 真实场景：团队成员把 Base URL 填成 DeepSeek / 中转网关，对方可能直接 400
// 「unknown field: thinking」。代理会剥掉扩展字段重试一次，页面应当仍然"连接成功"。
await ev(`window.__aiStubOff = true`)
strict = true
await ev(clickByText('.tool', '设置'))
for (let i = 0; i < 30; i++) {
  if (await ev(`!!document.querySelector('.ai-form')`)) break
  await sleep(200)
}
await ev(openAiForm)
await ev(fillField('模型名称', 'stub-strict-model'))
await ev(fillField('Base URL', `http://127.0.0.1:${STUB_PORT}/v1/chat/completions`)) // 故意贴完整接口地址
await ev(fillField('API Key', 'sk-strict-test-000'))
const before4 = hits.length
await ev(clickByText('.ai-actions .pill', '测试连接'))
for (let i = 0; i < 40; i++) {
  const msg = await ev(`document.querySelector('.ai-msg')?.textContent || ''`)
  if (/连接成功|连接失败/.test(msg)) break
  await sleep(250)
}
const msg4 = await ev(`document.querySelector('.ai-msg')?.textContent.trim() || ''`)
const delta = hits.slice(before4)
const lastStrict = delta[delta.length - 1]
check(
  '⑦ 严格网关（拒 thinking）时自动剥扩展字段重试，仍然连接成功',
  /连接成功/.test(msg4) && delta.length >= 2 && lastStrict?.thinking === false,
  `提示="${msg4}" 上游命中 ${delta.length} 次，最后一次 thinking=${lastStrict?.thinking}`
)
check(
  '⑦-2 误粘完整 `/chat/completions` 时路径不会拼成双份',
  lastStrict?.path === '/v1/chat/completions',
  `实际请求路径=${lastStrict?.path || '（无）'}`
)
await shot('05-strict')

await send('Emulation.clearDeviceMetricsOverride')
ws.close()
edge.kill()
stub.close()
console.log(`\n=== 汇总 ===\nPASS ${pass} / ${pass + fail}`)
process.exit(fail ? 1 : 0)
