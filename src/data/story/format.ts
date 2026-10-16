/**
 * 剧本录入助手（V3.0，《开发文档》§2.3 节点格式）
 *
 * 节点格式：**画面**（视觉设计依据）→ **声音**（音频 key／音色）→ **文本**（旁白＋台词）→ **选项**。
 * 录入规则（与《审核记录》口径一致）：
 *  - **文本（旁白／台词）**＝玩家可见，逐字录入、不改写；
 *  - **画面／声音／舞台提示**＝仅供创作团队阅读，记为 `stage`（type:'stage'）——
 *    审核模式可见、演示模式（默认）隐藏；
 *  - 序章蒙太奇的旁白以「中央字卡」（caption）缓慢呈现（美感宣言，可跳过不可快进）。
 */
import type { Line, Speaker } from '@/types/story'

/**
 * 中央字卡（渐入 → 停留 → 渐隐 + 按字数自动推进，点击可跳过）。
 * V3.0 用法：**序章蒙太奇旁白**（画面优先、无对白，旁白逐句浮于画面中央）。
 * `sceneTag` / `scriptRaw`：保留给真正的「场景切换题注」场景（本幕暂未使用）。
 */
export const caption = (text: string, sceneTag?: string, scriptRaw?: string): Line => ({
  text,
  type: 'caption',
  sceneTag,
  scriptRaw,
})

/** 剧本题注（画面／声音／舞台提示）：仅审核模式显示（settings.showStageNotes） */
export const stage = (text: string): Line => ({ text, type: 'stage' })

/** 旁白（第一人称叙述 / 说明句）——走底部对白框，不加名字 */
export const nar = (text: string): Line => ({ text, type: 'narration' })

/** 对白 —— 走底部对白框；台词「」为呈现层包装，数据不带引号 */
export const say = (speaker: Speaker, text: string): Line => ({
  speaker,
  text,
  type: 'dialogue',
})

/** 字幕 / 字卡（章题、结局、尾声；如序章末「可现在，河快干了。」） */
export const card = (text: string): Line => ({ text, type: 'subtitle' })
