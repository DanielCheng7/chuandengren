/**
 * 结局分派（纯函数，无框架依赖）
 *
 * 依据：《结局机制设计 v2.1》§4.1/§4.2、《开发文档》v1.6 §3.3
 *  - resolveEnding：T = I → 链 C《灯海相连》；T > I → 链 A；I > T → 链 B
 *  - resolveEndingTier：A 温吞(t≤3)/坚定(t≥4)；B 温吞(i≤3)/坚定(i≥4)；
 *                       C 温吞(t+i=4，即 (2,2))/坚定(t+i=6，即 (3,3))
 *  - isBalancedEp：|T−I|≤1 且 T+I≥3 且结局非 C →「一日一篾」尾声变体
 *
 * 说明：此处是**唯一实现**，引擎与校验脚本（scripts/verify-ending.mjs）共用。
 */
import type { Ending, EndingTier } from '../types/story'

/** 单轴上限（C1 +1、C2 +1、C2-X +2、C3-4 +2） */
export const MAX_AXIS = 6

/**
 * 结局分派器（两行）。团队口径：守旧值与创新值**相等**即"两笔账一样重"，
 * 进合流链；否则谁多归谁。
 */
export function resolveEnding(t: number, i: number): Ending {
  if (t === i) return 'C'
  return t > i ? 'A' : 'B'
}

/** 强度分层：A/B 各两档；C 按双轴总量分两档（(2,2) 温吞、(3,3) 坚定） */
export function resolveEndingTier(ending: Ending, t: number, i: number): EndingTier {
  if (ending === 'A') return t <= 3 ? 'mild' : 'firm'
  if (ending === 'B') return i <= 3 ? 'mild' : 'firm'
  return t + i <= 4 ? 'mild' : 'firm'
}

/** 「一日一篾」尾声变体：|T−I|≤1 且 T+I≥3 且非合流（共 4 组） */
export function isBalancedEp(t: number, i: number): boolean {
  return Math.abs(t - i) <= 1 && t + i >= 3 && t !== i
}
