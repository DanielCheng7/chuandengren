#!/usr/bin/env node
/**
 * 自动播放（AUTO）验收
 *
 * 用法：node scripts/verify-autoplay.mjs [url] [outDir]
 *   默认 http://127.0.0.1:4173/（先在 app/ 下 npm run build && npm run preview）
 *
 * 语义（用户 2026-10-19 要求）：
 *   · 自动逐行推进正文，可随时开／关；
 *   · **遇到选项分支自动暂停并关闭**，玩家做出选择后**不恢复**自动播放。
 *
 * 验证点：
 *   ① 默认关闭：进入剧情后静置 6s，行不前进；
 *   ② 点 HUD「自动」→ 逐行自动推进（lineIndex / nodeId 前进且不需点击）；
 *   ③ 推进到选项节点 → 自动播放**自行关闭**（按钮熄灭 + settings.autoPlay=false）；
 *   ④ 选项停留期间不会替玩家做选择（phase 恒为 choice，nodeId 不变）；
 *   ⑤ 玩家点选项后 8s，剧情停在下一节点首行 —— **不恢复**自动；
 *   ⑥ 手动重新开启后能继续自动推进；
 *   ⑦ 打开「回看」覆盖层 → 推进暂停，关闭后恢复；
 *   ⑧ 刷新后回标题再进（继续上次）→ 自动播放为关闭（不跨会话记忆）；
 *   ⑨ 全程 console 无 error。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { AUDIO_MOCK } from './lib/audio-mock.mjs'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-autoplay')
const PORT = 9373
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
    `--user-data-dir=${join(tmpdir(), `wb-auto-${Date.now()}`)}`,
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
  const SAVE = 'chuandengren.save.v4'
  const probe = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('${SAVE}') || '{}');
      const autoBtn = [...document.querySelectorAll('.tool')].find(b => b.textContent.trim() === '自动');
      const st = JSON.parse(localStorage.getItem('chuandengren.settings.v4') || '{}');
      return {
        nodeId: s.nodeId, lineIndex: s.lineIndex, phase: s.phase,
        autoOn: autoBtn ? autoBtn.getAttribute('aria-pressed') === 'true' : null,
        autoLit: !!autoBtn && autoBtn.classList.contains('is-on'),
        settingAuto: st.autoPlay,
        text: (document.querySelector('.dbox .text')?.textContent || '').trim().slice(0, 20),
        choices: document.querySelectorAll('.btn.choice').length,
        historyOpen: !!document.querySelector('.overlay'),
      };
    })()`)
  const clickAuto = () =>
    ev(`[...document.querySelectorAll('.tool')].find(b => b.textContent.trim() === '自动')?.click()`)

  await send('Page.enable')
  // 用静音 data URI 顶替真实 mp3：浏览器不发音频请求，IDM 之类的下载管理器不会弹窗
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIO_MOCK })
  await send('Runtime.enable')
  // 无头浏览器会把音频当下载写进系统音乐目录，这里一律拒绝
  try {
    await send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* 旧版 CDP 无此命令 */
  }

  /* ---------- 进剧情（跳过 CG 与序章） ---------- */
  const enterStory = async (clear = true) => {
    await send('Page.navigate', { url: URL_ })
    await sleep(700)
    if (clear) await ev(`localStorage.clear()`)
    await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}v=${Date.now()}` })
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.menu-item')`)) break
      await sleep(250)
    }
    await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
    for (let i = 0; i < 40; i++) {
      const hasCg = await ev(`!!document.querySelector('.cg-video')`)
      if (hasCg) {
        await ev(`document.querySelector('.cg-skip')?.click()`)
        break
      }
      await sleep(250)
    }
    // 序章蒙太奇：直接跳到第一章
    await sleep(1000)
    await ev(`[...document.querySelectorAll('.tool')].find(b => b.textContent.includes('跳过序章'))?.click()`)
    await sleep(1000)
    for (let i = 0; i < 30; i++) {
      const s = await probe()
      if (s && s.phase === 'lines' && s.nodeId) return s
      await sleep(200)
    }
    return await probe()
  }

  if (!(await enterStory())) throw new Error('未进入剧情')
  await sleep(600)

  /* ---------- ① 默认关闭：静置 6s 不动 ---------- */
  const a0 = await probe()
  await sleep(6000)
  const a1 = await probe()
  check(
    '① 默认不自动推进（静置 6s）',
    !!a0 && !!a1 && a0.nodeId === a1.nodeId && a0.lineIndex === a1.lineIndex && a1.autoOn === false,
    `${a0?.nodeId}#${a0?.lineIndex} → ${a1?.nodeId}#${a1?.lineIndex}`
  )
  await shot('01-off')

  /* ---------- ② 开启后自动推进 ---------- */
  await clickAuto()
  await sleep(300)
  const b0 = await probe()
  const moved = []
  let lastKey = `${b0.nodeId}#${b0.lineIndex}`
  const t0 = Date.now()
  while (Date.now() - t0 < 22000) {
    const s = await probe()
    if (s) {
      const key = `${s.nodeId}#${s.lineIndex}`
      if (key !== lastKey) {
        moved.push(key)
        lastKey = key
      }
      if (s.phase === 'choice') break
    }
    await sleep(400)
  }
  check(
    '② 开启后自动逐行推进',
    !!b0 && b0.autoOn === true && moved.length >= 2,
    `前进 ${moved.length} 次（${moved.slice(0, 3).join(' → ')}）`
  )

  /* ---------- ③④ 到选项 → 自动关闭且不替玩家选 ---------- */
  let atChoice = null
  for (let i = 0; i < 60; i++) {
    const s = await probe()
    if (s?.phase === 'choice') {
      atChoice = s
      break
    }
    if (s?.phase === 'lines') await sleep(500)
    else await sleep(300)
  }
  await sleep(700)
  const c0 = await probe()
  check(
    '③ 遇选项自动关闭自动播放',
    !!c0 && c0.phase === 'choice' && c0.autoOn === false && c0.settingAuto === false,
    c0 ? `phase=${c0.phase} 按钮=${c0.autoOn} 设置=${c0.settingAuto}` : ''
  )
  await shot('02-choice')
  await sleep(5000)
  const c1 = await probe()
  check(
    '④ 选项停留不被自动选择',
    !!c1 && c1.phase === 'choice' && c1.nodeId === c0.nodeId && c1.choices >= 2,
    `5s 后仍为 ${c1?.phase}（${c1?.choices} 个选项）`
  )

  /* ---------- ⑤ 选完后不恢复 ---------- */
  await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
  await sleep(900)
  const d0 = await probe()
  await sleep(8000)
  const d1 = await probe()
  check(
    '⑤ 选择后不恢复自动播放',
    !!d0 && !!d1 && d0.nodeId === d1.nodeId && d0.lineIndex === d1.lineIndex && d1.autoOn === false,
    `${d0?.nodeId}#${d0?.lineIndex} → ${d1?.nodeId}#${d1?.lineIndex}（8s 未动）`
  )

  /* ---------- ⑥ 手动再开仍生效 ---------- */
  await clickAuto()
  await sleep(300)
  const e0 = await probe()
  let advanced = false
  for (let i = 0; i < 40; i++) {
    const s = await probe()
    if (s && (s.nodeId !== e0.nodeId || s.lineIndex !== e0.lineIndex)) {
      advanced = true
      break
    }
    if (s?.phase === 'choice' || s?.phase === 'input') break
    await sleep(500)
  }
  check('⑥ 手动重新开启后继续自动推进', !!e0 && e0.autoOn === true && advanced)

  /* ---------- ⑦ 回看覆盖层暂停 ---------- */
  await ev(`[...document.querySelectorAll('.tool')].find(b => b.textContent.trim() === '回看')?.click()`)
  await sleep(600)
  const f0 = await probe()
  await sleep(6000)
  const f1 = await probe()
  check(
    '⑦ 回看打开时暂停推进',
    !!f0 && !!f1 && f0.historyOpen && f0.nodeId === f1.nodeId && f0.lineIndex === f1.lineIndex,
    `回看开=${f0?.historyOpen}；${f0?.lineIndex} → ${f1?.lineIndex}`
  )
  await shot('03-history')
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await sleep(900)
  const g0 = await probe()
  let resumed = false
  for (let i = 0; i < 30; i++) {
    const s = await probe()
    if (s && g0 && (s.nodeId !== g0.nodeId || s.lineIndex !== g0.lineIndex)) {
      resumed = true
      break
    }
    if (s?.phase === 'choice' || s?.phase === 'input') break
    await sleep(500)
  }
  check('⑦-2 关闭回看后恢复自动推进', resumed)

  /* ---------- ⑧ 不跨会话记忆 ---------- */
  await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}again=${Date.now()}` })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.menu-item')`)) break
    await sleep(250)
  }
  await sleep(400)
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`)
  await sleep(1400)
  const h1 = await probe()
  check(
    '⑧ 刷新后自动播放为关闭',
    !!h1 && h1.autoOn === false,
    h1 ? `按钮=${h1.autoOn}（存档残留=${h1.settingAuto}）` : ''
  )

  /* ---------- ⑨ console ---------- */
  check('⑨ console 无 error', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

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
