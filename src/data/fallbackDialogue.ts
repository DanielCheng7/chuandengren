/**
 * 备用文本台账（V3.0，《开发文档》§3 触点规范 / §5.10）
 * 规则：AI 判定失败、超时、无 Key 时落到这里的固定文本，剧情不得中断。
 * 本文件文本均为人工编写，展示时不标注「AI 生成」。
 */
import type { Line } from '@/types/story'

/** 判定失败 / 超时 / 非法格式 → 落 0/0 的收束文本（《开发文档》§5.10） */
export const ASHUN_FALLBACK_LINES: Line[] = [
  {
    speaker: '阿鲟',
    text: '已记录。这一句，我暂时归不了类。',
    type: 'dialogue',
  },
]

/** AI 思考中的界面提示（仅自由输入路径） */
export const AI_THINKING_TEXT = '阿鲟正在整理思路……'

/** 判定失败/超时后的恢复按钮（《开发文档》§5.10） */
export const AI_FALLBACK_BUTTON = '使用备用判定'
