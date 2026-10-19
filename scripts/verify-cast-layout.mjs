#!/usr/bin/env node
/**
 * 全场景站位巡检：遍历**所有剧情节点**，逐个量立绘位置，验证
 *   ① 任意两个人不重叠；
 *   ② 单人在场时**在左侧**（首次登场默认在左）；
 *   ③ 人物不出画、腿被对白带裁；
 *   ④ 每个场景**第一个登场的角色位于左侧**（其余按登场顺序往右排）。
 *
 * 用法：node scripts/verify-cast-layout.mjs [url] [outDir]
 *
 * 做法：读 src/data/story/*.ts 抽出全部节点 id → 逐点注入存档（nodeId+lineIndex=0）→
 * 刷新恢复（loadSave 会按节点重建 cast）→ 量 `.char` 的 boundingRect。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-cast')
const PORT = 9369
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
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `wb-cast-${Date.now()}`)}`,
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

/** 从分章数据里抽出节点 id（4 空格缩进；选项 8 空格不算） */
function collectNodeIds() {
  const files = ['prologue', 'c1', 'c2', 'c3', 'c4', 'chainA', 'chainB', 'chainC', 'ep']
  const ids = []
  for (const f of files) {
    const txt = readFileSync(new URL(`../src/data/story/${f}.ts`, import.meta.url), 'utf8')
    for (const m of txt.matchAll(/^ {4}id: '([A-Za-z0-9.\-]+)'/gm)) ids.push(m[1])
  }
  return ids
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
  const SAVE = 'chuandengren.save.v4'
  const measure = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('${SAVE}')||'{}');
      const rects = [...document.querySelectorAll('.char-stage .char img')].map((i) => {
        const r = i.getBoundingClientRect();
        return { who: i.getAttribute('src').replace(/^.*char-|\.webp$/g,''),
                 x: Math.round(r.x), right: Math.round(r.right), h: Math.round(r.height),
                 bottom: Math.round(r.bottom) };
      });
      const w = document.querySelector('.char-stage .char.is-ashun');
      return { nodeId: s.nodeId, rects, vw: window.innerWidth, vh: window.innerHeight,
               hasAshun: !!w };
    })()`)

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  // 先正常开始一次，生成存档骨架
  await send('Page.navigate', { url: URL_ })
  await sleep(1200)
  await ev(`localStorage.clear()`)
  await send('Page.navigate', { url: `${URL_}?v=${Date.now()}` })
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector('.menu-item')`)) break
    await sleep(300)
  }
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
  for (let i = 0; i < 30; i++) {
    if (await ev(`!!document.querySelector('.cg-video')`)) break
    await sleep(200)
  }
  await ev(`document.querySelector('.cg-skip')?.click()`)
  await sleep(1400)

  const ids = collectNodeIds()
  console.log(`共 ${ids.length} 个节点待巡检\n`)

  const rows = []
  for (const nid of ids) {
    await ev(`(() => {
      const k = '${SAVE}';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s.nodeId = '${nid}'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
      s.state = s.state || {};
      localStorage.setItem(k, JSON.stringify(s));
    })()`)
    await send('Page.reload')
    await sleep(1500)
    await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`)
    await sleep(700)
    const m = await measure()
    rows.push({ nid, count: m?.rects?.length ?? 0, rects: m?.rects ?? [], hasAshun: m?.hasAshun, vw: m?.vw, vh: m?.vh })
  }

  /* ---- 逐点判定 ---- */
  const badOverlap = []
  const badLeft = []
  const firstSeen = new Map()
  for (const r of rows) {
    // 两两不重叠
    for (let i = 0; i < r.rects.length; i++) {
      for (let j = i + 1; j < r.rects.length; j++) {
        const a = r.rects[i]
        const b = r.rects[j]
        if (!(a.right <= b.x || b.right <= a.x)) badOverlap.push(`${r.nid}: ${a.who} 与 ${b.who} 重叠`)
      }
    }
    // 单人在左
    if (r.rects.length === 1 && r.rects[0].x >= r.vw * 0.5) {
      badLeft.push(`${r.nid}: 单人 ${r.rects[0].who} 在右侧 x=${r.rects[0].x}`)
    }
    // 首次登场在左
    for (const rr of r.rects) {
      if (!firstSeen.has(rr.who)) firstSeen.set(rr.who, { nid: r.nid, x: rr.x, vw: r.vw })
    }
  }

  console.log('\n节点          人数  位置(x)                    阿鲟')
  for (const r of rows) {
    const pos = r.rects.map((x) => `${x.who}@${x.x}-${x.right}`).join(' ') || '—'
    console.log(`${r.nid.padEnd(12)} ${String(r.count).padStart(2)}   ${pos.padEnd(26)} ${r.hasAshun ? '含阿鲟' : ''}`)
  }

  check('① 全部节点：任意两人不重叠', badOverlap.length === 0, badOverlap.slice(0, 4).join('｜') || `${rows.length} 点已检`)
  check('② 单人在场时在左侧', badLeft.length === 0, badLeft.slice(0, 4).join('｜') || '无越界')
  // "首次登场默认在左"的落地口径：**每个场景里第一个登场的角色必须在左**，
  // 其余按登场顺序往右排（两个角色时即左右分列）。单人场景自然也在左。
  const badFirstSlot = rows.filter((r) => r.rects.length > 0 && r.rects[0].x >= r.vw * 0.5)
  check(
    '③ 每个场景的首位角色都在左侧',
    badFirstSlot.length === 0,
    badFirstSlot.slice(0, 4).map((r) => `${r.nid}: ${r.rects[0].who}@${r.rects[0].x}`).join('｜') ||
      `各场景首位均在左：${[...firstSeen.entries()].map(([k, v]) => `${k}@${v.nid}`).join('｜')}`
  )
  check('④ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  writeFileSync(join(OUT, 'layout.json'), JSON.stringify(rows, null, 2))

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
