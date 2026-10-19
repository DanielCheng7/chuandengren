#!/usr/bin/env node
/**
 * 整篇连通性走查（真实玩家路径，不用跳章）
 *
 * 用法：node scripts/verify-walkthrough.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先 npm run build && npm run preview）；
 *   本地开发期可直接传 http://127.0.0.1:5173/
 *
 * 目的：检查玩家一路点下来时**章节之间的衔接**是否正确（而非单章跳转）：
 *   序章 → C1 → C2（两条路）→ C2-X（触点①）→ C2-AA → C3 → C3-4（触点②）
 *   → C3-A/B/C（自动）→ C3-R（报告）→ C4（结算）→ 链 A → 结局页
 *
 * 验证点：
 *   ① 序章播完自动进 C1-1（不是停在 PRO-6）；
 *   ② C1-3 **三轮都弹选项**（3→2→1），三错位全看；
 *   ③ C1-5 播完进 C2-0；
 *   ④ C2-0 两次进入后进 C2-X；C2-X 预设 A → C2-AA → C3-1；
 *   ⑤ C3-4 触点②出现且选完不分支直奔 C3-5；
 *   ⑥ C3-8 播完自动进 C3-A（不弹选项）；
 *   ⑦ C3-R → C4 → 链 A → 结局页《灯还亮着》；
 *   ⑧ 回看面板按六章分组齐全（正文五章 + 链 A）；
 *   ⑨ 结局页刷新后不丢进度；全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-walkthrough')
const PORT = 9355
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
    `--user-data-dir=${join(tmpdir(), `wb-walk-${Date.now()}`)}`,
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
        ending: s.state?.ending, tier: s.state?.endingTier,
        c1Order: s.state?.c1Order, c2First: s.state?.c2First,
        choices: [...document.querySelectorAll('.btn.choice .label')].map(x=>x.textContent.trim()),
        inputShown: !!document.querySelector('.free-input'),
        presets: [...document.querySelectorAll('.free-input .preset .label')].map(x=>x.textContent.trim()),
        dbox: document.querySelector('.dbox .text')?.textContent?.trim() || '',
        body: document.body.innerText,
      };
    })()`)
  const tap = () => ev(`document.querySelector('.story .stage')?.click()`)
  const clickFirstChoice = () =>
    ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
  const clickFirstPreset = () =>
    ev(`document.querySelector('.free-input .preset')?.click()`)

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
  await send('Page.navigate', { url: URL_ })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.menu-item')`)) break
    await sleep(400)
  }
  await ev(`localStorage.clear()`)

  // 开始旅程 → 跳过开场 CG（玩家也会跳过；衔接检查从序章开始）
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
  for (let i = 0; i < 30; i++) {
    if (await ev(`!!document.querySelector('.cg-video')`)) break
    await sleep(200)
  }
  await ev(`document.querySelector('.cg-skip')?.click()`)
  await sleep(1500)

  // 关掉打字机（只为走查速度；注意行内的引号/推进逻辑不属本脚本验证范围）
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
  await sleep(400)
  await ev(
    `[...document.querySelectorAll('.dev .toggles label')].find(l=>l.textContent.includes('打字机'))?.querySelector('input')?.click()`
  )
  await sleep(200)
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
  await sleep(300)

  /* ===== 真实路径推进：记录途经节点序列 ===== */
  const seq = []
  const snaps = {}
  const phaseLog = [] // 「节点:阶段」变化序列——判断某轮到底弹没弹选项
  const t0 = Date.now()
  let last = ''
  let prevPhase = ''
  let breakHit = null
  let endSnap = null
  while (Date.now() - t0 < 240000) {
    const s = await snap()
    if (!s) break
    if (s.nodeId && s.nodeId !== last) {
      seq.push(s.nodeId)
      last = s.nodeId
      if (!snaps[s.nodeId]) snaps[s.nodeId] = s
    }
    if (s.phase && s.phase !== prevPhase) {
      phaseLog.push(`${s.nodeId}:${s.phase}`)
      prevPhase = s.phase
    }
    if (s.phase === 'break') {
      breakHit = s
      break
    }
    if (s.phase === 'end') {
      endSnap = s
      break
    }
    if (s.phase === 'choice') {
      // 等 ready 门控（300ms），避免点了没反应
      await sleep(420)
      await clickFirstChoice()
      await sleep(500)
      continue
    }
    if (s.phase === 'input') {
      await sleep(200)
      await clickFirstPreset()
      await sleep(500)
      continue
    }
    await tap()
    await sleep(170)
  }

  console.log('途经节点：' + seq.join(' → '))

  const countOf = (id) => seq.filter((x) => x === id).length
  const afterOf = (a) => seq[seq.indexOf(a) + 1]

  /* ① 序章 → C1-1 自动衔接 */
  check(
    '① 序章 PRO-6 播完自动进 C1-1',
    seq.includes('PRO-6') && afterOf('PRO-6') === 'C1-1',
    `PRO-6 → ${afterOf('PRO-6')}`
  )

  /* ② C1-3 补看轮：三个错位全看、三轮都弹选项（2026-10-18 用户决议） */
  const c1ChoiceTimes = phaseLog.filter((x) => x === 'C1-3:choice').length
  const spotsAll = ['C1-4a', 'C1-4b', 'C1-4c'].every((id) => seq.includes(id))
  check(
    '② C1-3 三轮都弹选项、三错位全看',
    spotsAll && c1ChoiceTimes === 3 && endSnap?.c1Order?.length === 3,
    `错位=${JSON.stringify(endSnap?.c1Order)}｜弹选项 ${c1ChoiceTimes} 次`
  )

  /* ③ C1-5 → C2-0 */
  check('③ C1-5 播完进入 C2-0', afterOf('C1-5') === 'C2-0', `C1-5 → ${afterOf('C1-5')}`)

  /* ④ C2 两条路：二进宫后开 C2-X；C2-X → C2-AA → C3-1 */
  check(
    '④ C2-0 两次进入后自动进 C2-X（两条路都体验过）',
    countOf('C2-0') === 2 && afterOf('C2-0') !== 'C2-0' && seq.includes('C2-X'),
    `C2-0 进入 ${countOf('C2-0')} 次，之后 ${seq[seq.lastIndexOf('C2-0') + 1]}`
  )
  check(
    '④-2 C2-X（触点①）→ C2-AA → C3-1',
    afterOf('C2-X') === 'C2-AA' && afterOf('C2-AA') === 'C3-1',
    `C2-X → ${afterOf('C2-X')} → ${afterOf('C2-AA')}`
  )

  /* ⑤ C3-4 触点②之后直奔 C3-5（不分支） */
  const touchPoints = phaseLog.filter((x) => x === 'C2-X:input').length + phaseLog.filter((x) => x === 'C3-4:input').length
  check(
    '⑤ C3-4 播完进 C3-5（四路不分支）；两处触点各出现 1 次',
    seq.includes('C3-4') &&
      afterOf('C3-4') === 'C3-5' &&
      phaseLog.filter((x) => x === 'C2-X:input').length === 1 &&
      phaseLog.filter((x) => x === 'C3-4:input').length === 1,
    `C3-4 → ${afterOf('C3-4')}｜输入界面共 ${touchPoints} 次`
  )

  /* ⑥ C3-8 → C3-A 自动（无选项） */
  check(
    '⑥ C3-8 播完自动进 C3-A（不弹选项）',
    afterOf('C3-8') === 'C3-A',
    `C3-8 → ${afterOf('C3-8')}`
  )
  await shot('01-c3-a-reached')

  /* ⑦ C3-A → C3-R → C4 → 链 A → 结局页 */
  check(
    '⑦ C3-R（报告）→ C4（结算）→ 链 A → 结局页《灯还亮着》',
    !!endSnap &&
      endSnap.phase === 'end' &&
      endSnap.ending === 'A' &&
      seq.includes('C3-R') &&
      seq.includes('C4') &&
      afterOf('C3-R') === 'C4' &&
      afterOf('C4') === 'A1',
    `C3-R→${afterOf('C3-R')}｜C4→${afterOf('C4')}｜phase=${endSnap?.phase} ending=${endSnap?.ending}`
  )
  await shot('02-ending-screen')

  /* ⑧ 结局页结构（结局页不提供「回看」入口，只校验本页要素） */
  const endBody = endSnap?.body || ''
  check(
    '⑧ 结局页结构完整：标题 / 灯路 / 结局正文 / 旅程回顾 / 两个出口',
    endBody.includes('灯亮之后') &&
      endBody.includes('守旧链·《灯还亮着》') &&
      endBody.includes('旅程回顾') &&
      endBody.includes('重新体验') &&
      endBody.includes('返回标题'),
    endBody.slice(0, 46).replace(/\n/g, ' ')
  )
  await shot('03-ending-screen')

  /* ⑨ 结局页刷新恢复 */
  await ev(`document.querySelector('.history .back-pill, .history .back')?.click()`)
  await sleep(400)
  await send('Page.reload')
  await sleep(2600)
  const afterReload = await ev(`(async () => {
    const btn = [...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('继续上次'));
    if (btn) { btn.click(); await new Promise(r=>setTimeout(r,900)); }
    const s = JSON.parse(localStorage.getItem('chuandengren.save.v4')||'{}');
    return { nodeId: s.nodeId, phase: s.phase, missing: s.missingNodeId, body: document.body.innerText };
  })()`)
  check(
    '⑨ 结局页刷新后仍停在结局（不丢进度）',
    afterReload?.phase === 'end' &&
      typeof afterReload?.body === 'string' &&
      afterReload.body.includes('灯还亮着'),
    `phase=${afterReload?.phase} node=${afterReload?.nodeId}`
  )

  /* ⑩ console */
  check('⑩ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

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
