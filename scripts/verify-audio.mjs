#!/usr/bin/env node
/**
 * BGM 通道验收（步骤 40 最小闭环）
 *
 * 用法：node scripts/verify-audio.mjs [url] [outDir]
 *   默认 http://127.0.0.1:4173/（先在 app/ 下 npm run build && npm run preview）
 *
 * 验证点：
 *   ① 标题页自动起播 `bgm_title`，音量＝settings.volume × 0.62；
 *   ② 设置面板把音量拖到 0 → 立即静音（但不停播，拖回来能恢复）；
 *   ③ 拖回 70 → 音量恢复；
 *   ④ 点「开始旅程」→ 渐隐期 BGM 淡出并暂停（**给 CG 原声让位**）；
 *   ⑤ 入场 CG 播放中 BGM 保持暂停（`开场CG.mp4` 自带音轨，不得叠加）；
 *   ⑥ 跳过 CG 进剧情 → 切到 `bgm_story` 并起播，音量＝settings.volume × 0.5；
 *   ⑦ 刷新后「继续上次」→ 直接进剧情，BGM 仍为剧情曲（不经 CG 不冷场）；
 *   ⑧ 全程 console 无 error、无音频 404。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-audio')
const PORT = 9371
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
    `--user-data-dir=${join(tmpdir(), `wb-audio-${Date.now()}`)}`,
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
  const badRequests = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id)
      pend.delete(m.id)
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    } else if (m.method === 'Network.responseReceived') {
      const r = m.params.response
      if (r.status >= 400 && /assets\/audio\//.test(r.url)) badRequests.push(`${r.status} ${r.url}`)
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
  const state = () => ev(`window.__bgmState ? window.__bgmState() : null`)
  const near = (a, b, tol = 0.03) => Math.abs(a - b) <= tol
  const boot = async (clear = true) => {
    await send('Page.navigate', { url: URL_ })
    await sleep(800)
    if (clear) await ev(`localStorage.clear()`)
    await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}v=${Date.now()}` })
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.menu-item')`)) return true
      await sleep(250)
    }
    return false
  }

  await send('Page.enable')
  // 无头浏览器把音频响应当成下载会污染系统「下载/音乐」目录——一律拒绝
  try {
    await send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* 旧版 CDP 无此命令，忽略 */
  }
  await send('Runtime.enable')
  await send('Network.enable')

  /* ---------- ① 标题页起播 ---------- */
  if (!(await boot())) throw new Error('标题页未加载')
  await sleep(1200)
  const s1 = await state()
  check(
    '① 标题页起播 bgm_title',
    !!s1 && s1.current === 'title' && s1.playing && s1.volume > 0.3,
    s1 ? `current=${s1.current} playing=${s1.playing} vol=${s1.volume}` : '无状态'
  )
  check('①-2 音量＝volume70 × 0.62', !!s1 && near(s1.volume, 0.434), s1 ? `实际 ${s1.volume}` : '')
  await shot('01-title')

  /* ---------- ② 音量拖到 0 ---------- */
  const setVolume = (v) =>
    ev(`(() => {
      const el = document.querySelector('input[aria-label="音量"]');
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, '${v}');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`)
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('设置'))?.click()`)
  await sleep(400)
  const okSet = await setVolume(0)
  await sleep(450)
  const s2 = await state()
  check('② 音量 0 = 静音但不停播', okSet && !!s2 && s2.volume === 0 && s2.playing, s2 ? `vol=${s2.volume} playing=${s2.playing}` : '')
  await shot('02-mute')

  /* ---------- ③ 拖回 70 ---------- */
  await setVolume(70)
  await sleep(450)
  const s3 = await state()
  check('③ 拖回 70 恢复音量', !!s3 && near(s3.volume, 0.434), s3 ? `实际 ${s3.volume}` : '')

  /* ---------- ④⑤ 开始旅程 → CG 避让 ---------- */
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
  await sleep(1100)
  const s4 = await state()
  check('④ 渐隐/CG 期 BGM 让位', !!s4 && s4.suspended && !s4.playing, s4 ? `suspended=${s4.suspended} playing=${s4.playing}` : '')

  // 等 CG 真正出现
  let cgOk = false
  for (let i = 0; i < 30; i++) {
    cgOk = await ev(`(() => { const v = document.querySelector('.cg-video'); return !!v && !v.paused; })()`)
    if (cgOk) break
    await sleep(250)
  }
  const s5 = await state()
  check('⑤ CG 播放中 BGM 保持暂停', cgOk && !!s5 && !s5.playing, s5 ? `CG=${cgOk} playing=${s5.playing}` : '')
  await shot('03-cg')

  /* ---------- ⑥ 跳过 CG → 剧情曲 ---------- */
  await ev(`document.querySelector('.cg-skip')?.click()`)
  await sleep(1400)
  const s6 = await state()
  check(
    '⑥ 进剧情切到 bgm_story 起播',
    !!s6 && s6.current === 'story' && s6.playing && near(s6.volume, 0.35),
    s6 ? `current=${s6.current} playing=${s6.playing} vol=${s6.volume}` : ''
  )
  await shot('04-story')

  /* ---------- ⑦ 刷新后「继续上次」 ---------- */
  await sleep(900)
  await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}again=${Date.now()}` })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.menu-item')`)) break
    await sleep(250)
  }
  await sleep(400) // 等 saveExists 驱动的一次重渲染
  const hasContinue = await ev(
    `[...document.querySelectorAll('.menu-item')].some(x => x.textContent.includes('继续上次'))`
  )
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`)
  await sleep(1300)
  const s7 = await state()
  check(
    '⑦ 继续上次直接进剧情（剧情曲不冷场）',
    hasContinue && !!s7 && s7.current === 'story' && s7.playing,
    s7 ? `有无继续=${hasContinue} current=${s7.current} playing=${s7.playing}` : ''
  )

  /* ---------- ⑧ 无报错、无 404 ---------- */
  check('⑧ console 无 error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  check('⑧-2 音频无 404', badRequests.length === 0, badRequests.slice(0, 2).join(' | '))

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} 通过`)
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(results, null, 2))
  process.exitCode = passed === results.length ? 0 : 1
} finally {
  try {
    edge.kill()
  } catch {
    /* ignore */
  }
}
