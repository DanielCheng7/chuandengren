#!/usr/bin/env node
/**
 * 选项穷举走查：把每个可选分支都实跑一遍
 *
 * 用法：node scripts/verify-options.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 覆盖（2026-10-18 用户要求「每个选项都跑一遍」）：
 *   A. C1-3 三错位 **6 种观看顺序**：每轮都弹选项、选项递减 3→2→1、
 *      每轮衔接语正确、所选分支进入对应 C1-4x、最终汇合 C1-5 且 c1Order 与所选顺序一致；
 *   B. C2-0 两条路 **2 种顺序**：第一次选择后回 C2-0 只剩另一条，第二次后自动进 C2-X；
 *   C. C2-X **4 路**：预设 A→C2-AA、B→C2-BB、C→C3-1、跳过→C3-1；
 *   D. C3-4 **3 路**：预设 A／B／C 均不分支直奔 C3-5。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-options')
const PORT = 9359
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
    `--user-data-dir=${join(tmpdir(), `wb-opt-${Date.now()}`)}`,
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

/** C1 三个错位的选项文案与目标节点 */
const SPOTS = {
  museum: { label: '镇文化馆', node: 'C1-4a', name: '展柜' },
  gift: { label: '新开的文创店', node: 'C1-4b', name: '货架' },
  stall: { label: '夜市摊', node: 'C1-4c', name: '摊位' },
}
/** 6 种观看顺序 */
const C1_ORDERS = [
  ['museum', 'gift', 'stall'],
  ['museum', 'stall', 'gift'],
  ['gift', 'museum', 'stall'],
  ['gift', 'stall', 'museum'],
  ['stall', 'museum', 'gift'],
  ['stall', 'gift', 'museum'],
]

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
  const SAVE = 'chuandengren.save.v4'
  const snap = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('${SAVE}')||'{}');
      return {
        nodeId: s.nodeId, phase: s.phase,
        t: s.state?.tradition, i: s.state?.innovation,
        c1Order: s.state?.c1Order || [], c2First: s.state?.c2First,
        choices: [...document.querySelectorAll('.btn.choice .label')].map(x=>x.textContent.trim()),
        body: document.body.innerText,
        presets: [...document.querySelectorAll('.free-input .preset .label')].map(x=>x.textContent.trim()),
        hasSkip: !!document.querySelector('.free-input .skip'),
      };
    })()`)
  const tap = () => ev(`document.querySelector('.story .stage')?.click()`)
  const freshBoot = async () => {
    await send('Page.navigate', { url: URL_ })
    await sleep(800)
    await ev(`localStorage.clear()`)
    await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}v=${Date.now()}` })
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.menu-item')`)) return true
      await sleep(280)
    }
    return false
  }
  /** 开始旅程 → 跳过 CG → 关打字机 → 跳章节入口（调试面板随后收起） */
  const jumpTo = async (entry) => {
    await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
    for (let i = 0; i < 30; i++) {
      if (await ev(`!!document.querySelector('.cg-video')`)) break
      await sleep(200)
    }
    await ev(`document.querySelector('.cg-skip')?.click()`)
    await sleep(1200)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(350)
    await ev(
      `[...document.querySelectorAll('.dev .toggles label')].find(l=>l.textContent.includes('打字机'))?.querySelector('input')?.click()`
    )
    await sleep(150)
    await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('${entry}'))?.click()`)
    await sleep(700)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(250)
  }
  /**
   * 一直点击，直到引擎**真正进入 choice 阶段**并渲染出选项。
   * 只看 DOM 会在「存档已切到下一节点、DOM 还停在旧选项」的过渡帧读到上一轮快照，
   * 所以以存档 phase 为准（phase='choice' 由引擎在选项就绪时写入）。
   */
  const advanceToChoices = async (timeout = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.phase === 'choice' && s.choices?.length) return s
      if (s?.phase === 'input') {
        // 意外走到触点：选第一项继续（本组不测触点）
        await ev(`document.querySelector('.free-input .preset')?.click()`)
        await sleep(400)
        continue
      }
      await tap()
      await sleep(160)
    }
    return null
  }
  /** 一直点击，直到 nodeId 命中候选（返回前等 DOM 跟上存档） */
  const advanceToNode = async (ids, timeout = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s && ids.includes(s.nodeId)) {
        await sleep(320)
        return s
      }
      await tap()
      await sleep(170)
    }
    return null
  }
  const advanceToInput = async (timeout = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.phase === 'input') {
        await sleep(360)
        return s
      }
      if (s?.phase === 'choice' && s.choices?.length) {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(170)
    }
    return null
  }
  const clickLabel = async (kw) => {
    await sleep(450)
    return ev(
      `[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('${kw}'))?.click()`
    )
  }

  await send('Runtime.enable')
  await send('Page.enable')
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

  /* ================= A. C1 六种观看顺序 ================= */
  const c1Rows = []
  for (const order of C1_ORDERS) {
    await freshBoot()
    await jumpTo('C1-1')
    const label = order.map((k) => SPOTS[k].name).join('→')
    const steps = []
    let ok = true
    for (let r = 0; r < 3; r++) {
      const s = await advanceToChoices()
      const expectN = 3 - r
      const guide =
        r === 0 ? '先去哪一边' : r === 1 ? '剩下两处' : '最后一处'
      const guideOk = !!s && s.body.includes(guide)
      const spot = SPOTS[order[r]]
      // 上一轮选过的项不应再出现；本轮要选的项必须在
      const goneOk = !!s && order.slice(0, r).every((k) => !s.choices.some((t) => t.includes(SPOTS[k].label)))
      const hasTarget = !!s && s.choices.some((t) => t.includes(spot.label))
      const nOk = s?.choices?.length === expectN
      await clickLabel(spot.label)
      const landed = await advanceToNode([spot.node])
      steps.push({ r, n: s?.choices?.length, guideOk, goneOk, hasTarget, nodeOk: !!landed })
      if (!(nOk && guideOk && goneOk && hasTarget && landed)) ok = false
    }
    const end = await advanceToNode(['C1-5'], 60000)
    const orderOk =
      end?.c1Order?.length === 3 && order.every((k, idx) => end.c1Order[idx] === k)
    c1Rows.push({ label, ok, orderOk, steps, c1Order: end?.c1Order })
    check(
      `A. C1 顺序 ${label}`,
      ok && orderOk,
      `轮次=${steps.map((x) => `${x.n}项${x.guideOk ? '✓' : '✗'}${x.nodeOk ? '✓' : '✗'}`).join(' / ')}｜c1Order=${JSON.stringify(end?.c1Order)}`
    )
  }
  await shot('c1-last-order')

  /* ================= B. C2 两条路两种顺序 ================= */
  for (const order of [
    ['jiupo', 'ahe'],
    ['ahe', 'jiupo'],
  ]) {
    await freshBoot()
    await jumpTo('C2-0')
    const first = order[0] === 'jiupo' ? '九婆' : '阿禾'
    const second = order[1] === 'jiupo' ? '九婆' : '阿禾'
    let s = await advanceToChoices()
    const n1 = s?.choices?.length
    await clickLabel(first)
    await advanceToNode(['C2-A', 'C2-B'])
    s = await advanceToChoices()
    const n2 = s?.choices?.length
    const onlyOther = !!s && s.choices.length === 1 && s.choices[0].includes(second)
    await clickLabel(second)
    const toTouch = await advanceToInput()
    check(
      `B. C2 顺序 ${first}→${second}`,
      n1 === 2 && n2 === 1 && onlyOther && !!toTouch && toTouch.nodeId === 'C2-X',
      `首轮=${n1} 次轮=${n2} 仅剩另一条=${onlyOther} 触点=${toTouch?.nodeId}`
    )
    await shot(`c2-order-${order[0]}`)
  }

  /* ================= C. C2-X 四路 ================= */
  for (const [idx, label, expect] of [
    [0, '预设A', 'C2-AA'],
    [1, '预设B', 'C2-BB'],
    [2, '预设C', 'C3-1'],
    [-1, '跳过', 'C3-1'],
  ]) {
    await freshBoot()
    await jumpTo('C2-0')
    await advanceToChoices()
    await clickLabel('九婆')
    await advanceToNode(['C2-A'])
    await advanceToChoices()
    await clickLabel('阿禾')
    const s = await advanceToInput()
    if (idx === -1) await ev(`document.querySelector('.free-input .skip')?.click()`)
    else await ev(`[...document.querySelectorAll('.free-input .preset')][${idx}]?.click()`)
    await sleep(500)
    const landed = await advanceToNode([expect, 'C3-1', 'C2-AA', 'C2-BB'], 40000)
    check(
      `C. C2-X ${label} → ${expect}`,
      !!s && s.presets?.length === 3 && landed?.nodeId === expect,
      `node=${landed?.nodeId}`
    )
    await shot(`c2x-${idx === -1 ? 'skip' : idx}`)
  }

  /* ================= D. C3-4 三路 ================= */
  for (const [idx, label] of [
    [0, '预设A'],
    [1, '预设B'],
    [2, '预设C'],
  ]) {
    await freshBoot()
    await jumpTo('C3-1')
    const s = await advanceToInput()
    const noSkip = s?.hasSkip === false
    await ev(`[...document.querySelectorAll('.free-input .preset')][${idx}]?.click()`)
    await sleep(500)
    const landed = await advanceToNode(['C3-5'])
    check(
      `D. C3-4 ${label} → C3-5（不分支）`,
      !!s && s.presets?.length === 3 && noSkip && landed?.nodeId === 'C3-5',
      `node=${landed?.nodeId} 无跳过=${noSkip}`
    )
    await shot(`c3-4-${idx}`)
  }

  /* ================= 汇总表 ================= */
  console.log('\n=== C1 顺序矩阵 ===')
  for (const r of c1Rows) {
    console.log(
      `${r.ok && r.orderOk ? 'OK  ' : 'FAIL'} ${r.label}  ` +
        r.steps.map((x) => `R${x.r + 1}:${x.n}项`).join(' ') +
        `  c1Order=${JSON.stringify(r.c1Order)}`
    )
  }
  check('E. 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

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
