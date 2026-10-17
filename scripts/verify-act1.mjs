#!/usr/bin/env node
/**
 * 第一幕（序章 PRO ＋ 第一章 C1）自动走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-act1.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先跑 npm run build && npm run preview）
 *
 * 验证点（V3.0，《开发文档》§6.3）：
 *   ① 标题 → 开始 → 存档 nodeId = PRO-1a（序章蒙太奇）；
 *   ② 「跳过序章」→ 直达 C1-1（跳过不计访问）；
 *   ③ C1-3 三错位排队：按 B（文创店）→ C（夜市摊）→ A（文化馆）顺序任选，
 *      每轮回到选择组选项递减（2 → 1 → 0）；全部看过自动汇合至 C1-5；
 *   ④ 存档 c1Order = ['gift','stall','museum']、visitedNodes 含三个错位节点与 C1-5；
 *   ⑤ C1-5 播完进入第二章断点（C2-0 未接入 → 幕间面板）；
 *   ⑥ 回看面板按章分组标题存在；全程无 console 报错。
 * 截图输出到 outDir（默认 .verify-act1/），按序号命名。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-act1')
const PORT = 9334

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) {
  console.error('未找到 Edge 可执行文件')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const userDataDir = join(tmpdir(), `wb-edge-act1-${Date.now()}`)
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
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

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('无法连接 Edge CDP')
}

let ws
try {
  const wsUrl = await getWsUrl()
  ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let msgId = 0
  const pending = new Map()
  const consoleErrors = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(
        (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      )
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails?.exception?.description || 'exception')
    }
  }
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++msgId
      pending.set(id, { resolve: res, reject: rej })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description || 'eval error' }
    return r.result.value
  }

  let shotCount = 0
  const screenshot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' })
    const file = join(OUT, `${String(shotCount++).padStart(2, '0')}-${name}.png`)
    writeFileSync(file, Buffer.from(r.data, 'base64'))
    console.log('shot:', file)
  }

  /** 读取存档（引擎每次进入节点自动写入） */
  const readSave = () =>
    evaluate(`(() => {
      const raw = localStorage.getItem('chuandengren.save.v4')
      return raw ? JSON.parse(raw) : null
    })()`)
  /** 等待存档中的 nodeId 命中（任意一个候选） */
  const waitNode = async (candidates, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await readSave()
      if (s && candidates.includes(s.nodeId)) return s
      await sleep(200)
    }
    return null
  }
  /** 点击推进，直到出现选项组（或超时） */
  const advanceUntilChoices = async (timeout = 30000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const n = await evaluate(
        `document.querySelectorAll('.btn.choice').length`
      )
      if (typeof n === 'number' && n > 0) return n
      await evaluate(`document.querySelector('.stage')?.click()`)
      await sleep(220)
    }
    return -1
  }
  /** 取当前选项按钮文案 */
  const choiceTexts = () =>
    evaluate(
      `[...document.querySelectorAll('.btn.choice .label')].map(x => x.textContent.trim())`
    )
  const clickChoiceByText = (needle) =>
    evaluate(`(() => {
      const b = [...document.querySelectorAll('.btn.choice')].find(x => x.textContent.includes(${JSON.stringify(needle)}))
      b?.click()
      return !!b
    })()`)

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await send('Page.navigate', { url: URL_ })
  for (let i = 0; i < 40; i++) {
    const ok = await evaluate(`!!document.querySelector('.menu-item')`)
    if (ok === true) break
    await sleep(400)
  }
  await sleep(400)
  await screenshot('title')

  /* ① 开始 → PRO-1a */
  await evaluate(
    `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始'))?.click()`
  )
  let s = await waitNode(['PRO-1a'])
  check('① 开始后进入 PRO-1a（序章蒙太奇）', !!s, s ? `nodeId=${s.nodeId}` : '未进入')
  await sleep(700)

  /* ①-b 玩家视角（演示模式＝默认）：画面/声音/节点号等舞台注记不得显示 */
  const bodyText1 = await evaluate(`document.body.innerText`)
  const hasStageText =
    typeof bodyText1 === 'string' &&
    (bodyText1.includes('【PRO-1】') ||
      bodyText1.includes('画面：') ||
      bodyText1.includes('声音：') ||
      bodyText1.includes('场景底版'))
  check('①-b 演示模式（默认）不显示舞台注记', hasStageText === false)
  await screenshot('pro1')

  /* ①-c 审核模式：Shift+D 开面板 → 点「审核模式」→ 重开，舞台注记应显示 */
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`
  )
  await sleep(300)
  await evaluate(
    `[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('审核模式'))?.click()`
  )
  await sleep(300)
  await evaluate(
    `[...document.querySelectorAll('.tool')].find(b => b.textContent.includes('重新开始'))?.click()`
  )
  await sleep(500)
  const bodyText2 = await evaluate(`document.body.innerText`)
  const hasStageInReview = typeof bodyText2 === 'string' && bodyText2.includes('【PRO-1】竹')
  check('①-c 审核模式显示舞台注记（供创作团队）', hasStageInReview === true)
  // 切回演示模式并关闭调试面板，保持后续截图干净
  await evaluate(
    `[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('演示模式'))?.click()`
  )
  await sleep(200)
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`
  )
  await sleep(300)

  /* ② 跳过序章 → C1-1 */
  const skipClicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.tool')].find(x => x.textContent.includes('跳过序章'))
    b?.click()
    return !!b
  })()`)
  s = await waitNode(['C1-1'])
  check('② 「跳过序章」直达 C1-1', !!skipClicked && !!s, s ? `nodeId=${s.nodeId}` : '未到达')
  await sleep(500)
  await screenshot('skip-to-c1-1')

  /* ③ C1-3 三错位排队：B → C → A */
  const order = []
  let round = 0
  // 先推进到第一轮选项
  let n = await advanceUntilChoices()
  check('③-1 进入 C1-3（第一轮 3 个选项）', n === 3, `choices=${n}`)
  const texts1 = await choiceTexts()
  console.log('round1:', JSON.stringify(texts1))
  await screenshot('choice-round1')

  const pickOrder = ['文创店', '夜市摊', '文化馆']
  const expectNodes = ['C1-4b', 'C1-4c', 'C1-4a']
  const expectSpots = ['gift', 'stall', 'museum']
  for (let i = 0; i < pickOrder.length; i++) {
    round += 1
    await sleep(600) // 选项就绪缓冲（300ms）+ 错峰进场
    await clickChoiceByText(pickOrder[i])
    order.push(expectSpots[i])
    const reached = await waitNode([expectNodes[i]])
    check(`③-${round + 1} 选择「${pickOrder[i]}」→ ${expectNodes[i]}`, !!reached)
    await sleep(400)
    await screenshot(`spot-${round}-${expectNodes[i]}`)
    // 推进错位节点内容，直到再次出现选项组（或对第 3 轮：直接汇合）
    const m = await advanceUntilChoices(40000)
    if (i < 2) {
      const expectCount = 2 - i
      check(`③-${round + 1}b 回到选择组（剩余 ${expectCount} 项）`, m === expectCount, `choices=${m}`)
      await screenshot(`choice-round${round + 1}`)
    } else {
      // 第三轮后：无剩余选项 → 自动汇合 C1-5（等待出现即视为通过，m 为 -1）
      check('③-5 三个错位看完后选择组无剩余选项（自动汇合）', m === -1, `choices=${m}`)
    }
  }

  /* ④ 汇合 C1-5 并验证存档 */
  s = await waitNode(['C1-5'])
  check('④-1 汇合至 C1-5（困境收束）', !!s, s ? `nodeId=${s.nodeId}` : '未到达')
  await sleep(600)
  await screenshot('c1-5')
  if (s) {
    const c1Order = s.state?.c1Order ?? []
    const visited = s.state?.visitedNodes ?? []
    check(
      '④-2 存档 c1Order＝所选顺序',
      JSON.stringify(c1Order) === JSON.stringify(order),
      `c1Order=${JSON.stringify(c1Order)}`
    )
    check(
      '④-3 visitedNodes 含三个错位节点',
      ['C1-4a', 'C1-4b', 'C1-4c'].every((x) => visited.includes(x)),
      `visited=${visited.join(',')}`
    )
  }

  /* ⑤ 推进到第二章断点 */
  for (let i = 0; i < 160; i++) {
    const brk = await evaluate(`!!document.querySelector('.break-panel')`)
    if (brk === true) break
    await evaluate(`document.querySelector('.stage')?.click()`)
    await sleep(200)
  }
  const brkCode = await evaluate(
    `document.querySelector('.break-panel code')?.textContent?.trim() || null`
  )
  check('⑤ C1-5 播完进入第二章断点（C2-0 未接入）', brkCode === 'C2-0', `break=${brkCode}`)
  await screenshot('break-c2')

  /* ⑥ 回看面板：按章分组 */
  await evaluate(
    `[...document.querySelectorAll('.tool')].find(b => b.textContent.includes('回看'))?.click()`
  )
  await sleep(600)
  const heads = await evaluate(
    `[...document.querySelectorAll('.group-title')].map(x => x.textContent.trim())`
  )
  const okHeads =
    Array.isArray(heads) &&
    heads.some((h) => h.includes('序章·一盏灯的一生')) &&
    heads.some((h) => h.includes('第一章·灯往何处去'))
  check('⑥ 回看按章分组（序章 + 第一章）', okHeads, JSON.stringify(heads))
  await screenshot('history')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(300)

  /* ⑦ console 报错汇总 */
  check('⑦ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== 汇总 ===')
  console.log(`PASS ${results.length - failed.length} / ${results.length}`)
  if (failed.length) {
    console.log('失败项：')
    for (const f of failed) console.log('-', f.name, f.detail)
    process.exitCode = 2
  }
} finally {
  try {
    ws?.close()
  } catch {
    /* noop */
  }
  edge.kill()
}
