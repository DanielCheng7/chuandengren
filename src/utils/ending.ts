/**
 * 结局分派（纯函数，无框架依赖）
 *
 * 依据：《结局机制设计 v2.0》§4.1/§4.2、《开发文档》v1.5 §3.3
 *  - resolveEnding：双高优先 → 平手归灯（T ≥ I）→ 其余归海
 *  - resolveEndingTier：A 空版／温吞／坚定；B 温吞／坚定；C 不分层
 *  - isBalancedEp：|T−I|≤1 且 T+I≥3 且非双高 → 「一日一篾」尾声变体
 *
 * 说明：此处是**唯一实现**，引擎与校验脚本（scripts/verify-ending.mjs）共用。
 */
import type { Ending, EndingTier } from '../types/story'

/** 单轴上限（三处表态，各 0–6） */
export const MAX_AXIS = 6

/**
 * 结局分派器（三行按顺序命中即停）。顺序有意义：
 *  ① 双高 (3,3) → C《两条河》；
 *  ② 平手归灯：T ≥ I → A《灯还亮着》；
 *  ③ 其余 → B《鱼入海》。
 */
export function resolveEnding(t: number, i: number): Ending {
  if (t >= 3 && i >= 3) return 'C'
  if (t >= i) return 'A'
  return 'B'
}

/** 强度分层：链 C 不分层（返回 undefined） */
export function resolveEndingTier(
  ending: Ending,
  t: number,
  i: number
): EndingTier | undefined {
  if (ending === 'A') {
    if (t <= 1 && i <= 1) return 'empty'
    return t <= 3 ? 'mild' : 'firm'
  }
  if (ending === 'B') return i <= 3 ? 'mild' : 'firm'
  return undefined
}

/** 「一日一篾」尾声变体：|T−I|≤1 且 T+I≥3 且非双高（共 5 组） */
export function isBalancedEp(t: number, i: number): boolean {
  return Math.abs(t - i) <= 1 && t + i >= 3 && !(t >= 3 && i >= 3)
}
