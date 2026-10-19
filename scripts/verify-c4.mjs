#!/usr/bin/env node
/**
 * 步骤 35 走查：C3-R 倾向报告（六档取句）＋ C4 结算节点（三分派 × 分层）
 *
 * 用法：node scripts/verify-c4.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（《开发文档》§3.6 / §3.7.2 / §3.7.3）：
 *   ① 「其一跳过」档：只走过 C3-4（C2-X 未走）→ 报告只报一次原话；
 *   ② 链 A 温吞：T>I 且 T≤3 → 独白「留下来…」＋转场「我留了下来。」→ 断点 A1；
 *   ③ 链 B 温吞：I>T 且 I≤3 → 独白「跟阿禾走…」＋转场「我跟着阿禾去了省城。」→ 断点 B1；
 *   ④ 「双/双」档（真路径）：C1 文化馆 + C2 阿禾 + C2-X C + C3-4 C → (3,3)
 *      → 报告「你说"两条都要"。两次。」＋链 C 坚定＋转场「灯坊的门开着…」→ 链 C → 尾声 → 结局页 END；
 *   ⑤ 「都跳过」档（不可达组合，注入空 stances 验证）：报告「这一路，你没多说什么。」；
 *   ⑥ C4 无任何可选项、独白/转场只出现该档一句（其他档被 when 过滤）；
 *   ⑦ 全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-c4')
const PORT = 9357
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
    `--user-data-dir=${join(tmpdir(), `wb-c4v-${Date.now()}`)}`,
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
  const snap = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('${SAVE}')||'{}');
      return {
        nodeId: s.nodeId, phase: s.phase, missing: s.missingNodeId,
        t: s.state?.tradition, i: s.state?.innovation,
        ending: s.state?.ending, tier: s.state?.endingTier,
        choices: [...document.querySelectorAll('.btn.choice .label')].map(x=>x.textContent.trim()),
        dbox: document.querySelector('.dbox .text')?.textContent?.trim() || '',
      };
    })()`)
  const tap = () => ev(`document.querySelector('.story .stage')?.click()`)
  const advanceUntil = async (pred, timeout = 90000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s && pred(s)) return s
      if (s?.phase === 'input') {
        // 走查中遇到触点：取「最守」的那一档继续（本段不专门测触点）
        await ev(`document.querySelector('.free-input .preset')?.click()`)
        await sleep(450)
        continue
      }
      if (s?.phase === 'choice') {
        await sleep(420)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(500)
        continue
      }
      await tap()
      await sleep(190)
    }
    return null
  }
  /** 收集从当前行到 pred 成立前出现的所有文本（按出现顺序去重） */
  const collectUntil = async (pred, timeout = 90000) => {
    const out = []
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.dbox && !out.includes(s.dbox)) out.push(s.dbox)
      if (s && pred(s)) return out
      await tap()
      await sleep(190)
    }
    return out
  }
  const freshBoot = async () => {
    await send('Page.navigate', { url: URL_ })
    await sleep(900)
    await ev(`localStorage.clear()`)
    await send('Page.navigate', { url: `${URL_}${URL_.includes('?') ? '&' : '?'}v=${Date.now()}` })
    for (let i = 0; i < 40; i++) {
      if (await ev(`!!document.querySelector('.menu-item')`)) return true
      await sleep(300)
    }
    return false
  }
  const jumpTo = async (entry) => {
    await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
    for (let i = 0; i < 30; i++) {
      if (await ev(`!!document.querySelector('.cg-video')`)) break
      await sleep(200)
    }
    await ev(`document.querySelector('.cg-skip')?.click()`)
    await sleep(1300)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(400)
    // 关打字机，加快走查
    await ev(
      `[...document.querySelectorAll('.dev .toggles label')].find(l=>l.textContent.includes('打字机'))?.querySelector('input')?.click()`
    )
    await sleep(200)
    await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('${entry}'))?.click()`)
    await sleep(800)
  }
  const clickPreset = async (idx) => {
    await sleep(300)
    await ev(`[...document.querySelectorAll('.free-input .preset')][${idx}]?.click()`)
    await sleep(450)
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
  let s = null

  /* ===== 段 1：跳章 → C3-4 选 A（守+2）→ 其一跳过 + 链 A 温吞 ===== */
  await freshBoot()
  await jumpTo('C3-1')
  await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
  await clickPreset(0)
  s = await advanceUntil((x) => x.nodeId === 'C3-R')
  const reportA = await collectUntil((x) => x.nodeId !== 'C3-R')
  const reportLineA = reportA.find((t) => t.includes('两次') || t.includes('只说过一次') || t.includes('没多说什么')) || ''
  check(
    '① 其一跳过档：C2-X 未走 → 只报一次原话',
    reportLineA.includes('你只说过一次') && reportLineA.includes('先把手里这根篾弯好'),
    reportLineA.slice(0, 46)
  )
  await shot('01-c3r-once')

  // 报告行收集结束时已进入 C4 首行——此刻核对「无任何可选项」
  const c4Start = await snap()
  const noChoice = c4Start?.nodeId === 'C4' && (c4Start?.choices?.length ?? 0) === 0 && c4Start?.phase === 'lines'
  const c4A = await collectUntil((x) => x.phase === 'break' || x.phase === 'end')
  s = await snap()
  const hasA = c4A.some((t) => t.includes('留下来，把灯坊开起来'))
  const hasA2 = c4A.some((t) => t.includes('开春，我留了下来'))
  const wrongA = c4A.some((t) => t.includes('跟着阿禾去了省城') || t.includes('灯海相连'))
  check(
    '② 链 A 温吞（T>I、T≤3）：独白＋转场只出现该档',
    hasA && hasA2 && !wrongA,
    `独白=${hasA} 转场=${hasA2} 串档=${wrongA}`
  )
  check(
    '③ 结算落点：ending=A / tier=mild → 链 A → 尾声 → 结局页 END',
    s?.nodeId === 'END' && s?.ending === 'A' && s?.tier === 'mild',
    `node=${s?.nodeId} ending=${s?.ending} tier=${s?.tier} missing=${s?.missing}`
  )
  await shot('02-c4-a-mild')

  /* ===== 段 2：跳章 → C3-4 选 B（新+2）→ 链 B 温吞 ===== */
  await freshBoot()
  await jumpTo('C3-1')
  await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
  await clickPreset(1)
  await advanceUntil((x) => x.nodeId === 'C3-R')
  const reportB = await collectUntil((x) => x.nodeId !== 'C3-R')
  const reportLineB = reportB.find((t) => t.includes('两次') || t.includes('只说过一次') || t.includes('没多说什么')) || ''
  const c4B = await collectUntil((x) => x.phase === 'break' || x.phase === 'end')
  s = await snap()
  check(
    '④ 链 B 温吞：独白「跟阿禾走」＋转场「我跟着阿禾去了省城」→ 链 B → 尾声 → 结局页 END',
    c4B.some((t) => t.includes('跟阿禾走，让鱼先游出去')) &&
      c4B.some((t) => t.includes('开春，我跟着阿禾去了省城')) &&
      !c4B.some((t) => t.includes('我把行李搬回了灯坊')) &&
      s?.nodeId === 'END' &&
      s?.ending === 'B' &&
      s?.tier === 'mild',
    `ending=${s?.ending} tier=${s?.tier} missing=${s?.missing}`
  )
  check(
    '④-2 其一跳过档（B 版原话）',
    reportLineB.includes('你只说过一次') && reportLineB.includes('没人递过一根竹篾'),
    reportLineB.slice(0, 46)
  )

  /* ===== 段 3：真路径 → (3,3) 双/双 + 链 C 坚定 ===== */
  await freshBoot()
  // C1：文化馆（守+1）→ 回 C1-3 点第一个（文创店，首次计分已用，0）→ 第三轮自动
  await jumpTo('C1-1')
  await advanceUntil((x) => x.nodeId === 'C1-3' && x.phase === 'choice')
  await sleep(450)
  await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
  await advanceUntil((x) => x.nodeId === 'C1-3' && x.phase === 'choice')
  await sleep(450)
  await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
  // C2：先阿禾（新+1），再九婆（不计分）
  await advanceUntil((x) => x.nodeId === 'C2-0' && x.phase === 'choice')
  await sleep(500)
  await ev(`[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('阿禾'))?.click()`)
  await advanceUntil((x) => x.nodeId === 'C2-0' && x.phase === 'choice')
  await sleep(500)
  await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
  // C2-X 选预设 C（双）→ 直接进 C3-1
  await advanceUntil((x) => x.nodeId === 'C2-X' && x.phase === 'input')
  await clickPreset(2)
  await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
  await clickPreset(2)
  s = await advanceUntil((x) => x.nodeId === 'C3-R')
  check('⑤ 真路径数值达 (3,3)', s?.t === 3 && s?.i === 3, `t/i=${s?.t}/${s?.i}`)
  // 停在报告行本身（不推进到 C4），后面注入 stances 刷新时才会回到 C3-R
  const advanceToText = async (kw, max = 10) => {
    for (let k = 0; k < max; k++) {
      const cur = await snap()
      if (cur?.dbox?.includes(kw)) return cur.dbox
      await tap()
      await sleep(240)
    }
    return ''
  }
  const reportLineC = await advanceToText('两次')
  check(
    '⑥ 双/双档：报告「你说"两条都要"。两次。」',
    reportLineC.includes('两条都要') && reportLineC.includes('两次'),
    reportLineC.slice(0, 46)
  )
  await shot('03-c3r-both')

  /* 段 3b：注入空 stances 验证「都跳过」档（正常游玩不可达：C3-4 不可跳过） */
  await ev(`(() => {
    const k = '${SAVE}';
    const s = JSON.parse(localStorage.getItem(k));
    s.state.stances = [];
    localStorage.setItem(k, JSON.stringify(s));
  })()`)
  await send('Page.reload')
  await sleep(2600)
  await ev(`[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('继续上次'))?.click()`)
  await sleep(1200)
  const reportLineNone = await advanceToText('没多说什么', 6)
  const afterReload = await snap()
  check(
    '⑦ 都跳过档：报告「这一路，你没多说什么。我都记下了。」',
    reportLineNone.includes('这一路，你没多说什么'),
    `node=${afterReload?.nodeId} phase=${afterReload?.phase} 当前行="${afterReload?.dbox?.slice(0, 18)}"｜命中="${reportLineNone.slice(0, 18)}"`
  )

  const c4C = await collectUntil((x) => x.phase === 'break' || x.phase === 'end')
  s = await snap()
  check(
    '⑧ 链 C 坚定（(3,3)）：独白「把灯坊与海连成一片」＋转场「灯坊的门开着」→ 链 C → 尾声 → 结局页 END',
    c4C.some((t) => t.includes('把灯坊与海连成一片')) &&
      c4C.some((t) => t.includes('开春，灯坊的门开着，工作室的灯也亮着')) &&
      s?.nodeId === 'END' &&
      s?.ending === 'C' &&
      s?.tier === 'firm',
    `node=${s?.nodeId} ending=${s?.ending} tier=${s?.tier}`
  )
  await shot('04-c4-c-firm')

  /* ⑨ C4 无选项 */
  check('⑨ C4 结算节点无任何可点选项', noChoice === true, `phase=${c4Start?.phase} choices=${c4Start?.choices?.length}`)

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
