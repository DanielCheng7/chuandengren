#!/usr/bin/env node
/**
 * 角色立绘验收：常驻在场（galgame 式）+ 版式（参考图比例）+ 场景切换 + 缺素材降级
 *
 * 用法：node scripts/verify-characters.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（2026-10-19 用户要求：立绘整场常驻，不在旁白时消失）：
 *   ① 进场景即有立绘（不等第一句台词）；
 *   ② **旁白行立绘不消失**：C1-2 逐行采样，场上有名字的 11 行里立绘数量恒为 1；
 *   ③ 版式：单人 ≈88vh、**首次登场在左侧**、底边越过对白带顶（腿被裁）、水平不出画；
 *   ④ 换场景重建：夜市摊（只有阿鲟）→ 无人物立绘；
 *   ⑤ 双人分列不重叠（E1：九婆 + 阿禾）；
 *   ⑥ 三人分列不重叠（C3-2：九婆 + 阿禾 + 周经理；阿鲟按同屏上限让位）；
 *   ⑦ 无立绘角色（管理员）不留空框；阿鲟**并排站台**（无窗口、不与人物重叠）、
 *     **主体贴在对白框上沿**（0–24px 缝）、**1280×720 与 1920×1080 下同样贴边**；
 *   ⑧ 移动端竖屏不出画、不压对白。
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
  const probe = () =>
    ev(`(() => {
      const s = JSON.parse(localStorage.getItem('${SAVE}')||'{}');
      const imgs = [...document.querySelectorAll('.char-stage .char img')];
      const rects = imgs.map((i) => { const r = i.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
                 bottom: Math.round(r.bottom), right: Math.round(r.right), src: i.getAttribute('src') }; });
      const dbox = document.querySelector('.dbox');
      return {
        nodeId: s.nodeId, phase: s.phase,
        name: document.querySelector('.dbox .name')?.textContent?.trim() || '',
        text: document.querySelector('.dbox .text')?.textContent?.trim() || '',
        count: imgs.length, rects,
        dboxTop: dbox ? Math.round(dbox.getBoundingClientRect().y) : null,
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
  /** 推进到指定节点（遇选项／触点自动作答） */
  const advanceToNode = async (ids, timeout = 90000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const s = await probe()
      if (s && ids.includes(s.nodeId)) {
        await sleep(360)
        return await probe()
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
      await sleep(175)
    }
    return null
  }
  /** 逐行采样一个节点（直到 nodeId 变化），返回每行的立绘数量与是否旁白 */
  const sampleNode = async (stopIds, max = 30) => {
    const rows = []
    for (let i = 0; i < max; i++) {
      const s = await probe()
      if (!s) break
      if (s.nodeId && stopIds.includes(s.nodeId) && rows.length > 0) break
      rows.push({ name: s.name, count: s.count, text: s.text.slice(0, 12) })
      await tap()
      await sleep(190)
    }
    return rows
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

  /* ===== A. 旁白常驻：C1-2 整节点逐行采样 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  const c12 = await advanceToNode(['C1-2'])
  await shot('01-solo-ahe') // 先截单人版式（下次推进会到 C1-3，那里是街景无立绘）
  const rows = await sampleNode(['C1-3'])
  const narRows = rows.filter((r) => !r.name)
  const allOne = rows.every((r) => r.count === 1)
  check(
    '① 进 C1-2 即有立绘（不等第一句台词）',
    c12?.count === 1 && (c12?.rects[0].src || '').includes('char-ahe'),
    `首行立绘数=${c12?.count}`
  )
  check(
    '② 旁白行立绘不消失（整节点恒 1 人）',
    rows.length >= 8 && allOne && narRows.length >= 3,
    `采样 ${rows.length} 行，其中旁白 ${narRows.length} 行；各行立绘数=${[...new Set(rows.map((r) => r.count))].join('/')}`
  )

  /* ===== B. 版式：单人 88vh、靠左、腿被对白带裁、用左站位素材 ===== */
  const solo = c12?.rects[0]
  check(
    '③ 版式：单人 ≈88vh、在左侧、不出画、底边越过对白带（腿被裁）、用 -left 素材',
    !!solo &&
      solo.h >= (c12.vh * 0.84) &&
      solo.h <= c12.vh * 0.96 &&
      solo.x < c12.vw * 0.5 &&
      solo.x >= 0 &&
      solo.right <= c12.vw + 1 &&
      solo.bottom > (c12.dboxTop ?? 0) &&
      (solo.src || '').endsWith('-left.webp'),
    `图 ${solo?.w}x${solo?.h} @ x=${solo?.x} 底=${solo?.bottom} 对白顶=${c12?.dboxTop} 视高=${c12?.vh}｜${(solo?.src || '').split('/').pop()}`
  )

  /* ===== C. 换场景重建：夜市摊只有阿鲟 → 无人物立绘 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  await advanceToNode(['C1-3'])
  await sleep(500)
  await ev(`[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('夜市摊'))?.click()`)
  const night = await advanceToNode(['C1-4c'])
  await sleep(400)
  const nightNow = await probe()
  const nightWho = await ev(`[...document.querySelectorAll('.char-stage .char')].map((el) => el.classList.contains('is-ashun') ? '阿鲟' : '人物')`)
  check(
    '④ 换场景重建：夜市摊只有阿鲟（无人物立绘，用左站位素材）',
    !!night && nightNow?.count === 1 && nightWho?.[0] === '阿鲟' &&
      (nightNow?.rects?.[0]?.src || '').includes('char-ashun-left'),
    `node=${nightNow?.nodeId} 场上=${JSON.stringify(nightWho)} ${(nightNow?.rects?.[0]?.src || '').split('/').pop()}`
  )
  await shot('02-night-stall')

  /* ===== D. 双人分列（E1：九婆 + 阿禾） ===== */
  await freshBoot()
  await jumpTo('E1')
  const duo = await advanceToNode(['E1'])
  await sleep(500)
  const duoNow = await probe()
  const noOverlap2 =
    duoNow?.count === 2 && duoNow.rects[0].right <= duoNow.rects[1].x + 8
  check(
    '⑤ 双人分列不重叠（E1 九婆＋阿禾），左槽 -left／右槽 -right',
    !!duo &&
      duoNow?.count === 2 &&
      noOverlap2 &&
      (duoNow.rects[0].src || '').endsWith('-left.webp') &&
      (duoNow.rects[1].src || '').endsWith('-right.webp'),
    duoNow?.rects?.map((r) => `${r.src.split('/').pop()}@${r.x}-${r.right}`).join(' | ') || '无'
  )
  await shot('03-duo-e1')

  /* ===== E. 上限 2 人：C3-2 有 4 个说话人 → 只上优先级最高的九婆＋阿禾 ===== */
  await freshBoot()
  await jumpTo('C3-1')
  const trio = await advanceToNode(['C3-2'])
  await sleep(500)
  const trioNow = await probe()
  const trioNames = (trioNow?.rects ?? []).map((r) => r.src.split('/').pop())
  const xs2 = (trioNow?.rects ?? []).map((r) => r.x).sort((a, b) => a - b)
  check(
    '⑥ 同屏上限 2 人：C3-2（九婆/周经理/阿鲟/阿禾）只上九婆＋阿禾',
    !!trio &&
      trioNow?.count === 2 &&
      trioNames.some((s) => s.includes('jiupo')) &&
      trioNames.some((s) => s.includes('ahe')) &&
      !trioNames.some((s) => s.includes('zhou')) &&
      !trioNames.some((s) => s.includes('ashun')) &&
      xs2.length === 2 &&
      xs2[1] - xs2[0] > 200,
    `2 人 @ x=${xs2.join('/')}｜${trioNames.join(',')}`
  )
  await shot('04-trio-c3-2')

  /* ===== E2. 同场景换节点：cast 稳定不闪人（C3-8 → C3-A） ===== */
  await freshBoot()
  await jumpTo('C3-1')
  await advanceToNode(['C3-8'], 120000)
  await sleep(400)
  const beforeLeave = await probe()
  await advanceToNode(['C3-A'], 60000)
  await sleep(400)
  const afterLeave = await probe()
  const castNames = (p) => (p?.rects ?? []).map((r) => r.src.split('/').pop()).sort().join(',')
  check(
    '⑥-2 换节点跟着说话人走：C3-8 周经理在场 → C3-A 周经理退场、阿禾上场（均 2 人）',
    beforeLeave?.count === 2 &&
      afterLeave?.count === 2 &&
      afterLeave?.nodeId === 'C3-A' &&
      castNames(beforeLeave).includes('zhou') &&
      castNames(afterLeave).includes('ahe') &&
      !castNames(afterLeave).includes('zhou'),
    `C3-8=${castNames(beforeLeave)} → C3-A=${castNames(afterLeave)}`
  )
  await shot('05-leave-c3a')

  /* ===== F. 管理员无框 + 阿鲟独立档位 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  await advanceToNode(['C1-3'])
  await sleep(500)
  await ev(`[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('文化馆'))?.click()`)
  await advanceToNode(['C1-4a'])
  await sleep(400)
  const adminNow = await probe()
  const adminWho = await ev(`[...document.querySelectorAll('.char-stage .char')].map((el) => el.classList.contains('is-ashun') ? '阿鲟' : '人物')`)
  check(
    '⑦ 无立绘角色（管理员）不留空框——场上只有阿鲟',
    adminNow?.name.includes('管理员') && (adminWho ?? []).every((w) => w === '阿鲟'),
    `name=${adminNow?.name} 场上=${JSON.stringify(adminWho)}`
  )
  await shot('05-no-portrait')

  await freshBoot()
  await jumpTo('C1-1')
  // 走到 C1-4a（管理员那处）后继续点，直到阿鲟在场——它整场常驻，与人物并排
  await advanceToNode(['C1-4a'], 120000)
  for (let i = 0; i < 12; i++) {
    const has = await ev(`!!document.querySelector('.char-stage .char.is-ashun img')`)
    if (has) break
    await tap()
    await sleep(200)
  }
  const ashunProbe = await ev(`(() => {
    const el = document.querySelector('.char-stage .char.is-ashun img');
    return el ? { w: el.naturalWidth, h: el.naturalHeight, src: el.getAttribute('src') } : null;
  })()`)
  check(
    '⑧ 阿鲟尺寸档（横卧鱼灯、宽度约束，与人物并排）',
    !!ashunProbe && ashunProbe.src.includes('char-ashun') && ashunProbe.w > 0,
    ashunProbe ? `${ashunProbe.src} ${ashunProbe.w}x${ashunProbe.h}` : '未出现'
  )

  /* ===== F2. 阿鲟与人物同屏不重叠（用户点名的第一幕：阿禾 + 阿鲟） ===== */
  await freshBoot()
  await jumpTo('C1-1')
  await advanceToNode(['C1-3'])
  await sleep(500)
  await ev(`[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('文创店'))?.click()`)
  await advanceToNode(['C1-4b'], 60000)
  for (let i = 0; i < 12; i++) {
    if (await ev(`!!document.querySelector('.char-stage .char.is-ashun img')`)) break
    await tap()
    await sleep(200)
  }
  const both = await ev(`(() => {
    const imgs = [...document.querySelectorAll('.char-stage .char img')];
    const list = imgs.map((i) => {
      const b = i.getBoundingClientRect();
      const el = i.parentElement;
      return { who: el.classList.contains('is-ashun') ? '阿鲟' : i.getAttribute('src').split('/').pop(),
               x: Math.round(b.x), right: Math.round(b.right),
               top: Math.round(b.top), bottom: Math.round(b.bottom) };
    });
    const overlap = list.length === 2 ? !(list[0].right <= list[1].x || list[1].right <= list[0].x) : null;
    const dbox = document.querySelector('.dbox');
    const dt = dbox ? Math.round(dbox.getBoundingClientRect().top) : null;
    const a = list.find((x) => x.who === '阿鲟');
    return { count: imgs.length, list, overlap, dboxTop: dt, gap: a && dt !== null ? dt - a.bottom : null };
  })()`)
  check(
    '⑦-2 阿禾 + 阿鲟同屏：左右分列、不重叠（阿鲟无窗口）',
    both?.count === 2 && both.overlap === false && both.list.some((x) => x.who === '阿鲟'),
    `${both?.list?.map((x) => `${x.who}@${x.x}-${x.right}`).join('｜')}｜重叠=${both?.overlap}`
  )
  check(
    '⑦-3 阿鲟主体贴在对白框上沿（不压字：0 ≤ 缝 ≤ 24px）',
    both?.gap !== null && both?.gap >= 0 && both?.gap <= 24,
    `阿鲟底=${both?.list?.find((x) => x.who === '阿鲟')?.bottom} 对白顶=${both?.dboxTop} 缝=${both?.gap}px`
  )
  await shot('06-ashun-and-ahe')

  /* ===== F3. 分辨率稳定性：不同窗口尺寸下阿鲟仍贴住对白框上沿 =====
     用户要求「不同分辨率与窗口尺寸下位置保持稳定」：分别切成 1280×720 与
     1920×1080，量「阿鲟底 → 对白框顶」的缝隙，必须在 0–24px 之间且不重叠。 */
  const gapsBySize = []
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await sleep(600)
    const g = await ev(`(() => {
      const a = [...document.querySelectorAll('.char-stage .char.is-ashun img')][0];
      const dbox = document.querySelector('.dbox');
      if (!a || !dbox) return null;
      const ab = a.getBoundingClientRect().bottom, dt = dbox.getBoundingClientRect().top;
      return { gap: Math.round(dt - ab), vw: window.innerWidth, vh: window.innerHeight,
               ashunTop: Math.round(a.getBoundingClientRect().top) };
    })()`)
    gapsBySize.push({ w, h, ...(g ?? {}) })
  }
  check(
    '⑦-4 分辨率稳定：1280×720 与 1920×1080 下均贴边（0 ≤ 缝 ≤ 24px）',
    gapsBySize.length === 2 && gapsBySize.every((g) => g.gap >= 0 && g.gap <= 24),
    gapsBySize.map((g) => `${g.vw}×${g.vh} 缝=${g.gap}px`).join('｜')
  )
  await send('Emulation.clearDeviceMetricsOverride')
  await sleep(400)

  /* ===== G. 移动端 ===== */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await freshBoot()
  await jumpTo('C1-1')
  const m = await advanceToNode(['C1-2'])
  await sleep(400)
  const mNow = await probe()
  const mRect = mNow?.rects?.[0]
  check(
    '⑨ 移动端竖屏：不出画、腿部仍被对白带裁',
    !!mRect && mRect.x >= -2 && mRect.right <= mNow.vw + 2 && mRect.bottom > (mNow.dboxTop ?? 0),
    `图 ${mRect?.w}x${mRect?.h} @ ${mRect?.x}-${mRect?.right} 视口 ${mNow?.vw}`
  )
  await shot('06-mobile')

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
