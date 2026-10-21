#!/usr/bin/env node
/**
 * 第二章（C2）自动走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-c2.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先 npm run build && npm run preview）
 *
 * 验证点（V3.0／剧本 r6）：
 *   ① 跳 C2-0：显示两条路（九婆／阿禾）；
 *   ② 选 A → C2-A，播完回 C2-0 只剩 B（另一条自动解锁）、c2First=jiupo、守 +1；
 *   ③ 选 B → C2-B，播完自动进入 C2-X（触点①）；
 *   ④ C2-X：phase=input、3 预设 + 「先不记录，跳过」；
 *   ⑤ 选预设 A → C2-AA，守 +2（累计 3/0）、stances 记录 1 条、appliedOnce 含 C2-0；
 *   ⑥ 全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { AUDIO_MOCK } from './lib/audio-mock.mjs'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-c2')
const PORT = 9349
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) {
  console.error('未找到 Edge 可执行文件')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `wb-c2v-${Date.now()}`)}`,
    '--window-size=1600,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = l.find((t) => t.type === 'page')
      if (p) return p.webSocketDebuggerUrl
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('无法连接 Edge CDP')
}

try {
  const ws = new WebSocket(await getWs())
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  let id = 0
  const pend = new Map()
  const consoleErrors = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id)
      pend.delete(m.id)
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    }
  }
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id
      pend.set(i, { res, rej })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const ev = async (x) => {
    const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })
    return r.exceptionDetails ? null : r.result.value
  }
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'))
  }
  const snap = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('chuandengren.save.v4')||'{}');
      return {
        nodeId: s.nodeId, phase: s.phase, missing: s.missingNodeId,
        t: s.state?.tradition, i: s.state?.innovation,
        c2First: s.state?.c2First, appliedOnce: s.state?.appliedOnce,
        stances: (s.state?.stances||[]).map(x=>x.nodeId+':'+x.source+':'+x.presetKey+':'+x.tradition+'/'+x.innovation),
        choices: [...document.querySelectorAll('.btn.choice .label')].map(x=>x.textContent.trim()),
        inputShown: !!document.querySelector('.free-input'),
        presets: [...document.querySelectorAll('.free-input .preset .label')].map(x=>x.textContent.trim()),
        hasSkip: !!document.querySelector('.free-input .skip'),
      };
    })()`)
  const advanceUntil = async (pred, timeout = 40000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s && pred(s)) return s
      await ev(`document.querySelector('.stage')?.click()`)
      await sleep(200)
    }
    return null
  }

  await send('Runtime.enable')
  await send('Page.enable')
  // 用静音 data URI 顶替真实 mp3：浏览器不发音频请求，IDM 之类的下载管理器不会弹窗
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIO_MOCK })
  // 无头浏览器把音频响应当成下载会污染系统「下载/音乐」目录——一律拒绝
  try {
    await send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* 旧版 CDP 无此命令，忽略 */
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: URL_ })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.menu-item')`)) break
    await sleep(400)
  }
  // 开始 → 跳 CG → 打开调试面板 → 跳 C2-0
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
  for (let i = 0; i < 30; i++) {
    if (await ev(`!!document.querySelector('.cg-video')`)) break
    await sleep(200)
  }
  await ev(`document.querySelector('.cg-skip')?.click()`)
  await sleep(1000)
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
  await sleep(400)
  await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('C2-0'))?.click()`)
  await sleep(900)

  /* ① C2-0 两条路 */
  let s = await snap()
  check('① C2-0 显示两条路（九婆／阿禾）', s?.choices.length === 2, JSON.stringify(s?.choices))
  await shot('c2-0')

  /* ② 选 A → C2-A → 回 C2-0 只剩 B */
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('九婆'))?.click()`)
  await advanceUntil((x) => x.nodeId === 'C2-A')
  s = await advanceUntil((x) => x.nodeId === 'C2-0' && x.choices.length > 0)
  check(
    '② 选「九婆」→ C2-A → 回 C2-0 仅剩另一条（c2First=jiupo、守+1）',
    !!s && s.choices.length === 1 && s.c2First === 'jiupo' && s.t === 1 && s.i === 0,
    `choices=${s?.choices.length} c2First=${s?.c2First} t/i=${s?.t}/${s?.i}`
  )
  await shot('c2-0-round2')

  /* ③ 选 B → C2-B → 自动进 C2-X2（触点①） */
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('阿禾'))?.click()`)
  await advanceUntil((x) => x.nodeId === 'C2-B')
  // 2026-10-21 按镜头拆节点后，触点落在 C2-X2（C2-X 只演门口相遇）
  s = await advanceUntil((x) => x.nodeId === 'C2-X2' && x.phase === 'input')
  check('③ 选「阿禾」→ C2-B → 自动进入 C2-X2（触点①）', !!s, `nodeId=${s?.nodeId} phase=${s?.phase}`)

  /* ④ C2-X 界面：3 预设 + 跳过 */
  await sleep(600)
  s = await snap()
  check(
    '④ C2-X 界面：3 个预设 + 「先不记录，跳过」',
    s?.inputShown === true && s.presets.length === 3 && s.hasSkip === true,
    `input=${s?.inputShown} presets=${s.presets.length} skip=${s.hasSkip}`
  )
  await shot('c2-x')

  /* ⑤ 选预设 A → C2-AA（守+2） */
  await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
  await sleep(400)
  s = await advanceUntil((x) => x.nodeId === 'C2-AA')
  check(
    '⑤ 选预设 A → C2-AA（累计 3/0、stances 1 条、appliedOnce 含 C2-0）',
    !!s && s.t === 3 && s.i === 0 && s.stances.length === 1 && (s.appliedOnce || []).includes('C2-0'),
    `nodeId=${s?.nodeId} t/i=${s?.t}/${s?.i} stances=${JSON.stringify(s?.stances)}`
  )
  await shot('c2-aa')

  /* ⑥ console */
  check('⑥ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== 汇总 ===')
  console.log(`PASS ${results.length - failed.length} / ${results.length}`)
  if (failed.length) {
    console.log('失败项：')
    for (const f of failed) console.log('-', f.name, f.detail)
    process.exitCode = 2
  }
} finally {
  edge.kill()
  process.exit(process.exitCode ?? 0)
}
