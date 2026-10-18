#!/usr/bin/env node
/**
 * 第三章（C3）自动走查（CDP + 系统 Edge，headless）
 *
 * 用法：node scripts/verify-c3.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/（先 npm run build && npm run preview）
 *
 * 验证点（V3.0／剧本 r8，《开发文档》§2.3 / §3.5 / §3.7）：
 *   ① 跳 C3-1：章节「第三章·灯会前夜」、场景 banyan_night；
 *   ② C3-4 触点②：phase=input、3 预设、**无「跳过」**、提交按钮文案为「用这句话回答九婆」；
 *   ③ 预设 A → C3-5（不分支）、守 +2／新 0、stances 记录 1 条；
 *   ④ C3-8 共识框架以 quote 行呈现（`.dbox.t-quote`）、四行标题齐全；
 *   ⑤ T>I 时 C3-8 播完**自动进入 C3-A**（不弹选项）；
 *   ⑥ 重开走 B → C3-B（I>T）；重开走 C → C3-C（T=I）；
 *   ⑦ 自由输入：阿鲟复述 + 报倾向后，九婆接「你说的，我听着了。」；
 *   ⑧ 全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-c3')
const PORT = 9351
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
    `--user-data-dir=${join(tmpdir(), `wb-c3v-${Date.now()}`)}`,
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
      const devRows = document.querySelectorAll('.dev .rows:not(.vars) > div');
      return {
        nodeId: s.nodeId, phase: s.phase, missing: s.missingNodeId,
        section: devRows[1]?.querySelector('dd')?.textContent?.trim() || '',
        scene: devRows[2]?.querySelector('dd')?.textContent?.trim() || '',
        t: s.state?.tradition, i: s.state?.innovation,
        stances: (s.state?.stances||[]).map(x=>x.nodeId+':'+x.source+':'+x.presetKey+':'+x.tradition+'/'+x.innovation),
        choices: [...document.querySelectorAll('.btn.choice .label')].map(x=>x.textContent.trim()),
        inputShown: !!document.querySelector('.free-input'),
        presets: [...document.querySelectorAll('.free-input .preset .label')].map(x=>x.textContent.trim()),
        hasSkip: !!document.querySelector('.free-input .skip'),
        submitLabel: document.querySelector('.free-input .submit')?.textContent?.trim() || '',
        dbox: document.querySelector('.dbox .text')?.textContent?.trim() || '',
        dboxOpacity: getComputedStyle(document.querySelector('.dbox') || document.body).opacity,
        isQuote: !!document.querySelector('.dbox.t-quote'),
      };
    })()`)
  const dboxText = () => ev(`document.querySelector('.dbox .text')?.textContent?.trim() || ''`)
  const tap = () => ev(`document.querySelector('.story .stage')?.click()`)
  const advanceUntil = async (pred, timeout = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s && pred(s)) return s
      await tap()
      await sleep(190)
    }
    return null
  }
  /** 进入 C3 前的干净启动：清档 → 重载 → 标题页 */
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
  /** 开始旅程 → 跳过开场 CG → 调试面板跳 C3-1 */
  const jumpToC3 = async () => {
    await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('开始旅程'))?.click()`)
    for (let i = 0; i < 30; i++) {
      if (await ev(`!!document.querySelector('.cg-video')`)) break
      await sleep(200)
    }
    await ev(`document.querySelector('.cg-skip')?.click()`)
    await sleep(1300)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(400)
    await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('C3-1'))?.click()`)
    await sleep(900)
  }
  /** 一条完整分支：进 C3 → 推进到 C3-4 → 选第 n 个预设 → 等自动进入 C3-A/B/C */
  const runBranch = async (presetIdx, target) => {
    await freshBoot()
    await jumpToC3()
    const entered = await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
    if (!entered) return null
    await ev(`[...document.querySelectorAll('.free-input .preset')][${presetIdx}]?.click()`)
    await sleep(400)
    return await advanceUntil((x) => x.nodeId === target)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  /* ===== 段 1：守旧路径（预设 A） ===== */
  await freshBoot()
  await jumpToC3()
  let s = await snap()
  check(
    '① 跳 C3-1：段落 C3-1｜提案 · 场景 banyan_night',
    s?.nodeId === 'C3-1' && s.section.includes('C3-1') && s.scene === 'banyan_night',
    `node=${s?.nodeId} section=${s?.section} scene=${s?.scene}`
  )
  await shot('01-c3-1')

  s = await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
  check('② 推进至 C3-4（触点②）进入输入界面', !!s, `node=${s?.nodeId} phase=${s?.phase}`)
  await sleep(600)
  s = await snap()
  check(
    '②-2 C3-4：3 预设 + 无跳过 + 按钮文案「回答九婆」',
    s?.inputShown === true &&
      s.presets.length === 3 &&
      s.hasSkip === false &&
      s.submitLabel.includes('九婆'),
    `presets=${s?.presets.length} skip=${s?.hasSkip} submit=${s?.submitLabel}`
  )
  check(
    '②-3 输入阶段对白框隐去（保留占位）',
    s?.dboxOpacity === '0',
    `dbox.opacity=${s?.dboxOpacity}`
  )
  await shot('02-c3-4-stance')

  await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
  // 等打字机把收束台词打完（约 26 字，实测 1.3s 内），再取文本断言
  await sleep(1600)
  const closeA = await dboxText()
  s = await advanceUntil((x) => x.nodeId === 'C3-5')
  check(
    '③ 预设 A → C3-5（不分支）、守 +2／新 0、stances 1 条',
    !!s && s.t === 2 && s.i === 0 && s.stances.length === 1,
    `node=${s?.nodeId} t/i=${s?.t}/${s?.i} stances=${JSON.stringify(s?.stances)}`
  )
  check('③-2 预设 A 的九婆收束台词出现', closeA.includes('先把骨头立住'), closeA.slice(0, 40))

  /* ④ C3-8 共识框架以 quote 呈现 */
  s = await advanceUntil((x) => x.nodeId === 'C3-8')
  let quoteSeen = false
  for (let k = 0; k < 14; k++) {
    const cur = await snap()
    if (cur?.isQuote && cur.dbox) {
      quoteSeen = true
      break
    }
    await tap()
    await sleep(230)
  }
  const quoteRow = await dboxText()
  check('④ C3-8 共识框架以 quote 行呈现', quoteSeen, quoteRow.slice(0, 30))
  await shot('03-c3-8-quote')

  /* ⑤ 自动进入 C3-A */
  s = await advanceUntil((x) => x.nodeId === 'C3-A')
  check(
    '⑤ T>I：C3-8 播完自动进入 C3-A（不弹选项）',
    !!s && s.choices.length === 0,
    `node=${s?.nodeId} choices=${s?.choices.length}`
  )
  await shot('04-c3-a')

  /* ===== 段 2：创新路径（预设 B） → C3-B ===== */
  s = await runBranch(1, 'C3-B')
  check(
    '⑥ I>T：预设 B → C3-B（自动·无选项）',
    !!s && s.choices.length === 0 && s.i === 2 && s.t === 0,
    `node=${s?.nodeId} t/i=${s?.t}/${s?.i}`
  )
  await shot('05-c3-b')

  /* ===== 段 3：平衡路径（预设 C） → C3-C ===== */
  s = await runBranch(2, 'C3-C')
  check(
    '⑦ T=I：预设 C → C3-C（自动·无选项）',
    !!s && s.choices.length === 0 && s.t === 1 && s.i === 1,
    `node=${s?.nodeId} t/i=${s?.t}/${s?.i}`
  )
  await shot('06-c3-c')

  /* ===== 段 4：自由输入 → 阿鲟判定 + 九婆收束 ===== */
  await freshBoot()
  await jumpToC3()
  s = await advanceUntil((x) => x.nodeId === 'C3-4' && x.phase === 'input')
  await ev(`(() => {
    const ta = document.querySelector('.free-input .field');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '先把手里这根篾弯好，手艺得沉下心慢慢练。');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await sleep(300)
  const canSubmit = await ev(`!document.querySelector('.free-input .submit')?.disabled`)
  await ev(`document.querySelector('.free-input .submit')?.click()`)
  let freeJudgeSeen = false
  let nineSaid = ''
  for (let k = 0; k < 12; k++) {
    const t = await dboxText()
    if (t.includes('倾向：')) freeJudgeSeen = true
    if (t.includes('你说的，我听着了')) {
      nineSaid = t
      break
    }
    await tap()
    await sleep(240)
  }
  check('⑧ 自由输入可提交并走 AI 判定', canSubmit === true && freeJudgeSeen === true, `canSubmit=${canSubmit}`)
  check('⑨ 自由输入后九婆接「你说的，我听着了。」', nineSaid.includes('你说的，我听着了'), nineSaid.slice(0, 40))
  await shot('07-c3-4-free')

  check('⑩ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  /* ===== 段 5：第二章 → 第三章真实衔接（C2-AA 播完自动进 C3-1，不再落断点） ===== */
  await freshBoot()
  await jumpToC3() // 结束后调试面板仍开着
  await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('C2-0'))?.click()`)
  await sleep(700)
  await sleep(600) // 等选项 ready 门控（300ms）
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('九婆'))?.click()`)
  await advanceUntil((x) => x.nodeId === 'C2-A')
  await advanceUntil((x) => x.nodeId === 'C2-0' && x.choices.length > 0)
  await sleep(600)
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('阿禾'))?.click()`)
  s = await advanceUntil((x) => x.nodeId === 'C2-X' && x.phase === 'input')
  if (s) {
    await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
    await sleep(300)
  }
  s = await advanceUntil((x) => x.nodeId === 'C3-1')
  check(
    '⑪ 第二章 C2-AA 播完自动进入 C3-1（无断点屏）',
    !!s && s.missing === null && s.nodeId === 'C3-1',
    `node=${s?.nodeId} missing=${s?.missing}`
  )
  await shot('08-c2-to-c3')

  /* ===== 段 6：行样式纪律（名字用色 / 台词引号 / 旁白无引号 / 阿鲟立绘） ===== */
  // 关打字机，保证采样到完整整行（面板此时开着）
  await ev(
    `[...document.querySelectorAll('.dev .toggles label')].find(l=>l.textContent.includes('打字机'))?.querySelector('input')?.click()`
  )
  await sleep(200)
  // 收起调试面板，避免遮挡与误触
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
  await sleep(400)
  // 回到 C3-1 重走一遍（保证采样从章首开始）
  s = await ev(`JSON.parse(localStorage.getItem('chuandengren.save.v4')||'{}').nodeId`)
  if (s !== 'C3-1') {
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(300)
    await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('C3-1'))?.click()`)
    await sleep(600)
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(400)
  }
  const seen = []
  const tEnd = Date.now() + 120000
  while (Date.now() < tEnd) {
    const cur = await ev(`(() => {
      const nm = document.querySelector('.dbox .name')?.textContent?.trim() || '';
      const tx = document.querySelector('.dbox .text')?.textContent?.trim() || '';
      const img = document.querySelector('.char-layer img');
      const s = JSON.parse(localStorage.getItem('chuandengren.save.v4')||'{}');
      // 名字色 → rgb（CSS 变量是 hex）
      const hex2rgb = (h) => { const x = (h||'').trim().replace('#',''); const n = parseInt(x.length===3?x.split('').map(c=>c+c).join(''):x,16); return isNaN(n)?'':\`rgb(\${(n>>16)&255}, \${(n>>8)&255}, \${n&255})\` };
      const cs = getComputedStyle(document.documentElement);
      const nameEl = document.querySelector('.dbox .name');
      return {
        nm, tx, nodeId: s.nodeId, phase: s.phase,
        color: nameEl ? getComputedStyle(nameEl).color : '',
        vars: {
          paper: hex2rgb(cs.getPropertyValue('--paper')),
          gold: hex2rgb(cs.getPropertyValue('--gold')),
          bamboo: hex2rgb(cs.getPropertyValue('--bamboo')),
          candle: hex2rgb(cs.getPropertyValue('--candle')),
        },
        charImg: img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null,
      };
    })()`)
    if (cur?.tx && !seen.some((x) => x.nm === cur.nm && x.tx === cur.tx)) seen.push(cur)
    if (cur && ['C3-A', 'C3-B', 'C3-C'].includes(cur.nodeId)) break
    // 走到 C3-4 触点界面：舞台点击无效，选一个预设继续（本段只验文字/颜色，不看数值）
    if (cur?.phase === 'input') {
      await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
      await sleep(500)
      continue
    }
    await tap()
    await sleep(240)
  }
  const findColor = (n) => seen.find((x) => x.nm.includes(n))?.color || ''
  const v = seen[0]?.vars || {}
  check(
    '⑫ 名字用色统一纱纸白（2026-10-18 用户决议：不再按角色分色）',
    ['九婆', '阿鲟', '阿禾', '知遥', '周经理'].every((n) => findColor(n) === v.paper),
    `九婆=${findColor('九婆')} 阿鲟=${findColor('阿鲟')} 阿禾=${findColor('阿禾')} 知遥=${findColor('知遥')} 周=${findColor('周经理')}｜names=${[...new Set(seen.map((x) => x.nm))].join(',')}`
  )
  const dialogLines = seen.filter((x) => x.nm)
  const narLines = seen.filter((x) => !x.nm && !x.tx.startsWith('一、') && !x.tx.startsWith('二、') && !x.tx.startsWith('三、') && !x.tx.startsWith('四、') && !x.tx.startsWith('竹骨') && !x.tx.startsWith('灯不怕') && !x.tx.startsWith('招手'))
  // 行尾的光标符 ▾ 属于渲染标记，比对前剥掉
  const clean = (t) => t.replace(/[▾\s]+$/, '')
  const badDialog = dialogLines.filter((x) => !(clean(x.tx).startsWith('「') && clean(x.tx).endsWith('」')))
  const badNar = narLines.filter((x) => clean(x.tx).startsWith('「'))
  check(
    '⑬ 台词「」包裹、旁白不加引号',
    dialogLines.length > 10 && narLines.length >= 3 && badDialog.length === 0 && badNar.length === 0,
    `台词 ${dialogLines.length} 行／旁白 ${narLines.length} 行／异常 ${badDialog.length + badNar.length}${
      badDialog[0] ? `｜样本 ${badDialog[0].nm}${badDialog[0].tx.slice(0, 20)}` : ''
    }`
  )
  const ashunImg = seen.find((x) => x.nm.includes('阿鲟') && x.charImg)
  check(
    '⑭ 阿鲟对白时浮出立绘 char-ashun.webp（已加载）',
    !!ashunImg && ashunImg.charImg.src.includes('char-ashun') && ashunImg.charImg.w > 0,
    ashunImg ? `${ashunImg.charImg.src} w=${ashunImg.charImg.w}` : '未捕获'
  )
  check('⑮ 自检段无新增 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  /* ===== 段 7：转场（C2-AA studio_night → C3-1 banyan_night：交叉淡出 + 花光 + 水印） ===== */
  await freshBoot()
  await jumpToC3()
  await ev(
    `[...document.querySelectorAll('.dev .toggles label')].find(l=>l.textContent.includes('打字机'))?.querySelector('input')?.click()`
  )
  await ev(`[...document.querySelectorAll('.dev .mini')].find(b => b.textContent.includes('C2-0'))?.click()`)
  await sleep(1300)
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('九婆'))?.click()`)
  await advanceUntil((x) => x.nodeId === 'C2-A')
  await advanceUntil((x) => x.nodeId === 'C2-0' && x.choices.length > 0)
  await sleep(600)
  await ev(`[...document.querySelectorAll('.btn.choice')].find(b => b.textContent.includes('阿禾'))?.click()`)
  s = await advanceUntil((x) => x.nodeId === 'C2-X' && x.phase === 'input')
  if (s) {
    await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
    await sleep(400)
  }
  s = await advanceUntil((x) => x.nodeId === 'C2-AA')
  // 收起调试面板，转场截图才干净
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
  await sleep(300)
  const tTr = Date.now()
  let transited = false
  while (Date.now() - tTr < 70000) {
    const cur = await ev(`JSON.parse(localStorage.getItem('chuandengren.save.v4')||'{}').nodeId`)
    if (cur === 'C3-1') {
      transited = true
      await shot('09-transition-0ms')
      await sleep(320)
      await shot('09-transition-320ms')
      await sleep(650)
      await shot('09-transition-970ms')
      break
    }
    await tap()
    await sleep(200)
  }
  check('⑯ C2-AA 播完切到 C3-1（转场三帧已截）', transited === true, `node=${transited ? 'C3-1' : '未到达'}`)

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
