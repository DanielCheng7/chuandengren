#!/usr/bin/env node
/**
 * 链 A／链 B 走查（步骤 36）
 *
 * 用法：node scripts/verify-chains.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（《开发文档》§3.6／§3.7.3）：
 *   ① 链 A：C4 → A1 → A2 → A3 → END-A → 结局页《灯还亮着》；
 *   ② 结局 A **代价段三版互斥**：T≥4（老灯还在玻璃里）／T=3（店换三茬货）／T=2（夜市九块九）；
 *   ③ 链 B：C4 → B1 → B2 → B3 → END-B → 结局页《鱼入海》；
 *   ④ B3 数据口径：观展 11 万／进坊 5140／常客 130；
 *   ⑤ 两条链内场景切换与「抉择回响」旁白正常，全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-chains')
const PORT = 9361
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
    `--user-data-dir=${join(tmpdir(), `wb-chain-${Date.now()}`)}`,
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
        dbox: document.querySelector('.dbox .text')?.textContent?.trim() || '',
        body: document.body.innerText,
        choices: document.querySelectorAll('.btn.choice').length,
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
  const jumpTo = async (entry, closePanel = true) => {
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
    if (closePanel) {
      await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
      await sleep(250)
    }
  }
  /** 推进到触点界面（input 阶段） */
  const playToInput = async (timeout = 90000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.phase === 'input') {
        await sleep(320)
        return s
      }
      if (s?.phase === 'choice') {
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
  /**
   * 直奔链 C 并指定分层：跳 C3-1 → C3-4 选 C → 注入 (t,i,ending,tier) → 刷新继续。
   * 链 C 的 (2,2) 在正常游玩里要靠 C3-4 自由输入判 0/0，实跑不稳定，这里用注入构造。
   */
  const runChainC = async (t, i, tier) => {
    await freshBoot()
    await jumpTo('C3-1')
    await playToInput()
    await ev(`[...document.querySelectorAll('.free-input .preset')][2]?.click()`)
    await sleep(700)
    await ev(`(() => {
      const k = '${SAVE}';
      const s = JSON.parse(localStorage.getItem(k));
      s.state.tradition = ${t};
      s.state.innovation = ${i};
      s.state.ending = 'C';
      s.state.endingTier = '${tier}';
      localStorage.setItem(k, JSON.stringify(s));
    })()`)
    await send('Page.reload')
    await sleep(2500)
    await ev(`[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('继续上次'))?.click()`)
    await sleep(1200)
    return await playToEnd(2)
  }

  /**
   * 从当前位置一路玩到结局页：**边推进边收集行文本**，遇选项／触点自动作答。
   * 顺序很重要——必须先收集当前行再推进，否则会漏掉进入结局前的那几行。
   */
  const playToEnd = async (presetIdx = 0, timeout = 180000) => {
    const out = []
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.dbox && !out.includes(s.dbox)) out.push(s.dbox)
      if (s?.phase === 'end') return { lines: out, snap: s }
      if (s?.phase === 'break') return { lines: out, snap: s }
      if (s?.phase === 'input') {
        await sleep(300)
        await ev(`[...document.querySelectorAll('.free-input .preset')][${presetIdx}]?.click()`)
        await sleep(500)
        continue
      }
      if (s?.phase === 'choice') {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(170)
    }
    return { lines: out, snap: null }
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  /* ===== 段 1：链 A（T=2：跳章后 C3-4 选 A，守 +2）===== */
  await freshBoot()
  await jumpTo('C3-1')
  const aRun = await playToEnd(0)
  const aLines = aRun.lines
  check(
    '① 链 A：走到结局页，T=2 走「夜市九块九」代价段',
    aRun.snap?.ending === 'A' &&
      aLines.some((t) => t.includes('夜市上还挂着九块九')) &&
      !aLines.some((t) => t.includes('县里那盏老灯还在玻璃里躺着')) &&
      !aLines.some((t) => t.includes('换了三茬货')),
    `ending=${aRun.snap?.ending} t/i=${aRun.snap?.t}/${aRun.snap?.i} 行数=${aLines.length}`
  )
  check(
    '② 结局 A 页显示《灯还亮着》',
    typeof aRun.snap?.body === 'string' && aRun.snap.body.includes('灯还亮着'),
    (aRun.snap?.body || '').slice(0, 40).replace(/\n/g, ' ')
  )
  await shot('01-ending-a-t2')

  /* ===== 段 2：链 A 真路径（T≥4 → 代价段第一版）===== */
  await freshBoot()
  await jumpTo('C1-1')
  // C1：文化馆（守+1）→ 三轮补看（余下两项随意）
  {
    let guard = Date.now()
    while (Date.now() - guard < 120000) {
      const cur = await snap()
      if (cur?.nodeId === 'C2-0' && cur.phase === 'choice') break
      if (cur?.phase === 'choice') {
        await sleep(420)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(170)
    }
  }
  // C2：九婆 → 阿禾 → C2-X 预设 A → C3-4 预设 A
  {
    let guard = Date.now()
    let picked = 0
    while (Date.now() - guard < 120000) {
      const cur = await snap()
      if (cur?.phase === 'input') {
        await sleep(300)
        await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
        await sleep(500)
        if (cur.nodeId === 'C3-4') break
        continue
      }
      if (cur?.phase === 'choice') {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        picked += 1
        continue
      }
      await tap()
      await sleep(170)
    }
  }
  const a2 = await playToEnd(0)
  check(
    '③ 链 A 真路径（T≥4）：走「老灯还在玻璃里躺着」代价段',
    a2.snap?.ending === 'A' &&
      (a2.snap?.t ?? 0) >= 4 &&
      a2.lines.some((t) => t.includes('县里那盏老灯还在玻璃里躺着')),
    `ending=${a2.snap?.ending} t/i=${a2.snap?.t}/${a2.snap?.i}`
  )
  await shot('02-ending-a-t4')

  /* ===== 段 3：链 B（跳章 → C3-4 选 B）===== */
  await freshBoot()
  await jumpTo('C3-1')
  const bRun = await playToEnd(1)
  const bLines = bRun.lines
  check(
    '④ 链 B：走到结局页，B3 数据口径 11 万／5140／130',
    bRun.snap?.ending === 'B' &&
      bLines.some((t) => t.includes('11 万人次')) &&
      bLines.some((t) => t.includes('5140')) &&
      bLines.some((t) => t.includes('130 人')),
    `ending=${bRun.snap?.ending} i/t=${bRun.snap?.i}/${bRun.snap?.t}`
  )
  check(
    '⑤ 结局 B 页显示《鱼入海》',
    typeof bRun.snap?.body === 'string' && bRun.snap.body.includes('鱼入海'),
    (bRun.snap?.body || '').slice(0, 40).replace(/\n/g, ' ')
  )
  check(
    '⑥ 结局 B 正文含「屏幕是河，灯坊是海」',
    bLines.some((t) => t.includes('屏幕是河，灯坊是海')),
    bLines.filter((t) => t.includes('屏幕是河')).join(' | ').slice(0, 40)
  )
  await shot('03-ending-b')

  /* ===== 段 4：链 C 坚定版（(3,3)，含末帧双灯彩蛋）===== */
  const cFirm = await runChainC(3, 3, 'firm')
  check(
    '⑧ 链 C 坚定（(3,3)）：E1「两笔账，一样重」＋结局「两头的灯火」＋结局页《灯海相连》',
    cFirm.snap?.ending === 'C' &&
      cFirm.snap?.tier === 'firm' &&
      cFirm.lines.some((t) => t.includes('两笔账，一样重')) &&
      cFirm.lines.some((t) => t.includes('走成了两头的灯火')) &&
      !cFirm.lines.some((t) => t.includes('两条路都没走满')) &&
      typeof cFirm.snap?.body === 'string' &&
      cFirm.snap.body.includes('灯海相连'),
    `ending=${cFirm.snap?.ending} tier=${cFirm.snap?.tier} 行数=${cFirm.lines.length}`
  )
  await shot('04-ending-c-firm')

  /* ===== 段 5：链 C 温吞版（(2,2)）===== */
  const cMild = await runChainC(2, 2, 'mild')
  check(
    '⑨ 链 C 温吞（(2,2)）：E1「两条路我都试了」＋结局「两条路都没走满」',
    cMild.snap?.ending === 'C' &&
      cMild.snap?.tier === 'mild' &&
      cMild.lines.some((t) => t.includes('两条路我都试了，都不算深')) &&
      cMild.lines.some((t) => t.includes('两条路都没走满，但都留着')) &&
      !cMild.lines.some((t) => t.includes('两笔账，一样重')) &&
      typeof cMild.snap?.body === 'string' &&
      cMild.snap.body.includes('灯海相连'),
    `ending=${cMild.snap?.ending} tier=${cMild.snap?.tier} 行数=${cMild.lines.length}`
  )
  await shot('05-ending-c-mild')

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
  edge.kill()
  process.exit(process.exitCode ?? 0)
}
