/**
 * 序章 PRO｜一盏灯的一生（PRO-1a/1b … PRO-6，共 8 屏）
 *
 * 文案来源：**《传灯人·游鱼_开发文档》v1.0 §2.3（整合自剧本 V3.0·r2）**
 * 录入原则：
 *  - 旁白 → 画面中央字卡（caption，蒙太奇，可跳过不可快进），逐字录入、不改写；
 *  - 画面／声音 → `stage`（仅审核模式显示，供创作团队核对）；演示模式（默认）不显示。
 *
 * 演出切分（2026-10-17，配合队友 QWQAJia 序章 8 张出图）：
 *  - 剧本节点 PRO-1／PRO-2 各含两个镜头（画面描述为「一句话两镜头」），按出图拆为两屏：
 *    PRO-1a 竹林晨光＋旁白「一条鱼，先是一根竹。」 → PRO-1b 手与刀（无字镜头，`holdMs` 停留）；
 *    PRO-2a 烘篾＋「火把竹烤软，手把竹弯弯。」 → PRO-2b 弯弧立骨＋「骨头对了，鱼才立得住。」；
 *  - 每屏配一张 `backdrop` 单屏图（`public/assets/scenes/prologue/`，图片优先、无图回落场景渐变）；
 *  - 纯图片镜头（PRO-1b）由 `holdMs` 停留后自动推进（点击可跳过）。
 *
 * 节点类型 `montage`：引擎「跳过序章」沿链路直达 C1-1，跳过不计访问。
 */
import type { StoryNode } from '@/types/story'
import { caption, stage } from './format'

const CHAPTER = '序章·一盏灯的一生'
const B = (file: string) => `prologue/${file}`

export const prologueNodes: StoryNode[] = [
  /* ============ PRO-1a｜竹 · 竹林晨光 ============ */
  {
    id: 'PRO-1a',
    chapter: CHAPTER,
    sectionTitle: 'PRO-1a｜竹（竹林晨光）',
    scene: 'dry_field',
    kind: 'montage',
    backdrop: B('PRO-1a_竹林晨光.jpg'),
    lines: [
      stage('【PRO-1】竹（1/2 竹林晨光）'),
      stage('画面：晨光后山竹林，露水未干。'),
      stage('声音：dry_field 风声起底。'),
      caption('一条鱼，先是一根竹。'),
    ],
    nextNodeId: 'PRO-1b',
  },

  /* ============ PRO-1b｜竹 · 手与刀（旁白延续） ============ */
  {
    id: 'PRO-1b',
    chapter: CHAPTER,
    sectionTitle: 'PRO-1b｜竹（手与刀）',
    scene: 'dry_field',
    kind: 'montage',
    backdrop: B('PRO-1b_手与刀.jpg'),
    lines: [
      stage('【PRO-1】竹（2/2 手与刀）'),
      stage('画面：一只手握篾刀入竹，刀锋劈开的瞬间，竹纤维绽出细白的绒。'),
      stage('声音：篾刀脆响。'),
      caption('一条鱼，先是一根竹。'),
    ],
    nextNodeId: 'PRO-2a',
  },

  /* ============ PRO-2a｜骨 · 烘篾 ============ */
  {
    id: 'PRO-2a',
    chapter: CHAPTER,
    sectionTitle: 'PRO-2a｜骨（烘篾）',
    scene: 'lantern_workshop',
    kind: 'montage',
    backdrop: B('PRO-2a_烘篾.jpg'),
    lines: [
      stage('【PRO-2】骨（1/2 烘篾）'),
      stage('画面：竹篾在烛火上烘软。火光映在手背。'),
      stage('声音：lantern_workshop 深夜版。'),
      caption('火把竹烤软，手把竹弯弯。'),
    ],
    nextNodeId: 'PRO-2b',
  },

  /* ============ PRO-2b｜骨 · 弯弧立骨 ============ */
  {
    id: 'PRO-2b',
    chapter: CHAPTER,
    sectionTitle: 'PRO-2b｜骨（弯弧立骨）',
    scene: 'lantern_workshop',
    kind: 'montage',
    backdrop: B('PRO-2b_弯弧立骨.jpg'),
    lines: [
      stage('【PRO-2】骨（2/2 弯弧立骨）'),
      stage('画面：双手把它弯成弧——骨架在老木台上一圈圈立起来，像鱼的脊椎。'),
      stage('声音：lantern_workshop 深夜版。'),
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
    backdrop: B('PRO-3_糊纸透光.jpg'),
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
    backdrop: B('PRO-4_画鳞留白.jpg'),
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
    backdrop: B('PRO-5_烛火入腹.jpg'),
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
    backdrop: B('PRO-6_夜游鱼河.jpg'),
    lines: [
      stage('【PRO-6】夜游（字卡过渡）'),
      stage('画面：俯拍，百鱼灯汇成光的河，在巷子里蜿蜒。渐暗，黑场。'),
      stage('声音：fish_parade（远远的，像隔了三十年）。'),
      caption('在北坡，鱼不是游给人看的。'),
      caption('旱了，就扎一河的鱼，向天借水。'),
      caption('可现在，河快干了。'),
    ],
    nextNodeId: 'C1-1',
  },
]
