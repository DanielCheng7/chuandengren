/**
 * 人物立绘位（V3.0，《开发文档》§4.1 人物速览）
 *
 * 素材未到位时不显示任何立绘框，只保留对白框里的角色名条与语气色；
 * AI 生成的立绘（2:3，透明底）放进 public/assets/characters/ 即自动启用。
 * 命名对齐《人物设定与场景设计 r4》：char-lin-zhiyao-*.webp 等。
 *
 * V3.0：新增 阿禾（创新链核心）／周经理（现实压力，不设为反派）；
 *       林父／奶奶淡出不出场（奶奶仅以「没扎完的鳌鱼灯」作引子道具），条目移除。
 */
export interface CharacterDef {
  /** 显示名 */
  name: string
  /** 立绘文件（相对 /assets/characters/），缺省＝暂无立绘 */
  asset?: string
  /** 语气色（与 speakerTone 同源；对白框名条用，见 global.css） */
  tone: 'gold' | 'candle' | 'bamboo' | 'seal' | 'paper' | 'dim'
}

export const CHARACTERS: Record<string, CharacterDef> = {
  知遥: { name: '林知遥', asset: 'char-lin-zhiyao-b.webp', tone: 'candle' },
  九婆: { name: '九婆', asset: 'char-jiupo.webp', tone: 'paper' },
  阿禾: { name: '阿禾', asset: 'char-ahe.webp', tone: 'bamboo' },
  周经理: { name: '周经理', asset: 'char-zhou.webp', tone: 'seal' },
  阿鲟: { name: '阿鲟', tone: 'gold' }, // 非人形角色，由 AiFish 组件承担
}

export function getCharacter(speaker?: string): CharacterDef | undefined {
  if (!speaker) return undefined
  return CHARACTERS[speaker]
}
