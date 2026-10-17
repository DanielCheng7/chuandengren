/**
 * 打字机效果（可关闭，点击可跳过）
 */
import { onUnmounted, ref, watch, type Ref } from 'vue'

const PAUSE_CHARS = '，。！？…、；：—”’'

export function useTypewriter(
  text: Ref<string | null | undefined>,
  enabled: Ref<boolean>,
  speed: Ref<number>
) {
  const displayed = ref('')
  const typing = ref(false)
  let timer: number | undefined
  let chars: string[] = []
  let cursor = 0

  function clear() {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
  }

  function step() {
    if (cursor >= chars.length) {
      typing.value = false
      timer = undefined
      return
    }
    const ch = chars[cursor]
    cursor += 1
    displayed.value += ch
    const extra = PAUSE_CHARS.includes(ch) ? speed.value * 6 : 0
    timer = window.setTimeout(step, speed.value + extra)
  }

  function run() {
    clear()
    const full = text.value ?? ''
    if (!enabled.value) {
      chars = Array.from(full)
      cursor = chars.length
      displayed.value = full
      typing.value = false
      return
    }
    chars = Array.from(full)
    cursor = 0
    displayed.value = ''
    typing.value = chars.length > 0
    step()
  }

  /** 立即显示全文 */
  function skip() {
    clear()
    displayed.value = text.value ?? ''
    cursor = chars.length
    typing.value = false
  }

  // 仅 text / enabled 变化才重启打字；speed 变化不重启——
  // step() 每步都现读 speed.value，新速度从下一个字自然生效，
  // 避免打字中途调速把已打内容清空重来（BUG-2 修复）
  watch([text, enabled], run, { immediate: true })
  onUnmounted(clear)

  return { displayed, typing, skip }
}
