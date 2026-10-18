/**
 * 说话人语气色映射（V3.0，《开发文档》§5.6）
 * 对话名字（DialogueBox）与回看名字（HistoryPanel）共用，保证两处颜色一致。
 *
 * **2026-10-18 用户决议：所有角色的名字统一用九婆的配色（纱纸白）**——
 * 不再按角色分色（原「阿鲟暖金／知遥烛光橙／阿禾竹青／周经理暗红」作废）。
 * 旁白与未定义说话人仍为次级灰，保证「有名字的对白」与「无名字的旁白」可区分。
 *
 * 说明：`characters.ts` 里各角色的 `tone` 字段保留（人物设定与素材侧仍按角色归类），
 * 名字渲染只走本文件，不再读角色 tone。
 */
export type SpeakerTone = 'paper' | 'dim'

export function speakerTone(speaker?: string): SpeakerTone {
  return speaker ? 'paper' : 'dim'
}
