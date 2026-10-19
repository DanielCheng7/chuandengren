/**
 * BGM 通道（步骤 40 最小闭环：标题页 / 剧情＋结局两段）
 *
 * 设计要点：
 * - **两首曲目**：`bgm_title`（标题页）／`bgm_story`（剧情页与结局页，不切曲）。
 * - **自动播放策略**：浏览器禁止无手势发声，故首次 `play()` 前记录"待播意图"，
 *   等第一个 `pointerdown`／`keydown` 后自动补播；`--autoplay-policy` 放行时立即出声。
 * - **CG 避让**：`开场CG.mp4` 自带音轨（`标题页_h264.mp4` 无音轨、已 muted），
 *   故 CG 与黑场期间调用 `suspendBgm()` 淡出并暂停，避免双层配乐。
 * - **音量**：统一由 `settings.volume`（0–100）驱动，0 即静音；滑杆改动即时生效。
 * - **缺素材降级**：404 只记一条 info，不报错、不占位、不阻塞剧情。
 */
import { watch } from 'vue'
import { useSettings } from './useSettings'

export type BgmKey = 'title' | 'story'

/**
 * 走**无扩展名**的 `/media/*` 路由（Vite 中间件返回 `audio/mpeg`）：
 * 装了 IDM 之类下载管理器时，插件按 `.mp3` 后缀抓取，直链会被弹窗甚至接管导致没声音；
 * 去掉扩展名后它匹配不到，页面正常拿到音频。
 */
const SRC: Record<BgmKey, string> = {
  title: '/media/bgm-title',
  story: '/media/bgm-story',
}

/** 纯静态部署（无 Node 中间件）时回退到直链——只回退一次，仍失败才判定缺素材 */
const SRC_FALLBACK: Record<BgmKey, string> = {
  title: '/assets/audio/bgm_title.mp3',
  story: '/assets/audio/bgm_story.mp3',
}

/** 单曲基准增益（两首响度不同，主线曲稍收，避免盖过对白节奏） */
const GAIN: Record<BgmKey, number> = { title: 0.62, story: 0.5 }
const FADE_MS = 900
const SUSPEND_MS = 420

const els = new Map<BgmKey, HTMLAudioElement>()
const missing = new Set<BgmKey>()
const fading = new WeakMap<HTMLAudioElement, number>()

let current: BgmKey | null = null
let pending: BgmKey | null = null
let suspended = false
let unlocked = false
let unlockBound = false
let volumeWatcherBound = false

function canPlay(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined'
}

function master(): number {
  const { settings } = useSettings()
  return Math.max(0, Math.min(100, settings.volume)) / 100
}

function targetVolume(key: BgmKey): number {
  return master() * GAIN[key]
}

function ensure(key: BgmKey): HTMLAudioElement | null {
  if (!canPlay() || missing.has(key)) return null
  let a = els.get(key)
  if (a) return a
  a = new Audio(SRC[key])
  a.loop = true
  a.preload = key === 'title' ? 'metadata' : 'auto'
  a.volume = 0
  a.addEventListener('error', () => {
    // ① 第一次失败：多半是无扩展名路由在纯静态部署下不存在 → 回退直链重试一次
    if (!a.dataset.fallback) {
      a.dataset.fallback = '1'
      a.src = SRC_FALLBACK[key]
      a.load()
      if (current === key && !suspended) {
        a.volume = 0
        const p = a.play()
        fade(a, targetVolume(key))
        p.catch(() => armUnlock())
      }
      return
    }
    // ② 仍然失败：素材确实缺失，静默降级（不留空占位、不打扰玩家）
    missing.add(key)
    els.delete(key)
    if (current === key) current = null
    console.info(`[audio] 未找到 ${SRC_FALLBACK[key]}，该段落静音继续`)
  })
  els.set(key, a)
  return a
}

/** 交叉淡变；同一元素的新淡变会作废旧回调（防止"suspend 后被 resume 打断却仍被暂停"） */
function fade(a: HTMLAudioElement, to: number, ms = FADE_MS, after?: () => void) {
  const token = (fading.get(a) ?? 0) + 1
  fading.set(a, token)
  const from = a.volume
  const target = Math.max(0, Math.min(1, to))
  const t0 = performance.now()
  const step = (now: number) => {
    if (fading.get(a) !== token) return
    const p = Math.min(1, (now - t0) / Math.max(1, ms))
    a.volume = Math.max(0, Math.min(1, from + (target - from) * p))
    if (p < 1) requestAnimationFrame(step)
    else after?.()
  }
  requestAnimationFrame(step)
}

function armUnlock() {
  if (!canPlay() || unlocked || unlockBound) return
  unlockBound = true
  const onGesture = () => {
    window.removeEventListener('pointerdown', onGesture, true)
    window.removeEventListener('keydown', onGesture, true)
    unlockBound = false
    unlocked = true
    if (pending) playBgm(pending)
  }
  window.addEventListener('pointerdown', onGesture, true)
  window.addEventListener('keydown', onGesture, true)
}

function bindVolumeWatcher() {
  if (volumeWatcherBound || !canPlay()) return
  volumeWatcherBound = true
  const { settings } = useSettings()
  watch(
    () => settings.volume,
    () => {
      if (!current || suspended) return
      const a = els.get(current)
      if (a) fade(a, targetVolume(current), 240)
    }
  )
}

/** 播放指定曲目（切曲时旧曲淡出并暂停） */
export function playBgm(key: BgmKey) {
  pending = key
  bindVolumeWatcher()
  if (suspended) return
  const a = ensure(key)
  if (!a) return
  if (current && current !== key) {
    const prev = els.get(current)
    if (prev) fade(prev, 0, FADE_MS, () => prev.pause())
  }
  current = key
  if (a.paused) {
    a.volume = 0
    // 淡入不依赖 play() 的 promise（无声卡/解码慢的环境下它可能长时间不 resolve，
    // 会把音量永远卡在 0）；播放被策略拒绝时再由 catch 把音量归零并等手势。
    const p = a.play()
    fade(a, targetVolume(key))
    p.then(
      () => {
        unlocked = true
      },
      () => {
        a.volume = 0
        armUnlock()
      }
    )
  } else {
    fade(a, targetVolume(key))
  }
}

/** CG／黑场期间让位给视频原声 */
export function suspendBgm() {
  suspended = true
  if (!current) return
  const a = els.get(current)
  if (a) fade(a, 0, SUSPEND_MS, () => a.pause())
}

/** 解除让位（不自动续播，由调用方明确指定曲目） */
export function resumeBgm() {
  suspended = false
}

/** 调试与验收用的状态快照 */
export function bgmState() {
  const a = current ? els.get(current) : null
  return {
    current,
    pending,
    unlocked,
    suspended,
    playing: !!a && !a.paused,
    volume: a ? Math.round(a.volume * 1000) / 1000 : 0,
    src: a?.currentSrc ?? '',
    missing: [...missing],
  }
}

export function useAudio() {
  return { playBgm, suspendBgm, resumeBgm, bgmState }
}

// 验收脚本（build 后跑）与答辩现场排查用；不影响正常播放
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__bgmState = bgmState
}
