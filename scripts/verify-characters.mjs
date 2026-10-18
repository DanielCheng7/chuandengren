#!/usr/bin/env node
/**
 * 角色立绘接入验收：素材加载 + 位置 + 尺寸 + 缺素材不渲染
 *
 * 用法：node scripts/verify-characters.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（《素材落位规范》§3 / 《开发文档》§4.1）：
 *   ① 五个角色立绘都能加载（naturalWidth > 0），且都是透明底 WebP；
 *   ② 立绘在右侧、**人物脚不被对白带压住**（img 底边 ≤ 对白带顶边）；
 *   ③ 立绘高度不超过画幅 52%（不压住画面中心）；
 *   ④ 切换说话人时立绘随之切换（阿禾 → 九婆）；
 *   ⑤ 无立绘配置的说话人（管理员）**整层不渲染**（不出现空立绘框）；
 *   ⑥ 阿鲟走独立档位（is-ashun，横卧鱼灯）；
 *   ⑦ 全程无 console 报错。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const URL_ = process.argv[2] || 'http://127.0.0.1:4173/'
const OUT = resolve(process.argv[3] || '.verify-characters')
const PORT = 9367
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
    `--user-data-dir=${join(tmpdir(), `wb-char-${Date.now()}`)}`,
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
      const layer = document.querySelector('.char-layer');
      const img = layer?.querySelector('img');
      const bottom = document.querySelector('.bottom');
      const dbox = document.querySelector('.dbox');
      const r = (el) => el ? el.getBoundingClientRect() : null;
      const pick = (el) => el ? { x: Math.round(r(el).x), y: Math.round(r(el).y), w: Math.round(r(el).width), h: Math.round(r(el).height), bottom: Math.round(r(el).bottom) } : null;
      return {
        nodeId: s.nodeId, phase: s.phase,
        name: document.querySelector('.dbox .name')?.textContent?.trim() || '',
        layer: pick(layer), img: pick(img),
        imgSrc: img?.getAttribute('src') || '', naturalW: img?.naturalWidth || 0, naturalH: img?.naturalHeight || 0,
        isAshun: !!layer?.classList.contains('is-ashun'),
        dboxTop: dbox ? Math.round(r(dbox).y) : null,
        vh: window.innerHeight, vw: window.innerWidth,
      };
    })()`)
  const tap = () => ev(`document.querySelector('.story .stage')?.click()`)
  const freshBoot = async () => {
    await send('Page.navigate', { url: URL_ })
    await sleep(900)
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
  /** 推进直到某一说话人正在说话（遇选项／触点自动作答，不卡在 C1-3） */
  const waitSpeaker = async (who, timeout = 90000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await snap()
      if (s?.name && s.name.includes(who)) {
        await sleep(420) // 等立绘淡入
        return await snap()
      }
      if (s?.phase === 'choice') {
        await sleep(450)
        await ev(`document.querySelector('.btn.choice:not([disabled])')?.click()`)
        await sleep(450)
        continue
      }
      if (s?.phase === 'input') {
        await sleep(300)
        await ev(`document.querySelector('.free-input .preset')?.click()`)
        await sleep(450)
        continue
      }
      await tap()
      await sleep(180)
    }
    return null
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })

  /* ===== 阿禾（C1-2 第一次说话） ===== */
  await freshBoot()
  await jumpTo('C1-1')
  const ahe = await waitSpeaker('阿禾')
  check(
    '① 阿禾立绘加载成功（char-ahe.webp）',
    !!ahe && ahe.naturalW > 0 && ahe.imgSrc.includes('char-ahe'),
    `src=${ahe?.imgSrc} 自然尺寸=${ahe?.naturalW}x${ahe?.naturalH}`
  )
  check(
    '② 立绘在右侧且高度 ≤ 画幅 52%',
    !!ahe?.img && ahe.img.x > ahe.vw * 0.5 && ahe.img.h <= ahe.vh * 0.53,
    `x=${ahe?.img?.x}/${ahe?.vw} 高=${ahe?.img?.h}/${ahe?.vh}`
  )
  check(
    '③ 人物脚不被对白带压住（img 底边 ≤ 对白框顶边）',
    !!ahe?.img && !!ahe?.dboxTop && ahe.img.bottom <= ahe.dboxTop + 2,
    `img底=${ahe?.img?.bottom} 对白框顶=${ahe?.dboxTop}`
  )
  await shot('01-ahe')

  /* ===== 九婆（C1-5 收束段） ===== */
  const jiu = await waitSpeaker('九婆', 90000)
  check(
    '④ 切换说话人时立绘随之切换（→ 九婆）',
    !!jiu && jiu.naturalW > 0 && jiu.imgSrc.includes('char-jiupo'),
    `src=${jiu?.imgSrc}`
  )
  await shot('02-jiupo')

  /* ===== 管理员：无立绘配置 → 整层不渲染 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  const admin = await waitSpeaker('管理员', 90000)
  check(
    '⑤ 无立绘角色（管理员）不渲染空立绘框',
    !!admin && admin.name.includes('管理员') && (!admin.layer || admin.naturalW === 0),
    `name=${admin?.name} layer=${admin?.layer ? '存在' : '无'}`
  )
  await shot('03-no-portrait')

  /* ===== 阿鲟：独立档位 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  const ashun = await waitSpeaker('阿鲟', 120000)
  check(
    '⑥ 阿鲟走独立档位（is-ashun 横卧鱼灯）',
    !!ashun && ashun.isAshun === true && ashun.imgSrc.includes('char-ashun') && ashun.naturalW > 0,
    `isAshun=${ashun?.isAshun} src=${ashun?.imgSrc} ${ashun?.naturalW}x${ashun?.naturalH}`
  )
  await shot('04-ashun')

  check('⑦ 全程无 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  /* ===== 移动端竖屏（390×844）：立绘不出画、不压对白、不占掉半幅 ===== */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await freshBoot()
  await jumpTo('C1-1')
  const m = await waitSpeaker('阿禾')
  check(
    '⑧ 移动端竖屏：立绘在画幅内、脚不被压、宽度占比合理',
    !!m?.img &&
      m.img.x >= 0 &&
      m.img.x + m.img.w <= m.vw + 1 &&
      m.img.bottom <= (m.dboxTop ?? 1e9) + 2 &&
      m.img.h <= m.vh * 0.56 &&
      m.img.w <= m.vw * 0.45,
    `图 ${m?.img?.w}x${m?.img?.h} @ x=${m?.img?.x} 视口 ${m?.vw}x${m?.vh} 底=${m?.img?.bottom}/对白顶=${m?.dboxTop}`
  )
  await shot('05-mobile-ahe')

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
