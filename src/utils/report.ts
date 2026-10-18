/**
 * 倾向报告归并（纯函数，无框架依赖）——C3-R
 *
 * 依据：《开发文档》v1.9.1 §3.7.2 ②「按 s1／s2 组合取句」六档表。
 *  - s1＝C2-X（触点①·认知，**可跳过**）、s2＝C3-4（触点②·态度，不可跳过）；
 *  - 预设按 `presetKey` 归并：A→守、B→新、C→**双**（C 档固定台词是"创新才能传承"，
 *    但报告屏仍记为"双"——见 §3.7.2 注）；
 *  - 自由输入按判定值归并：双正→双、守正→守、新正→新、`0/0`→无法归类（走"不同"档）；
 *  - 阿鲟**只报玩家说过什么**：不评价、不预测、不给分。
 *
 * 说明：此处是唯一实现，引擎与校验脚本（scripts/verify-c4.mjs）共用。
 */
import type { ReportConfig, Stance } from '../types/story'

/** 表态归类：守／新／双／未知（0/0 或判定值全为零） */
export type StanceTag = '守' | '新' | '双' | '未知'

export function stanceTagOf(s?: Stance): StanceTag | null {
  if (!s) return null
  if (s.presetKey === 'A') return '守'
  if (s.presetKey === 'B') return '新'
  if (s.presetKey === 'C') return '双'
  // 自由输入：按双轴判定值（预设不会走到这里）
  if (s.tradition > 0 && s.innovation > 0) return '双'
  if (s.tradition > 0) return '守'
  if (s.innovation > 0) return '新'
  return '未知'
}

/**
 * 生成报告句（单句）。
 * 顺序：都跳过 → 只说过一次 → 同档固定句 → 其余一律"不同"档（含 0/0 无法归类）。
 */
export function buildStanceReportLine(stances: Stance[], cfg: ReportConfig): string {
  const [n1, n2] = cfg.stanceNodeIds
  const s1 = stances.find((s) => s.nodeId === n1)
  const s2 = stances.find((s) => s.nodeId === n2)
  const t1 = stanceTagOf(s1)
  const t2 = stanceTagOf(s2)
  const T = cfg.templates

  if (!s1 && !s2) return T.none
  if (!s1 && s2) return T.once.replace('{s1}', s2.text)
  if (s1 && !s2) return T.once.replace('{s1}', s1.text)
  if (t1 === '守' && t2 === '守') return T.bothShou
  if (t1 === '新' && t2 === '新') return T.bothXin
  if (t1 === '双' && t2 === '双') return T.bothShuang
  return T.diff.replace('{s1}', s1!.text).replace('{s2}', s2!.text)
}
