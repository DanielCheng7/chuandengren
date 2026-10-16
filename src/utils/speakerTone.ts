/**
 * 说话人语气色映射（V3.0，《开发文档》§5.6）
 * 对话名字（DialogueBox）与回看名字（HistoryPanel）共用，保证两处颜色一致。
 *
 * 阿鲟＝暖金｜知遥＝烛光橙（高亮，主角）｜九婆＝纱纸白｜阿禾＝竹青｜周经理＝暗红族；
 * 旁白/未定义说话人＝次级灰。（奶奶／林父随 V3.0 淡出；管理员按未定义处理。）
 */
export type SpeakerTone = 'gold' | 'candle' | 'bamboo' | 'seal' | 'paper' | 'dim'

export function speakerTone(speaker?: string): SpeakerTone {
  switch (speaker) {
    case '阿鲟':
      return 'gold'
    case '知遥':
      return 'candle'
    case '九婆':
      return 'paper'
    case '阿禾':
      return 'bamboo'
    case '周经理':
      return 'seal'
    default:
      return 'dim'
  }
}
