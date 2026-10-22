/**
 * `server/ai-proxy.mjs` 的类型声明。
 *
 * 为什么是 `.d.mts`：代理用**纯 JS**写（既能被 `vite.config.ts` 引入，
 * 也能 `node server/ai-proxy.mjs` 单独起服务），而 tsconfig 开了严格检查，
 * 没有声明文件时 `import ... from './server/ai-proxy.mjs'` 会报 TS7016。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface AiConfig {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
  /** 思考模式：disabled（默认）／auto／enabled／default（不传该参数） */
  thinking: string
}

export function readAiConfig(env?: Record<string, string | undefined>): AiConfig

export function handleAiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cfg?: AiConfig
): Promise<void>
