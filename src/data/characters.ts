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
  /**
   * 立绘：**按站位分左右两版**（2026-10-19 用户补充素材）。
   * 站在左槽用 `left`，右槽用 `right`；缺某一侧时自动回退另一侧。
   */
  assets?: { left?: string; right?: string }
  /** 兼容字段：只有一张、不分站位时使用（现已被 assets 取代） */
  asset?: string
  /**
   * 主角不上立绘（第一人称视角，2026-10-19 用户要求与市面 galgame 一致）：
   * 知遥是"我"，只有名条与台词，画面里不出现自己。
   */
  noPortrait?: boolean
  /** `ai`＝阿鲟（横卧鱼灯，站位与人相同，仅尺寸档位不同） */
  kind?: 'human' | 'ai'
}

/** 站位槽位：左／右（由 cast 顺序决定，第 1 位在左、第 2 位在右） */
export type PortraitSide = 'left' | 'right'

export const CHARACTERS: Record<string, CharacterDef> = {
  知遥: {
    name: '林知遥',
    assets: { left: 'char-lin-zhiyao-b-left.webp', right: 'char-lin-zhiyao-b-right.webp' },
    noPortrait: true,
  },
  九婆: {
    name: '九婆',
    assets: { left: 'char-jiupo-left.webp', right: 'char-jiupo-right.webp' },
    kind: 'human',
  },
  阿禾: {
    name: '阿禾',
    assets: { left: 'char-ahe-left.webp', right: 'char-ahe-right.webp' },
    kind: 'human',
  },
  周经理: {
    name: '周经理',
    assets: { left: 'char-zhou-left.webp', right: 'char-zhou-right.webp' },
    kind: 'human',
  },
  阿鲟: {
    name: '阿鲟',
    assets: { left: 'char-ashun-left.webp', right: 'char-ashun-right.webp' },
    kind: 'ai',
  },
}

export function getCharacter(speaker?: string): CharacterDef | undefined {
  if (!speaker) return undefined
  return CHARACTERS[speaker]
}

/** 该角色是否配了立绘（任一侧即可） */
export function hasPortrait(speaker?: string): boolean {
  const c = getCharacter(speaker)
  return !!c && !!(c.assets?.left || c.assets?.right || c.asset)
}

/**
 * 取某角色在指定站位的立绘文件名。
 * 该侧缺失时回退另一侧（素材未补齐也能显示，只是姿势可能不贴合）。
 */
export function portraitOf(speaker?: string, side: PortraitSide = 'left'): string | undefined {
  const c = getCharacter(speaker)
  if (!c) return undefined
  const other: PortraitSide = side === 'left' ? 'right' : 'left'
  return c.assets?.[side] ?? c.assets?.[other] ?? c.asset
}

/**
 * 能否作为「在场角色」站在画面里：有立绘、且不是第一人称主角。
 * **阿鲟也算角色**（2026-10-19 用户决议）——它跟人物同一套站位规则，
 * 只是自身是 2:1 横卧鱼灯，尺寸与落点单独处理（见 CharacterLayer）。
 */
export function canStandOnStage(speaker?: string): boolean {
  return hasPortrait(speaker) && !getCharacter(speaker)?.noPortrait
}

/**
 * 同屏上限（2026-10-19 用户第二次收窄）：一个场景**最多同时 2 名角色**，
 * 超出按主次优先级取舍；被裁掉的角色本场景不入场，等下一个场景再出现。
 */
export const CAST_MAX = 2

/**
 * 站台优先级：数字越小越优先保留（剧情主次，非出场先后）。
 * 九婆（守）＞阿禾（新）＞周经理（现实压力）＞阿鲟（数据辅助，可只留名条）。
 * 调整顺序＝调整"人多时谁让位"，只改这一张表。
 */
export const CAST_PRIORITY: Record<string, number> = {
  九婆: 1,
  阿禾: 2,
  周经理: 3,
  阿鲟: 4,
}

/**
 * 把候选角色裁到同屏上限：
 *  ① **`pin`（本节点说话人）先占位**——谁在这段里开口，谁就必须在场，
 *    否则会出现"周经理说话、台上没他"的错位；
 *  ② 剩余名额按 `CAST_PRIORITY` 补，同级按原顺序；
 *  ③ 最后**还原原顺序**（站位按 cast 顺序排，不还原会让人物莫名调位）。
 */
export function limitCast(list: string[], max = CAST_MAX, pin: string[] = []): string[] {
  const uniq = [...new Set(list.filter((s) => canStandOnStage(s)))]
  if (uniq.length <= max) return uniq
  const rank = (s: string) => CAST_PRIORITY[s] ?? 99
  const pinSet = new Set(pin.filter((s) => uniq.includes(s)))
  const kept = new Set<string>()
  // ① 说话人优先：pins 本身超过上限时，也在 pins 内部按优先级取
  const pinned = uniq
    .filter((s) => pinSet.has(s))
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
  for (const x of pinned) {
    if (kept.size >= max) break
    kept.add(x.s)
  }
  // ② 余下名额按优先级补（同级按登场先后）
  const rest = uniq
    .filter((s) => !kept.has(s))
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
  for (const x of rest) {
    if (kept.size >= max) break
    kept.add(x.s)
  }
  // ③ 还原原顺序 → 站位稳定
  return uniq.filter((s) => kept.has(s))
}

/**
 * 剔除**背景图里已经画进去的角色**（`StoryNode.backdropCast`）。
 *
 * 背景是实拍／插画时常常自带人物：`bg_gift_shop.webp` 里阿禾正伸手拿手机壳、
 * `ch1/C1-5_workshop_door.webp` 里九婆坐在门槛上编竹篾。这些角色若再叠立绘，
 * 画面里就会出现"两个人"。所以凡是背景已画入的角色，一律不再出立绘，
 * 台词与名条照常显示（对白框里的名字不受影响）。
 *
 * @param list 已按上限裁好的 cast
 * @param node 当前节点（读 `backdropCast`；未配置时原样返回）
 */
export function stripBackdropCast(
  list: string[],
  node: { backdropCast?: string[] }
): string[] {
  const baked = node.backdropCast
  if (!baked || baked.length === 0) return list
  const skip = new Set(baked)
  const out = list.filter((s) => !skip.has(s))
  return out.length === list.length ? list : out
}
