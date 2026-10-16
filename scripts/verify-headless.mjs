#!/usr/bin/env node
/**
 * 无头走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-headless.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先跑 npm run build && npm run preview）
 * 行为：进入游戏 → 自动点击推进（抉择优先「你先扫」、自由输入点第一预设）
 *       → 在「道具亮相」处逐条截图 → 输出 console 错误。
 * 截图输出到 outDir（默认 .verify/），按序号命名。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify')
const PORT = 9333

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!EDGE) {
  console.error('未找到 Edge 可执行文件')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const userDataDir = join(tmpdir(), `wb-edge-verify-${Date.now()}`)
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
  const consoleWarns = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => a.value ?? a.description ?? '')
        .join(' ')
      if (msg.params.type === 'error') consoleErrors.push(text)
      if (msg.params.type === 'warning') consoleWarns.push(text)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails?.exception?.description || 'exception')
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve2, reject2) => {
      const id = ++msgId
      pending.set(id, { resolve: resolve2, reject: reject2 })
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

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await send('Page.navigate', { url: URL_ })
  // 等待首屏（dev 首启会做依赖预构建，给足时间）
  for (let i = 0; i < 40; i++) {
    const ok = await evaluate(`!!document.querySelector('.menu-item')`)
    if (ok === true) break
    await sleep(400)
  }
  await sleep(400)
  await screenshot('title')

  const clicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始'))
    b?.click()
    return !!b
  })()`)
  console.log('start clicked:', clicked)
  await sleep(750)
  await screenshot('enter-bloom') // 转场花光 + 角标水印应在此时可见
  await sleep(600)

  const seen = new Set()
  const seenNames = new Set()
  const seenChoice = new Set()
  let shotFreeInput = false
  let done = false
  const MAX = 340

  for (let i = 0; i < MAX && !done; i++) {
    const state = await evaluate(`(() => {
      const sc = document.querySelector('.showcase')
      const word = sc ? (sc.querySelector('.word')?.textContent || '').trim() : null
      const nameEl = document.querySelector('.dbox .name-row .name')
      const name = nameEl ? nameEl.textContent.trim() : null
      const dtext = (document.querySelector('.dbox .text')?.textContent || '').trim()
      const choices = [...document.querySelectorAll('.btn.choice')].map(b => b.textContent.trim())
      const presets = [...document.querySelectorAll('.presets .preset')].map(b => b.textContent.trim())
      return { word, name, dtext, choices, presets }
    })()`)
    if (!state || state.error) {
      console.log('eval issue:', state?.error)
      await sleep(300)
      continue
    }

    if (typeof state.word === 'string') {
      if (!seen.has(state.word)) {
        seen.add(state.word)
        await sleep(650)
        await screenshot(`showcase-${seen.size}`)
        console.log('showcase text:', JSON.stringify(state.word))
      }
      if (seen.size >= 8) {
        done = true
        break
      }
      await sleep(150)
      continue
    }

    // 对白行进框：每个说话人首次出现时截一张（验证名字签 + 台词引号）
    if (state.name && !seenNames.has(state.name)) {
      seenNames.add(state.name)
      const isTyping = await evaluate(`!!document.querySelector('.dbox .caret')`)
      if (isTyping === true) {
        await evaluate(`document.querySelector('.dbox')?.click()`)
        await sleep(250)
      }
      await sleep(350)
      await screenshot(`dialogue-${seenNames.size}-${state.name}`)
      console.log('dialogue name:', JSON.stringify(state.name), 'text:', JSON.stringify(state.dtext.slice(0, 34)))
      continue
    }

    if (state.presets.length) {
      if (!shotFreeInput) {
        shotFreeInput = true
        await sleep(350)
        await screenshot('free-input')
        console.log('free input seen at step', i)
      }
      await evaluate(`document.querySelector('.presets .preset')?.click()`)
      console.log('preset picked at step', i)
      await sleep(650) // 选中点亮 250ms + 引擎切换
      continue
    }

    if (state.choices.length) {
      const key = state.choices.join('|')
      const fresh = !seenChoice.has(key)
      if (fresh) {
        seenChoice.add(key)
        await sleep(850) // 等选项错峰进场完成
        await screenshot(`choice-${seenChoice.size}`)
        console.log('choice seen at step', i, ':', JSON.stringify(state.choices))
      } else {
        await sleep(500)
      }
      await evaluate(`(() => {
        const btns = [...document.querySelectorAll('.btn.choice')]
        const target = btns.find(b => b.textContent.includes('你先扫')) || btns[0]
        target?.click()
        return true
      })()`)
      if (fresh) {
        await sleep(70) // 选中点亮后立即截图（250ms 转场锁定的窗口内）
        await screenshot(`choice-selected-${seenChoice.size}`)
      }
      await sleep(500)
      continue
    }

    await evaluate(`document.querySelector('.stage')?.click()`)
    await sleep(240)
  }

  // 回看面板抽查（打开 → 截图 → Esc 关闭；验证覆盖层与记录流样式）
  await evaluate(
    `[...document.querySelectorAll('.tool')].find(b => b.textContent.includes('回看'))?.click()`
  )
  await sleep(500)
  await screenshot('history')
  console.log('history panel checked')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(350)

  await screenshot('end')
  console.log('\n=== showcase seen ===')
  for (const w of seen) console.log('-', JSON.stringify(w))
  console.log('\n=== console errors ===')
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)')
  console.log('=== console warns (first 5) ===')
  console.log(consoleWarns.slice(0, 5).join('\n') || '(none)')
} finally {
  try {
    ws?.close()
  } catch {
    /* noop */
  }
  edge.kill()
}
process.exit(0)
