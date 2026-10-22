#!/usr/bin/env node
/**
 * 竖屏提示（OrientationHint）自动走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-orientation.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先 npm run build && npm run preview）
 *
 * 验证点：
 *   ① 竖屏（390×844）进入：提示出现，文案为「横屏游玩效果更佳」；
 *   ② 提示层不吃点击：对白带正中的 elementFromPoint 不在 .orient-layer 里；
 *   ③ 关「知道了」后提示消失，且**刷新后不再出现**（sessionStorage）；
 *   ④ 清掉 sessionStorage 再刷 → 竖屏又提示；
 *   ⑤ 转到横屏（844×390）→ 自动消失；转回竖屏 → 再出现；
 *   ⑥ 全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { AUDIO_MOCK } from './lib/audio-mock.mjs'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-orientation')
const PORT = 9407
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
    `--user-data-dir=${join(tmpdir(), `wb-orient-${Date.now()}`)}`,
    '--window-size=390,844',
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
  const setSize = async (w, h) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await sleep(500)
  }
  const hint = () =>
    ev(`(() => {
      const el = document.querySelector('.orient-hint');
      if (!el) return { shown: false };
      const r = el.getBoundingClientRect();
      return {
        shown: true,
        title: (el.querySelector('.orient-title') || {}).textContent || '',
        sub: (el.querySelector('.orient-sub') || {}).textContent || '',
        top: Math.round(r.top),
        w: Math.round(r.width),
        vw: window.innerWidth,
      };
    })()`)
  const goto = async () => {
    for (let i = 0; i < 50; i++) {
      if (await ev(`!!document.querySelector('.menu-item')`)) return true
      await sleep(300)
    }
    return false
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIO_MOCK })
  try {
    await send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* 旧版 CDP 无此命令 */
  }

  /* ① 竖屏进入即提示 */
  await setSize(390, 844)
  await send('Page.navigate', { url: URL_ })
  await goto()
  await sleep(700)
  let h = await hint()
  check(
    '① 竖屏（390×844）进入即提示「横屏游玩效果更佳」',
    h?.shown === true && h.title.includes('横屏游玩效果更佳'),
    `title="${h?.title}" 宽=${h?.w} 顶=${h?.top}`
  )
  await shot('01-portrait-hint')

  /* ② 提示层不吃点击 */
  const hit = await ev(`(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.82);
    const inLayer = !!(el && el.closest && el.closest('.orient-layer'));
    return { tag: el ? el.tagName + '.' + (el.className || '') : null, inLayer };
  })()`)
  check(
    '② 提示层不挡操作：对白带位置的命中元素不在 .orient-layer 内',
    hit?.inLayer === false,
    `elementFromPoint = ${hit?.tag}`
  )

  /* ②-2 提示条本身不吃点击，只有「知道了」可点 */
  const hitCard = await ev(`(() => {
    const card = document.querySelector('.orient-hint');
    const btn = document.querySelector('.orient-close');
    const c = card.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const onCard = document.elementFromPoint(c.left + 8, c.top + c.height / 2);
    const onBtn = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      card: onCard ? (onCard.closest('.orient-hint') ? 'hint' : onCard.className || onCard.tagName) : null,
      btn: onBtn ? (onBtn.closest('.orient-close') ? 'close' : onBtn.className || onBtn.tagName) : null,
    };
  })()`)
  check(
    '②-2 卡片区域点击穿透（不吃死区），仅「知道了」按钮响应',
    hitCard?.card !== 'hint' && hitCard?.btn === 'close',
    `卡片上命中=${hitCard?.card}｜按钮上命中=${hitCard?.btn}`
  )

  /* ③ 关掉后不再打扰（刷新仍不再出现） */
  await ev(`[...document.querySelectorAll('.orient-close')][0]?.click()`)
  await sleep(500)
  const afterClose = await hint()
  await send('Page.reload')
  await goto()
  await sleep(600)
  const afterReload = await hint()
  check(
    '③ 点「知道了」后消失，刷新也不再出现（sessionStorage）',
    afterClose?.shown === false && afterReload?.shown === false,
    `关闭后=${afterClose?.shown} 刷新后=${afterReload?.shown}`
  )

  /* ④ 清标记后，竖屏又提示 */
  await ev(`sessionStorage.removeItem('chuandengren.orientationHintDismissed')`)
  await send('Page.reload')
  await goto()
  await sleep(600)
  h = await hint()
  check('④ 清掉标记刷新 → 竖屏重新提示', h?.shown === true, `shown=${h?.shown}`)

  /* ⑤ 转横屏消失、转回竖屏再现 */
  await setSize(844, 390)
  await sleep(600)
  const land = await hint()
  await shot('02-landscape-no-hint')
  await setSize(390, 844)
  await sleep(600)
  const backPortrait = await hint()
  check(
    '⑤ 转横屏（844×390）自动消失，转回竖屏再现',
    land?.shown === false && backPortrait?.shown === true,
    `横屏=${land?.shown} 转回=${backPortrait?.shown}`
  )

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
