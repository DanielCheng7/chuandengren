#!/usr/bin/env node
/**
 * 角色立绘验收：常驻在场（galgame 式）+ 版式（参考图比例）+ 场景切换 + 缺素材降级
 *
 * 用法：node scripts/verify-characters.mjs [url] [outDir]
 *   默认 url = http://127.0.0.1:4173/；开发期可传 http://127.0.0.1:5173/
 *
 * 验证点（2026-10-19 用户要求：立绘整场常驻，不在旁白时消失）：
 *   ① 进场景即有立绘（不等第一句台词）——**用 C2-A 验**：第一章自 2026-10-21 起
 *     改为逐行立绘（阿禾只在「回来了？」一句），进门本来就是空台；
 *   ② **旁白行立绘不消失**：C2-A 逐行采样，立绘数量恒为 1；
 *   ③ 版式：单人 ≈88vh、首次登场在左侧、底边越过对白带顶（腿被裁）、水平不出画；
 *   ④ 换场景重建 **＋ 逐行出场**：进夜市摊空台，翻到阿鲟那句才出现（左站位素材）；
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
import { AUDIO_MOCK } from './lib/audio-mock.mjs'

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
  /**
   * 直接注档跳到某节点第 0 行并从标题页「继续上次」进入。
   * 2026-10-21 起第一章立绘按行开关，靠一路点过去既慢又可能撞上选项，
   * 所以这类定点检查统一走注档（loadSave 会按行重算 cast，与正常进入等价）。
   */
  const injectNode = async (nid) => {
    await ev(`(() => {
      const k = 'chuandengren.save.v4';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s.nodeId = '${nid}'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
      s.state = s.state || {};
      localStorage.setItem(k, JSON.stringify(s));
    })()`)
    await send('Page.reload')
    await sleep(1500)
    await ev(
      `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`
    )
    await sleep(800)
  }
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
  const sampleNode = async (stopIds, max = 30) => {    const rows = []
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

  /* ===== A. 旁白常驻：C2-A2（九婆）整节点逐行采样 =====
     2026-10-21：第一章改为**逐行立绘**（阿禾只在「回来了？」一句出现，C1-2 进门是空台），
     所以「进节点即有立绘、旁白行不消失」这条引擎规则改用**未启用逐行控制**的节点验证。
     同一批背景落位后 C2-A 的底图里已画着九婆（backdropCast 会剔掉立绘），故改用
     同场的 **C2-A2**（院子空镜、底图无人），九婆立绘全程在场。 */
  await freshBoot()
  await jumpTo('C1-1')
  await injectNode('C2-A2')
  const c12 = await probe()
  await shot('01-solo-jiupo')
  const rows = await sampleNode(['C2-0'])
  const narRows = rows.filter((r) => !r.name)
  const allOne = rows.every((r) => r.count === 1)
  check(
    '① 进 C2-A2 即有立绘（不等第一句台词）',
    c12?.count === 1 && (c12?.rects[0].src || '').includes('char-jiupo'),
    `首行立绘数=${c12?.count} ${(c12?.rects?.[0]?.src || '').split('/').pop()}`
  )
  check(
    '② 旁白行立绘不消失（整节点恒 1 人）',
    rows.length >= 6 && allOne && narRows.length >= 3,
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

  /* ===== C. 换场景重建 ＋ 逐行出场：夜市摊进门空台，翻到阿鲟那句才出现 ===== */
  await freshBoot()
  await jumpTo('C1-1')
  await advanceToNode(['C1-3'])
  await sleep(500)
  await ev(`[...document.querySelectorAll('.btn.choice:not([disabled])')].find(b=>b.textContent.includes('夜市摊'))?.click()`)
  const night = await advanceToNode(['C1-4c'])
  await sleep(400)
  // 进节点那一刻：换场景重建 + 本节点 cast: [] → 台上应空
  const nightEntry = await ev(`document.querySelectorAll('.char-stage .char').length`)
  for (let i = 0; i < 12; i++) {
    if (await ev(`!!document.querySelector('.char-stage .char.is-ashun')`)) break
    await tap()
    await sleep(200)
  }
  const nightNow = await probe()
  const nightWho = await ev(`[...document.querySelectorAll('.char-stage .char')].map((el) => el.classList.contains('is-ashun') ? '阿鲟' : '人物')`)
  check(
    '④ 换场景重建＋逐行出场：进夜市摊空台，翻到阿鲟那句才出现（右站位素材）',
    !!night && nightEntry === 0 && nightNow?.count === 1 && nightWho?.[0] === '阿鲟' &&
      (nightNow?.rects?.[0]?.src || '').includes('char-ashun-right'),
    `进门${nightEntry}人｜node=${nightNow?.nodeId} 场上=${JSON.stringify(nightWho)} ${(nightNow?.rects?.[0]?.src || '').split('/').pop()}`
  )
  await shot('02-night-stall')

  /* ===== D. 双人分列（C3-2：九婆 + 阿禾） =====
     2026-10-21 链 A/B/C 背景落位后，E1 的底图已画入九婆／阿禾／知遥（backdropCast 全剔），
     双人分列改用**链 C 的 E2**：底图只画了九婆与知遥，节点显式 `cast: ['阿禾','阿鲟']`，
     于是场上是阿禾（左槽）＋阿鲟（右槽）——全片现在唯一还剩「两人同屏」的节点。 */
  await freshBoot()
  await jumpTo('E1')
  const duo = await advanceToNode(['E2'])
  await sleep(500)
  const duoNow = await probe()
  const noOverlap2 =
    duoNow?.count === 2 && duoNow.rects[0].right <= duoNow.rects[1].x + 8
  check(
    '⑤ 双人分列不重叠（E2 阿禾＋阿鲟），左槽 -left／右槽 -right',
    !!duo &&
      duoNow?.count === 2 &&
      noOverlap2 &&
      (duoNow.rects[0].src || '').endsWith('-left.webp') &&
      (duoNow.rects[1].src || '').endsWith('-right.webp'),
    duoNow?.rects?.map((r) => `${r.src.split('/').pop()}@${r.x}-${r.right}`).join(' | ') || '无'
  )
  await shot('03-duo-e2')

  /* ===== E. 四人同框节点不叠立绘：C3-2（底图已画入四人） =====
     2026-10-22 第三章背景落位后，全片已没有「四个说话人 → 上限裁到两人」的节点了：
     这类场景的底图把人物画全，节点用 `cast: []`。上限 2 的规则本身仍由
     `verify-cast-layout` ①⑤（全 100 点巡检）兜底。 */
  await freshBoot()
  await jumpTo('C3-1')
  const trio = await advanceToNode(['C3-2'])
  await sleep(500)
  const trioNow = await probe()
  check(
    '⑥ 四人同框节点不叠立绘：C3-2（九婆/周经理/阿禾/阿鲟）场上 0 人，靠底图交代',
    !!trio && trioNow?.count === 0,
    `场上 ${trioNow?.count} 人`
  )
  await shot('04-c3-2-cg')

  /* ===== E2. 同场景换节点：第三章 CG 段不叠立绘（C3-8 → C3-A1） =====
     2026-10-22 第三章背景落位后，C3-8／C3-A 的底图把九婆、阿禾、知遥、周经理都画进去了，
     节点用 `cast: []` 整段不出立绘 —— 这里守两件事：换节点不抛错、周经理离场不留残影。 */
  await freshBoot()
  await jumpTo('C3-1')
  await advanceToNode(['C3-8'], 120000)
  await sleep(400)
  const beforeLeave = await probe()
  await advanceToNode(['C3-A1'], 60000)
  await sleep(400)
  const afterLeave = await probe()
  const castNames = (p) => (p?.rects ?? []).map((r) => r.src.split('/').pop()).sort().join(',')
  check(
    '⑥-2 第三章 CG 段：C3-8 → C3-A1 均不叠立绘（四人全在底图，周经理离场不留残影）',
    beforeLeave?.count === 0 && afterLeave?.count === 0 && afterLeave?.nodeId === 'C3-A1',
    `C3-8=${castNames(beforeLeave) || '0 人'} → C3-A1=${castNames(afterLeave) || '0 人'}`
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

  /* ===== F2. 阿鲟在场：尺寸档、贴对白框上沿、不套窗口 =====
     2026-10-21 第二章背景落位后，阿禾在 C1-4b／C2-BB 的底图里都已画入，
     按 `backdropCast` 机制不再出立绘（见 ⑦-5）——「阿鲟＋人物两人同屏」的用例
     已无对应节点，两人不重叠改由 `verify-cast-layout` ① 全节点巡检覆盖。
     这里改用 **C2-X2**（灯坊圆桌，底图含知遥与周经理，场上只有阿鲟一人）。 */
  await freshBoot()
  await jumpTo('C1-1')
  await ev(`(() => {
    const k = 'chuandengren.save.v4';
    const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.nodeId = 'C2-X2'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
    s.state = s.state || {};
    localStorage.setItem(k, JSON.stringify(s));
  })()`)
  await send('Page.reload')
  await sleep(1500)
  await ev(`[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`)
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
    '⑦-2 阿鲟单独在场：不套窗口黑框、底图已画入的周经理不叠立绘',
    both?.count === 1 && both.list.every((x) => x.who === '阿鲟'),
    `${both?.list?.map((x) => `${x.who}@${x.x}-${x.right}`).join('｜')}｜场上 ${both?.count} 人`
  )
  check(
    '⑦-3 阿鲟主体贴在对白框上沿（不压字：0 ≤ 缝 ≤ 24px）',
    both?.gap !== null && both?.gap >= 0 && both?.gap <= 24,
    `阿鲟底=${both?.list?.find((x) => x.who === '阿鲟')?.bottom} 对白顶=${both?.dboxTop} 缝=${both?.gap}px`
  )
  await shot('06-ashun-solo')

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

  /* ===== F4. 背景图已画入的角色不出立绘（`backdropCast`）＋ 逐行立绘（`Line.cast`） =====
     2026-10-21：`bg_gift_shop.webp` 里阿禾正伸手拿手机壳，C1-4b 若再叠立绘会变成"两个人"；
     C1-5 的单屏图里画着九婆。这两个节点因此设 `cast: []` 起步，阿鲟要到指定台词才出现。
     所以本用例改成两段：① 进门空台；② 翻到阿鲟那句，台上只有阿鲟。 */
  const bakedCases = [
    { node: 'C1-4b', hide: '阿禾' },
    { node: 'C1-5', hide: '九婆' },
  ]
  const bakedRows = []
  for (const c of bakedCases) {
    await ev(`(() => {
      const k = 'chuandengren.save.v4';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s.nodeId = '${c.node}'; s.phase = 'lines'; s.lineIndex = 0; s.missingNodeId = null;
      s.state = s.state || {};
      localStorage.setItem(k, JSON.stringify(s));
    })()`)
    await send('Page.reload')
    await sleep(1500)
    await ev(
      `[...document.querySelectorAll('.menu-item')].find(x => x.textContent.includes('继续上次'))?.click()`
    )
    await sleep(700)
    const srcsOf = () =>
      ev(`[...document.querySelectorAll('.char-stage .char img')].map(i => i.getAttribute('src') || '')`)
    const atEntry = (await srcsOf()) ?? []
    // 翻行找阿鲟（该行才放行立绘）
    let atLine = atEntry
    for (let i = 0; i < 20 && !atLine.some((s) => s.includes('ashun')); i++) {
      await tap()
      await sleep(200)
      atLine = (await srcsOf()) ?? []
    }
    bakedRows.push({ ...c, atEntry, atLine })
  }
  check(
    '⑦-5 背景已画入者不出立绘：进门空台，翻到指定台词才出阿鲟（C1-4b／C1-5）',
    bakedRows.every(
      (r) =>
        r.atEntry.length === 0 &&
        r.atLine.some((s) => s.includes('ashun')) &&
        !r.atLine.some((s) => s.includes('ahe') || s.includes('jiupo'))
    ),
    bakedRows
      .map(
        (r) =>
          `${r.node}: 进门${r.atEntry.length}人 → ${r.atLine.map((s) => s.split('/').pop()).join('+') || '无'}`
      )
      .join('｜')
  )

  /* ===== F5. 衔接第二幕的选项弹出前，阿鲟必须已退场 =====
     C1-5 最后一句写了 `cast: []`；C2-0 与它同场景（lantern_workshop），
     若不同步清空，引擎的"同场景合并"会把阿鲟带进选项界面。 */
  await injectNode('C1-5')
  for (let i = 0; i < 24; i++) {
    const ph = await ev(`(() => {
      const hasChoice = !!document.querySelector('.btn.choice');
      return hasChoice ? 'choice' : 'lines';
    })()`)
    if (ph === 'choice') break
    await tap()
    await sleep(200)
  }
  const optState = await ev(`(() => ({
    choices: document.querySelectorAll('.btn.choice').length,
    chars: document.querySelectorAll('.char-stage .char').length,
  }))()`)
  check(
    '⑦-6 衔接第二幕的选项弹出前，阿鲟已退场（C1-5 → C2-0 同场景不残留）',
    (optState?.choices ?? 0) >= 2 && (optState?.chars ?? -1) === 0,
    `选项 ${optState?.choices} 个｜场上立绘 ${optState?.chars} 人`
  )

  /* ===== G. 移动端 ===== */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await freshBoot()
  await jumpTo('C1-1')
  await injectNode('C2-A2')
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
