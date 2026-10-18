/**
 * C4｜你的手，往哪里放（结算节点 · 无选项）
 *
 * 文案来源：《传灯人·游鱼_互动叙事剧本 r8》§2.3 末尾（与 `思路/最终版剧情/第三章.txt` 一致）
 *
 * 机制（《开发文档》§3.6）：
 *  - **没有任何选项、不调 AI**：前面的四处数值（C1／C2／C2-X／C3-4）已经决定走到哪；
 *  - 进入即结算（引擎 `kind==='settle'` → `settleEnding()` 写 `ending`／`endingTier`／`balancedEp`）；
 *  - 结算独白按 `axisDiff` 取一句（T>I／I>T／T=I），**只报方向、不报数字、不评价**；
 *  - 开春转场按落点（链 A／B 各两档、链 C 一档）取句；
 *  - 播完按 `nextByEnding` 进入链 A／B／C 首个节点（步骤 36–38 未接入 → 断点屏，属预期）。
 */
import type { StoryNode } from '@/types/story'
import { nar, narIf, stage } from './format'

const CHAPTER = '最终抉择·你的手往哪里放'

export const c4Nodes: StoryNode[] = [
  {
    id: 'C4',
    chapter: CHAPTER,
    sectionTitle: 'C4｜你的手，往哪里放（结算节点 · 无选项）',
    scene: 'lantern_workshop',
    kind: 'settle',
    lines: [
      stage('【C4】你的手，往哪里放（结算节点 · 无选项、不调 AI）'),
      stage(
        '画面：灯坊（lantern_workshop 深夜版）与工作室（studio_night）左右各半，中间是知遥的手——一只手边竹篾，一只手边数位笔。'
      ),
      stage('声音：两个 key 各半秒交替，渐弱至无声。'),
      nar('开春，导师的电话来了两回——毕业设计，只能做一个方向。'),
      nar('九婆的手开始抖了。阿禾的展期，定在五月。'),
      nar('一个春天，只够把一件事做出个样子。'),
      nar('竹篾和数位笔，都搁在桌上。'),
      // —— 结算独白（按走向取一句；「灯不出去，人进来」等为独白里的内文引用）——
      narIf('留下来，把灯坊开起来——"灯不出去，人进来。"', [{ key: 'axisDiff', gte: 1 }]),
      narIf('跟阿禾走，让鱼先游出去——"人没看见，鱼先游过去。"', [{ key: 'axisDiff', lte: -1 }]),
      narIf('把灯坊与海连成一片——"灯在手里，鱼在眼前。"', [{ key: 'axisDiff', gte: 0, lte: 0 }]),
      // —— 开春转场（按落点取句：链 C 一档、链 A／B 各两档）——
      narIf('开春，灯坊的门开着，工作室的灯也亮着。', [{ key: 'ending', eq: 'C' }]),
      narIf('开春，我把行李搬回了灯坊。', [
        { key: 'ending', eq: 'A' },
        { key: 'endingTier', eq: 'firm' },
      ]),
      narIf('开春，我留了下来。', [
        { key: 'ending', eq: 'A' },
        { key: 'endingTier', eq: 'mild' },
      ]),
      narIf('开春，我退了城里的房，跟着阿禾去了省城。', [
        { key: 'ending', eq: 'B' },
        { key: 'endingTier', eq: 'firm' },
      ]),
      narIf('开春，我跟着阿禾去了省城。', [
        { key: 'ending', eq: 'B' },
        { key: 'endingTier', eq: 'mild' },
      ]),
    ],
    nextByEnding: { A: 'A1', B: 'B1', C: 'E1' },
    note: '结算节点：无选项、不调 AI；独白只报方向；播完按 ending 进链 A／B／C。',
  },
]
