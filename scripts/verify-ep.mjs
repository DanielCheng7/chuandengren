#!/usr/bin/env node
/**
 * 尾声 EP／「一日一篾」变体／现实篇 走查（步骤 38）
 *
 * 用法：node scripts/verify-ep.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（《开发文档》§2.4 / §3.7.3 ③ / §5.13）：
 *   ① 链结束 → EP：三分派**同一段台词**（「传承有千路，灯火同一盏」），只换镜头侧重；
 *   ② 「一日一篾」变体：4 组 (1,2)(2,1)(3,2)(2,3) 触发、措辞按落点（A 版灯坊／B 版省城）；
 *   ③ 非 4 组（如 (3,3) 合流）不触发；
 *   ③ 现实篇由成片接管：EP → EP-CG（尾声/EP_字幕版.mp4，1280×720／63.73s，自带音轨与烧录字幕）；
 *   ④ 播完／跳过成片后落结局页；⑤ 全程无 console 报错。
 *   注：EP-N1…N6 的文字节点仍保留在数据里（剧本存档），但已不进主链。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { AUDIO_MOCK } from './lib/audio-mock.mjs'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-ep')
const PORT = 9363
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
    `--user-data-dir=${join(tmpdir(), `wb-ep-${Date.now()}`)}`,
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
        nodeId: s.nodeId, phase: s.phase,
        t: s.state?.tradition, i: s.state?.innovation,
        ending: s.state?.ending, tier: s.state?.endingTier, balanced: s.state?.balancedEp,
        dbox: document.querySelector('.dbox .text')?.textContent?.trim() || '',
        body: document.body.innerText,
        hasSkipReal: !!([...document.querySelectorAll('.tool')].find(b=>b.textContent.includes('跳过现实篇'))),
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
  const jumpTo = async (entry) => {
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
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }))`)
    await sleep(250)
  }
  const advanceToInput = async (timeout = 90000) => {
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
  /** 注入 (T,I,ending,tier,balancedEp) 后刷新继续，一路收集到结局页 */
  const runToEnd = async (t, i, ending, tier, balanced) => {
    await freshBoot()
    await jumpTo('C3-1')
    await advanceToInput()
    await ev(`[...document.querySelectorAll('.free-input .preset')][2]?.click()`)
    await sleep(700)
    await ev(`(() => {
      const k = '${SAVE}';
      const s = JSON.parse(localStorage.getItem(k));
      s.state.tradition = ${t};
      s.state.innovation = ${i};
      s.state.ending = '${ending}';
      s.state.endingTier = '${tier}';
      s.state.balancedEp = ${balanced};
      localStorage.setItem(k, JSON.stringify(s));
    })()`)
    await send('Page.reload')
    await sleep(2500)
    await ev(`[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes('继续上次'))?.click()`)
    await sleep(1200)
    const out = []
    let cg = null
    const t0 = Date.now()
    while (Date.now() - t0 < 180000) {
      const s = await snap()
      if (s?.dbox && !out.includes(s.dbox)) out.push(s.dbox)
      if (s?.phase === 'end') return { lines: out, snap: s, cg }
      // 现实篇成片（2026-10-21 起 EP → EP-CG 视频 → END）：录下视频规格后点跳过，别干等 59 秒
      if (await ev(`!!document.querySelector('.cg-video')`)) {
        await sleep(500)
        if (!cg) {
          cg = await ev(`(() => {
            const v = document.querySelector('.cg-video');
            return v ? { src: v.getAttribute('src'), w: v.videoWidth, h: v.videoHeight,
                         paused: v.paused, duration: Math.round(v.duration * 100) / 100 } : null;
          })()`)
        }
        await ev(`document.querySelector('.cg-skip')?.click()`)
        await sleep(900)
        continue
      }
      if (s?.phase === 'choice') {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(165)
    }
    return { lines: out, snap: null }
  }

  await send('Runtime.enable')
  await send('Page.enable')
  // 用静音 data URI 顶替真实 mp3：浏览器不发音频请求，IDM 之类的下载管理器不会弹窗
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIO_MOCK })
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

  /* ===== 段 1：(2,1) → 链 A 版「一日一篾」 ===== */
  const a = await runToEnd(2, 1, 'A', 'mild', true)
  check(
    '① EP 台词三分派通用（「传承有千路，灯火同一盏」）',
    a.lines.some((t) => t.includes('传承有千路，灯火同一盏')) &&
      a.lines.some((t) => t.includes('愿每一盏鱼灯，都有下一条河')),
    `行数=${a.lines.length}`
  )
  check(
    '② (2,1) 触发「一日一篾」且用链 A 版措辞',
    a.lines.some((t) => t.includes('后来我两边都没断')) &&
      a.lines.some((t) => t.includes('在灯坊，一日一根篾')) &&
      !a.lines.some((t) => t.includes('在省城，一周一版模型')) &&
      a.lines.some((t) => t.includes('慢，不是不做')),
    a.lines.filter((t) => t.includes('一日一根篾') || t.includes('一周一版')).join(' | ')
  )
  await shot('01-epbal-a')

  // 2026-10-21：现实篇文字节点（EP-N1…N6）已由成片取代，改为验证成片本身
  const cgSrc = decodeURIComponent(a.cg?.src || '')
  // 2026-10-22：成片换成新剪辑（源 photo/video/EPCG.mp4，1280×720／63.73s）
  check(
    '③ 现实篇由成片接管：EP → EP-CG（1280×720／63.7s，播放中）',
    !!a.cg &&
      cgSrc.includes('尾声/EP_字幕版.mp4') &&
      a.cg.w === 1280 &&
      a.cg.h === 720 &&
      a.cg.duration > 60 &&
      a.cg.paused === false,
    `src=${cgSrc.split('/').pop()} ${a.cg?.w}x${a.cg?.h} ${a.cg?.duration}s paused=${a.cg?.paused}`
  )
  check(
    '④ 现实篇播完落结局页（灯路 + 结局名）',
    a.snap?.phase === 'end' &&
      typeof a.snap?.body === 'string' &&
      a.snap.body.includes('灯亮之后') &&
      a.snap.body.includes('守旧链'),
    `phase=${a.snap?.phase}`
  )
  await shot('02-ending-page')

  /* ===== 段 2：(1,2) → 链 B 版「一日一篾」 ===== */
  const b = await runToEnd(1, 2, 'B', 'mild', true)
  check(
    '⑤ (1,2) 触发「一日一篾」且用链 B 版措辞',
    b.lines.some((t) => t.includes('在省城，一周一版模型')) &&
      !b.lines.some((t) => t.includes('在灯坊，一日一根篾')),
    b.lines.filter((t) => t.includes('一周一版')).join(' | ')
  )

  /* ===== 段 3：(3,3) 合流 → 不触发变体 ===== */
  const c = await runToEnd(3, 3, 'C', 'firm', false)
  check(
    '⑥ (3,3) 合流不触发「一日一篾」',
    !c.lines.some((t) => t.includes('后来我两边都没断')) &&
      !c.lines.some((t) => t.includes('一日一篾')) &&
      c.lines.some((t) => t.includes('传承有千路，灯火同一盏')),
    `ending=${c.snap?.ending} balanced=${c.snap?.balanced}`
  )
  await shot('03-ep-c')

  /* ===== 段 4：跳过现实篇 ===== */
  await freshBoot()
  await jumpTo('C3-1')
  await advanceToInput()
  await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
  await sleep(700)
  // 推进到现实篇成片（EP-CG）
  {
    const t0 = Date.now()
    while (Date.now() - t0 < 150000) {
      const s = await snap()
      if (await ev(`!!document.querySelector('.cg-video')`)) break
      if (s?.nodeId === 'EP-CG') break
      if (s?.phase === 'input') {
        await sleep(300)
        await ev(`[...document.querySelectorAll('.free-input .preset')][0]?.click()`)
        await sleep(450)
        continue
      }
      if (s?.phase === 'choice') {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(165)
    }
  }
  const atCg = await snap()
  const hasSkip = await ev(`!!document.querySelector('.cg-skip')`)
  await sleep(300)
  await ev(`document.querySelector('.cg-skip')?.click()`)
  await sleep(1500)
  const afterSkip = await snap()
  check(
    '⑦ 现实篇成片可「跳过」并直达结局页',
    atCg?.nodeId === 'EP-CG' && hasSkip && afterSkip?.phase === 'end',
    `node=${atCg?.nodeId} 跳过按钮=${hasSkip} phase=${afterSkip?.phase}`
  )
  await shot('04-skip-real')

  check('⑧ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

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
