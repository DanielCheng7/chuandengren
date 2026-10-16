/**
 * 说话人语气色映射（《UI 设计书 r4》§4.5，2026-10-16 更新）
 * 对话名字（DialogueBox）与回看名字（HistoryPanel）共用，保证两处颜色一致。
 *
 * 阿鲟＝暖金｜知遥＝烛光橙（高亮，主角）｜林父＝竹青｜奶奶＝暗红族｜九婆＝纱纸白；
 * 旁白/未定义说话人＝次级灰。
 */
export type SpeakerTone = 'gold' | 'candle' | 'bamboo' | 'seal' | 'paper' | 'dim'

export function speakerTone(speaker?: string): SpeakerTone {
  switch (speaker) {
    case '阿鲟':
      return 'gold'
    case '知遥':
      return 'candle'
    case '林父':
      return 'bamboo'
    case '奶奶':
      return 'seal'
    case '九婆':
      return 'paper'
    default:
      return 'dim'
  }
}
