import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { handleAiRequest, readAiConfig } from './server/ai-proxy.mjs'

const AUDIO_DIR = fileURLToPath(new URL('./public/assets/audio/', import.meta.url))

/**
 * 音频路由：`/media/<key>` → `public/assets/audio/<file>.mp3`
 *
 * 为什么不用 `/assets/audio/xxx.mp3` 直链：装了 IDM 这类下载管理器时，
 * 浏览器插件一看到 URL 以 `.mp3` 结尾就把它当下载，弹「添加下载任务」窗口，
 * 严重时干脆把媒体请求接管走，页面里就**没有声音**。
 * 换成无扩展名的 `/media/bgm-title` 后，插件按后缀匹配抓不到，页面正常拿到 audio/mpeg。
 *
 * 纯静态部署（无 Node 服务）时该路由不存在，`useAudio` 会自动回退到
 * `/assets/audio/xxx.mp3` 直链，所以构建产物本身不依赖这段逻辑。
 */
const AUDIO_MAP: Record<string, string> = {
  'bgm-title': 'bgm_title.mp3',
  'bgm-story': 'bgm_story.mp3',
}

function audioMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = (req.url || '').split('?')[0]
    const m = /^\/media\/([a-z0-9-]+)$/.exec(path)
    const file = m ? AUDIO_MAP[m[1]] : undefined
    if (!file) return next()

    const full = AUDIO_DIR + file
    if (!existsSync(full)) {
      res.statusCode = 404
      res.end('audio not found')
      return
    }
    const buf = readFileSync(full)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

    // 基础 Range 支持：部分浏览器加载音频时会先探 bytes=0-
    const range = req.headers.range
    if (range) {
      const r = /bytes=(\d*)-(\d*)/.exec(range)
      if (r) {
        const start = r[1] ? Number(r[1]) : 0
        const end = r[2] ? Number(r[2]) : buf.length - 1
        if (start < buf.length) {
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`)
          res.setHeader('Content-Length', end - start + 1)
          res.end(buf.subarray(start, end + 1))
          return
        }
      }
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${buf.length}`)
      res.end()
      return
    }

    res.setHeader('Content-Length', buf.length)
    res.end(buf)
  }
}

/** 中间件不是 server/preview 的配置项，而是插件钩子 */
function audioRoutePlugin(): Plugin {
  return {
    name: 'cdr-audio-route',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(audioMiddleware())
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(audioMiddleware())
    },
  }
}

/**
 * AI 代理路由：`POST /api/ai` → 上游大模型（实现见 `server/ai-proxy.mjs`）。
 *
 * 存在的意义只有一个——**Key 不进前端**：浏览器只认同源路径，Key 留在
 * `.env.local`（已 gitignore）由服务端进程读。dev 与 preview 都挂上，
 * 这样 `npm run preview` 也能演示真实 AI；纯静态托管时改用
 * `node server/ai-proxy.mjs` 单独起一个服务，再把 `VITE_AI_ENDPOINT` 指过去。
 */
function aiRoutePlugin(env: Record<string, string>): Plugin {
  return {
    name: 'cdr-ai-route',
    configureServer(server: ViteDevServer) {
      const cfg = readAiConfig(env)
      logAiConfig(cfg)
      server.middlewares.use('/api/ai', (req, res) => {
        void handleAiRequest(req, res, cfg)
      })
    },
    configurePreviewServer(server: PreviewServer) {
      // preview 不再打印，避免与 build 日志混在一起（配置同源，dev 已提示过）
      const cfg = readAiConfig(env)
      server.middlewares.use('/api/ai', (req, res) => {
        void handleAiRequest(req, res, cfg)
      })
    },
  }
}

/** 启动时报一行配置状态：没配 Key 也能跑（前端自动退 mock），但要让开发知道 */
function logAiConfig(cfg: ReturnType<typeof readAiConfig>) {
  const tag = cfg.apiKey && cfg.model ? '✅' : '⚠️'
  console.log(
    `${tag} [ai] 上游 ${cfg.baseUrl} ｜ 模型 ${cfg.model || '(未配置)'} ｜ 思考 ${
      cfg.thinking === 'default' ? '不传' : cfg.thinking
    } ｜ Key ${cfg.apiKey ? `已配置(${cfg.apiKey.slice(0, 8)}…)` : '缺失 → 前端走 mock'}`
  )
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 第三个参数传 '' = 不做 VITE_ 前缀过滤，`AI_*` 这类服务端变量才读得到
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), audioRoutePlugin(), aiRoutePlugin(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true, // 便于用手机在同一局域网访问，测移动端竖屏
      port: 5173,
    },
    build: {
      // 演示包体积不重要，优先保证可读的报错与稳定的产物
      sourcemap: true,
    },
  }
})
