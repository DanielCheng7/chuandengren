/**
 * 自定义大模型配置（本地持久化）—— 2026-10-23 用户要求
 *
 * 背景：团队要各自用各自的 Key 测（有人用方舟、有人用 DeepSeek／中转网关），
 * 而**仓库里不能再放任何 Key**（项目要公开）。所以配置搬到了玩家自己的浏览器里。
 *
 * 三条纪律：
 *   ① **只存 localStorage**（`chuandengren.ai.v1`），**不写进代码、不进 git**。
 *      换台电脑/换个浏览器就是空的，这是特性不是缺陷——Key 属于人，不属于仓库。
 *   ② 前端不直连上游，只把这三项随请求发给同源 `/api/ai`，由服务端代理转发；
 *      因此 Key 不会出现在任何第三方请求的 CORS 预检与浏览器地址栏里。
 *   ③ 服务端仍有兜底：没有自定义配置时，用 `.env`／`.env.local` 里的默认值。
 *      设置页的「用服务端默认」就是清空本地选择，而不是删除别人配好的东西。
 *
 * 支持多套配置并存（切换 = 换 `activeId`）：同一个人换模型、或同一台电脑换人，
 * 都不必反复粘贴 Key。
 */
import { computed, reactive, watch } from 'vue'
import type { ComputedRef } from 'vue'

const KEY = 'chuandengren.ai.v1'

/** 方舟默认上游；用户填别的（DeepSeek / 阿里百炼 / 中转网关）也照收 */
export const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export interface AiProfile {
  /** 本地主键（时间戳生成，只在本机有意义） */
  id: string
  /** 列表里显示的名字；留空则用模型名 */
  label: string
  /** OpenAI 兼容上游，`POST {baseUrl}/chat/completions` */
  baseUrl: string
  model: string
  apiKey: string
}

interface Store {
  profiles: AiProfile[]
  /** 当前启用的配置；null ＝ 用服务端默认（.env / .env.local） */
  activeId: string | null
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { profiles: [], activeId: null }
    const parsed = JSON.parse(raw) as Partial<Store>
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
          .filter((p): p is AiProfile => !!p && typeof p === 'object' && !!p.id)
          .map((p) => ({
            id: String(p.id),
            label: String(p.label ?? ''),
            baseUrl: String(p.baseUrl ?? ''),
            model: String(p.model ?? ''),
            apiKey: String(p.apiKey ?? ''),
          }))
      : []
    const activeId =
      parsed.activeId && profiles.some((p) => p.id === parsed.activeId) ? parsed.activeId : null
    return { profiles, activeId }
  } catch {
    return { profiles: [], activeId: null }
  }
}

/** 统一收口上游地址：空 → 方舟默认；剥掉误粘的 `/chat/completions` 与结尾斜杠 */
export function normalizeBaseUrl(url: string): string {
  const t = (url || '')
    .trim()
    // 常见误填：把完整接口地址整条贴进来（…/v1/chat/completions）。代理还要再拼一次，
    // 不剥就会变成 …/chat/completions/chat/completions → 404
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/+$/, '')
  return t || DEFAULT_BASE_URL
}

/** Key 的显示形态：`ark-…53b4a` 这种。列表里只露头尾，不整串铺在屏幕上 */
export function maskKey(key: string): string {
  const t = (key || '').trim()
  if (!t) return '（未填）'
  if (t.length <= 10) return `${t.slice(0, 2)}…`
  return `${t.slice(0, 4)}…${t.slice(-4)}`
}

/** 保存前校验：返回 '' 表示通过，否则是给人看的一句话 */
export function validateProfile(p: Pick<AiProfile, 'baseUrl' | 'model' | 'apiKey'>): string {
  if (!p.model.trim()) return '模型名称不能为空'
  if (!p.apiKey.trim()) return 'API Key 不能为空'
  const base = normalizeBaseUrl(p.baseUrl)
  if (!/^https?:\/\//i.test(base)) return 'API Base URL 必须以 http:// 或 https:// 开头'
  return ''
}

export interface AiConfigBundle {
  profiles: AiProfile[]
  /** 当前启用的配置 id（getter：模板里读得到变化） */
  readonly activeId: string | null
  /** 当前生效的自定义配置；null＝用服务端默认 */
  active: ComputedRef<AiProfile | null>
  /** 新增或就地修改（同 id 改、同 base+model 视为同一条），并立刻启用 */
  save: (draft: { id?: string; label?: string; baseUrl: string; model: string; apiKey: string }) => AiProfile
  activate: (id: string) => void
  /** 回到服务端默认（不动已保存的配置） */
  useServerDefault: () => void
  remove: (id: string) => void
}

let singleton: AiConfigBundle | null = null

export function useAiConfig(): AiConfigBundle {
  if (singleton) return singleton
  singleton = createBundle()
  return singleton
}

function createBundle(): AiConfigBundle {
  const store = reactive<Store>(load())

  watch(
    store,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v))
      } catch {
        /* 隐私模式禁写：本次会话内仍然生效 */
      }
    },
    { deep: true, immediate: true }
  )

  const active = computed<AiProfile | null>(
    () => store.profiles.find((p) => p.id === store.activeId) ?? null
  )

  function save(draft: {
    id?: string
    label?: string
    baseUrl: string
    model: string
    apiKey: string
  }): AiProfile {
    const baseUrl = normalizeBaseUrl(draft.baseUrl)
    const model = draft.model.trim()
    const apiKey = draft.apiKey.trim()
    const label = (draft.label || '').trim() || model

    // ① 有 id：就地改（设置页点「保存」改的就是当前这条）
    // ② 没 id 但 base+model 已存在：改那一条，避免同一套配置存两份、列表越攒越乱
    const existed =
      store.profiles.find((p) => p.id === draft.id) ??
      store.profiles.find((p) => p.baseUrl === baseUrl && p.model === model)

    if (existed) {
      existed.baseUrl = baseUrl
      existed.model = model
      existed.apiKey = apiKey
      existed.label = label
      store.activeId = existed.id
      return existed
    }

    const item: AiProfile = {
      id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label,
      baseUrl,
      model,
      apiKey,
    }
    store.profiles.push(item)
    store.activeId = item.id
    return item
  }

  function activate(id: string) {
    if (store.profiles.some((p) => p.id === id)) store.activeId = id
  }

  function useServerDefault() {
    store.activeId = null
  }

  function remove(id: string) {
    const i = store.profiles.findIndex((p) => p.id === id)
    if (i < 0) return
    store.profiles.splice(i, 1)
    if (store.activeId === id) store.activeId = null
  }

  return {
    profiles: store.profiles,
    get activeId() {
      return store.activeId
    },
    active,
    save,
    activate,
    useServerDefault,
    remove,
  }
}
