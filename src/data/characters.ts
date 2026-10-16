/**
 * 人物立绘位（制作计划 §0.4）
 *
 * 素材未到位时不显示任何立绘框，只保留对白框里的角色名条与语气色；
 * AI 生成的立绘（2:3，透明底）放进 public/assets/characters/ 即自动启用。
 * 命名对齐《人物设定与场景设计 r2》：char-lin-zhiyao-a.webp 等。
 */
export interface CharacterDef {
  /** 显示名 */
  name: string
  /** 立绘文件（相对 /assets/characters/），缺省＝暂无立绘 */
  asset?: string
  /** 语气色（对白框名条用，见 global.css） */
  tone: 'gold' | 'bamboo' | 'seal' | 'paper' | 'dim'
}

export const CHARACTERS: Record<string, CharacterDef> = {
  知遥: { name: '林知遥', asset: 'char-lin-zhiyao-b.webp', tone: 'dim' },
  林父: { name: '林父', asset: 'char-lin-fu.webp', tone: 'bamboo' },
  九婆: { name: '九婆', asset: 'char-jiupo.webp', tone: 'paper' },
  奶奶: { name: '林奶奶', asset: 'char-nainai.webp', tone: 'seal' },
  阿鲟: { name: '阿鲟', tone: 'gold' }, // 非人形角色，由 AiFish 组件承担
}

export function getCharacter(speaker?: string): CharacterDef | undefined {
  if (!speaker) return undefined
  return CHARACTERS[speaker]
}
