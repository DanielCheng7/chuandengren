/**
 * 人物立绘位（V3.0，《开发文档》§4.1 人物速览）
 *
 * 素材未到位时不显示任何立绘框，只保留对白框里的角色名条；
 * 立绘放进 public/assets/characters/ 即自动启用，**无需改代码**。
 *
 * 规格（《传灯人·游鱼_素材落位规范》§2，2026-10-19 实测定稿）：
 *  - 透明底 WebP，**人物高占图高 ≈96%、贴底居中**，画布约 460–500 × 1442（约 1:3）；
 *  - 不强制 2:3（本项目素材是 16:9 全身像裁出，2:3 生成图也能用，只是两侧留白更多）；
 *  - 由 `scripts/import-characters.py` 从 `photo/角色形象/*.png` 批量裁切。
 *
 * 名字颜色不在这里配：2026-10-18 用户决议统一走 `utils/speakerTone.ts`
 * （全部角色纱纸白、旁白次级灰），本表原先的 `tone` 字段已作为死字段移除。
 *
 * V3.0：新增 阿禾（创新链核心）／周经理（现实压力，不设为反派）；
 *       林父／奶奶淡出不出场（奶奶仅以「没扎完的鳌鱼灯」作引子道具），条目移除。
 */
export interface CharacterDef {
  /** 显示名 */
  name: string
  /** 立绘文件（相对 /assets/characters/），缺省＝暂无立绘 */
  asset?: string
}

export const CHARACTERS: Record<string, CharacterDef> = {
  知遥: { name: '林知遥', asset: 'char-lin-zhiyao-b.webp' },
  九婆: { name: '九婆', asset: 'char-jiupo.webp' },
  阿禾: { name: '阿禾', asset: 'char-ahe.webp' },
  周经理: { name: '周经理', asset: 'char-zhou.webp' },
  阿鲟: { name: '阿鲟', asset: 'char-ashun.webp' }, // 鱼灯本体立绘（photo/阿鲟 透明 PNG 转 webp），走 CharacterLayer 的独立档位
}

export function getCharacter(speaker?: string): CharacterDef | undefined {
  if (!speaker) return undefined
  return CHARACTERS[speaker]
}
