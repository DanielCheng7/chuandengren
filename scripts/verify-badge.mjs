#!/usr/bin/env node
/**
 * 「AI辅助生成」角标走查（2026-10-22 用户要求：左上角、常驻最上层、不抢眼）
 *
 * 用法：node scripts/verify-badge.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:5173/（开发期）或 4173（preview）
 *
 * 验证点：
 *   ① 标题页：存在、在左上角（top ≤ 24 / left ≤ 24）、字号 ≤13px、不拦截点击；
 *   ② 剧情页：仍在，且 `z-index` ≥ 所有已知层（剧情 6／CG 30／竖屏提示 35／面板 40）；
 *   ③ 尾声成片（全屏 `<video>`，z-index 30）：角标仍在最上层——
 *      这是最容易漏的一层，CG 是全屏元素，很容易把它盖掉；
 *   ④ 竖屏（390×844）：角标与竖屏提示不重叠（badge.bottom ≤ hint.top）。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/'
const OUT = resolve(process.argv[3] || '.verify-badge')
const PORT = 9416
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
mkdirSync(OUT, { recursive: true })

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `wb-badge-${Date.now()}`)}`,
    '--window-size=1600,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })
  return r.exceptionDetails ? null : r.result.value
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

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'))
}

/** 角标的几何／样式快照 */
const BADGE = `(() => {
  const el = document.querySelector('.ai-gen-note');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  // elementsFromPoint 只返回可命中元素，pointer-events:none 的永远查不到 →
  // 临时打开命中测试取绘制顺序，取完立刻还原（不改样式表，无副作用）
  const prevPe = el.style.pointerEvents;
  el.style.pointerEvents = 'auto';
  const stackIndex = (document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [])
    .findIndex(n => n === el);
  el.style.pointerEvents = prevPe;
  return {
    text: (el.textContent || '').trim(),
    top: Math.round(r.top), left: Math.round(r.left),
    bottom: Math.round(r.bottom), right: Math.round(r.right),
    w: Math.round(r.width), h: Math.round(r.height),
    z: cs.zIndex, pe: cs.pointerEvents, fs: parseFloat(cs.fontSize),
    color: cs.color,
    // 角标中心点在「绘制顺序」里排第几（0 = 最上面）
    stackIndex,
  };
})()`

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

/* ---------- ① 标题页 ---------- */
const b1 = await ev(BADGE)
check(
  '① 标题页：角标存在、在左上角、字号克制、不吃点击',
  !!b1 &&
    b1.text === 'AI辅助生成' &&
    b1.top <= 24 &&
    b1.left <= 24 &&
    b1.fs <= 13 &&
    b1.pe === 'none',
  b1 ? `"${b1.text}" top=${b1.top} left=${b1.left} ${b1.w}×${b1.h} 字号=${b1.fs} pointer-events=${b1.pe}` : '未找到 .ai-gen-note'
)
await shot('01-title')

/* ---------- ② 剧情页 ---------- */
await ev(
  `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`
)
for (let i = 0; i < 30; i++) {
  if (await ev(`!!document.querySelector('.cg-video')`)) break
  await sleep(200)
}
await ev(`document.querySelector('.cg-skip')?.click()`)
await sleep(1000)
// 直接跳到第二章某个普通节点，保证是纯剧情页
await ev(`(() => {
  const k = 'chuandengren.save.v4';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.nodeId = 'C2-A2'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
  s.state = s.state || {}; s.state.ending = 'A';
  localStorage.setItem(k, JSON.stringify(s));
})()`)
await send('Page.reload')
await sleep(1400)
await ev(
  `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`
)
await sleep(1000)
const b2 = await ev(BADGE)
check(
  '② 剧情页：角标仍在，且 z-index 高于剧情页(6)／CG(30)／竖屏提示(35)／面板(40)',
  !!b2 && Number(b2.z) >= 50 && b2.stackIndex === 0,
  b2 ? `z-index=${b2.z} 绘制顺序第 ${b2.stackIndex} 位` : '未找到'
)
await shot('02-story')

/* ---------- ③ 回看面板（fixed 全屏，z-index 40） ---------- */
await ev(
  `[...document.querySelectorAll('.tool')].find(x => x.textContent.trim() === '回看')?.click()`
)
await sleep(700)
const b4 = await ev(BADGE)
const hasHistory = await ev(`!!document.querySelector('.overlay .list')`)
check(
  '③ 回看面板打开时，角标仍在最上层（面板 z-index 40 < 角标 80）',
  !!b4 && b4.stackIndex === 0 && hasHistory,
  b4 ? `回看在开=${hasHistory} 绘制顺序第 ${b4.stackIndex} 位` : '未找到'
)
await shot('03-history')
await ev(`document.querySelector('.overlay .back')?.click()`)
await sleep(500)

/* ---------- ④ 尾声成片（全屏 video，z-index 30） ---------- */
await ev(`(() => {
  const k = 'chuandengren.save.v4';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.nodeId = 'EP-CG'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
  localStorage.setItem(k, JSON.stringify(s));
})()`)
await send('Page.reload')
await sleep(1400)
await ev(
  `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`
)
await sleep(2200)
const b3 = await ev(BADGE)
const hasCg = await ev(`!!document.querySelector('.cg-video')`)
check(
  '④ 尾声成片全屏播放时，角标仍在最上层（不被 <video> 盖住）',
  !!b3 && b3.stackIndex === 0 && hasCg,
  b3 ? `CG 在播=${hasCg} 绘制顺序第 ${b3.stackIndex} 位` : '未找到'
)
await shot('04-ep-cg')

/* ---------- ⑤ 竖屏：不与竖屏提示重叠 ---------- */
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
})
await send('Page.reload')
await sleep(1600)
const geo = await ev(`(() => {
  const b = document.querySelector('.ai-gen-note');
  const h = document.querySelector('.orient-hint');
  if (!b) return null;
  const rb = b.getBoundingClientRect();
  const rh = h ? h.getBoundingClientRect() : null;
  return {
    badge: { top: Math.round(rb.top), bottom: Math.round(rb.bottom), left: Math.round(rb.left) },
    hint: rh ? { top: Math.round(rh.top), bottom: Math.round(rh.bottom) } : null,
  };
})()`)
check(
  '⑤ 竖屏：角标与「横屏游玩更佳」提示不重叠',
  !!geo && (!geo.hint || geo.badge.bottom <= geo.hint.top),
  geo?.hint
    ? `角标底=${geo.badge.bottom} 提示顶=${geo.hint.top}`
    : `角标左边距=${geo?.badge.left}（无提示）`
)
await shot('05-portrait')

await send('Emulation.clearDeviceMetricsOverride')
ws.close()
edge.kill()
console.log(`\n=== 汇总 ===\nPASS ${pass} / ${pass + fail}`)
process.exit(fail ? 1 : 0)
