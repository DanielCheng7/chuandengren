/**
 * 剧情数据汇总
 * 按幕分文件录入（act1 / act2 / act3），此处合并为运行时索引。
 * 新增幕时只需在下面 import 并加入 NODE_GROUPS。
 */
import type { StoryNode } from '@/types/story'
import { act1Nodes } from './act1'

/** 起始节点 */
export const START_NODE_ID = 'S01'

const NODE_GROUPS: StoryNode[][] = [
  act1Nodes,
  // act2Nodes,  // 步骤 5B（第二幕数据化）待审核卡点 ① 通过后接入
  // act3Nodes,  // 步骤 5C（第三幕数据化）待审核卡点 ② 通过后接入
]

export const storyNodes: Record<string, StoryNode> = Object.fromEntries(
  NODE_GROUPS.flat().map((n) => [n.id, n])
)

/** 节点播放顺序（用于进度条与调试跳转） */
export const storyOrder: string[] = NODE_GROUPS.flat().map((n) => n.id)

/** 幕 → 入口节点 */
export const ACTS: { act: 1 | 2 | 3; title: string; entry: string }[] = [
  { act: 1, title: '第一幕「归」', entry: 'S01' },
  { act: 2, title: '第二幕「问」', entry: 'S05' },
  { act: 3, title: '第三幕「灯」', entry: 'S09' },
]

export function getNode(id: string): StoryNode | undefined {
  return storyNodes[id]
}

/** 当前节点在全局序列中的位置，返回 0–1 */
export function nodeProgress(id: string): number {
  const i = storyOrder.indexOf(id)
  if (i < 0) return 0
  return Math.min(1, (i + 1) / storyOrder.length)
}

export function firstNodeOfAct(act: 1 | 2 | 3): string {
  return ACTS.find((a) => a.act === act)?.entry ?? START_NODE_ID
}
