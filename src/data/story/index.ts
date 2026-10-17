/**
 * 剧情数据汇总（V3.0）
 *
 * 按章分文件录入（prologue / c1 / c2 …），此处合并为运行时索引。
 * 新增一章时只需在下面 import 并加入 NODE_GROUPS（沿用《开发文档》§7.3 分章开发流程）。
 */
import type { StoryNode } from '@/types/story'
import { prologueNodes } from './prologue'
import { c1Nodes } from './c1'

/** 起始节点：序章第一屏 */
export const START_NODE_ID = 'PRO-1'

const NODE_GROUPS: StoryNode[][] = [
  prologueNodes,
  c1Nodes,
  // c2Nodes,  // 步骤 33（第二章数据化）待审核卡点 ① 通过后接入
  // c3Nodes,  // 步骤 34（第三章数据化）待审核卡点 ② 通过后接入
  // chainsNodes, // 步骤 36–38（C4／两条链／EP）待审核卡点 ③ 通过后接入
]

/** 全量节点（构建索引与顺序表共用） */
const ALL_NODES: StoryNode[] = NODE_GROUPS.flat()

// 开发期校验（RISK-6）：重复节点 id 会被 fromEntries 静默覆盖，导致剧情链路错位——
// 构建时即暴露，避免分章录入重号后难以排查
if (import.meta.env.DEV) {
  const seen = new Set<string>()
  for (const n of ALL_NODES) {
    if (seen.has(n.id)) console.error(`[story] 重复节点 id：${n.id}，后者已覆盖前者，请检查剧本数据`)
    seen.add(n.id)
  }
}

export const storyNodes: Record<string, StoryNode> = Object.fromEntries(
  ALL_NODES.map((n) => [n.id, n])
)

/** 节点播放顺序（用于进度与调试跳转） */
export const storyOrder: string[] = ALL_NODES.map((n) => n.id)

/**
 * 章节入口（V3.0 章序；调试跳转 + 回看分组依据）。
 * 含尚未接入的章节——便于分章开发时快速核对断点（引擎会落到「未接入」幕间面板）。
 */
export const CHAPTERS: { key: string; title: string; entry: string }[] = [
  { key: 'PRO', title: '序章·一盏灯的一生', entry: 'PRO-1' },
  { key: 'C1', title: '第一章·灯往何处去', entry: 'C1-1' },
  { key: 'C2', title: '第二章·两条路', entry: 'C2-0' },
  { key: 'C3', title: '第三章·灯会前夜', entry: 'C3-1' },
  { key: 'C4', title: '最终抉择·你的手往哪里放', entry: 'C4' },
  { key: 'A', title: '链A·守旧线', entry: 'A1' },
  { key: 'B', title: '链B·创新线', entry: 'B1' },
  { key: 'EP', title: '尾声·游鱼夜', entry: 'EP' },
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
