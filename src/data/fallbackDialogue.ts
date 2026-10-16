/**
 * 备用文本台账（《规格书》§4.4 / §4.6）
 * 规则：AI 生成失败、超时、无 Key 时一律落到这里的固定文本，剧情不得中断。
 * 所有本文件文本均为人工编写，展示时不标注「AI 生成」。
 */
import type { Line } from '@/types/story'

/** S04 自由输入的通用备用回应（《规格书》§4.4 示例文本） */
export const ASHUN_FALLBACK_LINES: Line[] = [
  {
    speaker: '阿鲟',
    text: '记录完成。我暂时还不能完全理解，但我会把它和扫描数据一起保存。下一步：确定龙首方案。',
    type: 'dialogue',
  },
]

/** AI 思考中的界面提示 */
export const AI_THINKING_TEXT = '阿鲟正在整理思路……'
export const AI_FALLBACK_BUTTON = '使用备用回应'

/** 每幕收尾的阿鲟存档日志（可选功能 C，固定版，30 字以内） */
export const ACT_LOG_FALLBACK: Record<number, string> = {
  1: '记录：他回答了一个没有标准答案的问题。原因未知。',
  2: '记录：他放弃了一部分精度，我暂时无法归类。',
  3: '记录：这一次，我没有给出建议。',
}

/** 结局页 AI 旅程回顾失败时的处理：不显示补充段（由调用方判断省略） */
export const JOURNEY_SUMMARY_FALLBACK = ''
