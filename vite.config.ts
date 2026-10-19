import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), audioRoutePlugin()],
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
})
