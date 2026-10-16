/**
 * 序章 PRO｜一盏灯的一生（PRO-1…PRO-6）
 *
 * 文案来源：**《传灯人·游鱼_开发文档》v1.0 §2.3（整合自剧本 V3.0·r2）**
 * 录入原则：
 *  - 旁白 → 画面中央字卡（caption，蒙太奇，可跳过不可快进），逐字录入、不改写；
 *  - 画面／声音 → `stage`（仅审核模式显示，供创作团队核对）；演示模式（默认）不显示。
 *
 * 演出说明：
 *   ① 每个节点按「画面 → 声音 → 旁白」顺序排列；**画面／声音是设计依据，不给玩家看**——
 *      玩家只看到旁白字卡（及 PRO-6 的字卡「可现在，河快干了。」）；
 *   ② 序章节奏：慢——旁白字卡按字数自动推进（2.5–7.5s），全程可「跳过序章」（右上快捷键），
 *      不可快进；
 *   ③ 节点类型 `montage`：引擎跳过逻辑（skipMontage）沿链路直达 C1-1，跳过不计访问。
 *
 * 场景映射（《开发文档》§4.2）：PRO-1 `dry_field`（声音层）→ PRO-2～5 `lantern_workshop`
 * （工艺特写；PRO-5 声音 key 为 `banyan_night` 点亮段）→ PRO-6 `fish_parade`（俯瞰）。
 */
import type { StoryNode } from '@/types/story'
import { caption, card, stage } from './format'

const CHAPTER = '序章·一盏灯的一生'

export const prologueNodes: StoryNode[] = [
  /* ============ PRO-1｜竹 ============ */
  {
    id: 'PRO-1',
    chapter: CHAPTER,
    sectionTitle: 'PRO-1｜竹',
    scene: 'dry_field',
    kind: 'montage',
    lines: [
      stage('【PRO-1】竹'),
      stage('画面：晨光后山竹林，露水未干。一只手握篾刀入竹，刀锋劈开的瞬间，竹纤维绽出细白的绒。'),
      stage('声音：dry_field 风声起底，篾刀脆响。'),
      caption('一条鱼，先是一根竹。'),
    ],
    nextNodeId: 'PRO-2',
  },

  /* ============ PRO-2｜骨 ============ */
  {
    id: 'PRO-2',
    chapter: CHAPTER,
    sectionTitle: 'PRO-2｜骨',
    scene: 'lantern_workshop',
    kind: 'montage',
    lines: [
      stage('【PRO-2】骨'),
      stage('画面：竹篾在烛火上烘软，双手把它弯成弧——骨架在老木台上一圈圈立起来，像鱼的脊椎。火光映在手背。'),
      stage('声音：lantern_workshop 深夜版。'),
      caption('火把竹烤软，手把竹弯弯。'),
      caption('骨头对了，鱼才立得住。'),
    ],
    nextNodeId: 'PRO-3',
  },

  /* ============ PRO-3｜纸 ============ */
  {
    id: 'PRO-3',
    chapter: CHAPTER,
    sectionTitle: 'PRO-3｜纸',
    scene: 'lantern_workshop',
    kind: 'montage',
    lines: [
      stage('【PRO-3】纸'),
      stage('画面：纱纸蒙上骨架，灯从纸背透出来，纤维纹路像鱼鳍的脉络。'),
      stage('声音：lantern_workshop（纱纸摩擦声在环境层）。'),
      caption('纸是它的皮。'),
      caption('糊纸那天不许说话——老规矩，怕口气惊了鱼。'),
    ],
    nextNodeId: 'PRO-4',
  },

  /* ============ PRO-4｜鳞 ============ */
  {
    id: 'PRO-4',
    chapter: CHAPTER,
    sectionTitle: 'PRO-4｜鳞',
    scene: 'lantern_workshop',
    kind: 'montage',
    lines: [
      stage('【PRO-4】鳞'),
      stage('画面：金红颜料一笔压一笔叠出鳞。笔尖悬在最上一片鳞的上方，停住——那里空着。'),
      stage('声音：lantern_workshop，几乎无声。'),
      caption('最后一片鳞不画满。'),
      caption('留一笔，给点睛的手。'),
    ],
    nextNodeId: 'PRO-5',
  },

  /* ============ PRO-5｜火 ============ */
  {
    id: 'PRO-5',
    chapter: CHAPTER,
    sectionTitle: 'PRO-5｜火',
    scene: 'lantern_workshop',
    kind: 'montage',
    lines: [
      stage('【PRO-5】火'),
      stage('画面：烛火探进鱼腹，整条鱼亮起来。竹篾的影子在纱纸上浮出——像骨骼，像游动。墨蓝夜里，一盏灯活了。'),
      stage('声音：banyan_night（从极静亮起的那一小段）。'),
      caption('火进去的那一瞬，鱼就活了。'),
    ],
    nextNodeId: 'PRO-6',
  },

  /* ============ PRO-6｜夜游（字卡过渡） ============ */
  {
    id: 'PRO-6',
    chapter: CHAPTER,
    sectionTitle: 'PRO-6｜夜游（字卡过渡）',
    scene: 'fish_parade',
    kind: 'montage',
    lines: [
      stage('【PRO-6】夜游（字卡过渡）'),
      stage('画面：俯拍，百鱼灯汇成光的河，在巷子里蜿蜒。渐暗，黑场。'),
      stage('声音：fish_parade（远远的，像隔了三十年）。'),
      caption('在北坡，鱼不是游给人看的。'),
      caption('旱了，就扎一河的鱼，向天借水。'),
      card('可现在，河快干了。'),
    ],
    nextNodeId: 'C1-1',
  },
]
