/**
 * 链 A｜守旧线（T > I）——A1 开坊 → A2 记谱 → A3 三年后 → 结局 A《灯还亮着》
 *
 * 文案来源：《传灯人·游鱼_互动叙事剧本 r8》/ `思路/最终版剧情/结局.txt`（逐字录入）
 *
 * 机制（《开发文档》§3.6／§3.7.3）：
 *  - C4 结算后按 `nextByEnding.A` 进入 A1；A1→A2→A3→END-A 线性；
 *  - 结局 A 的**代价段**按守旧值取一版（T≥4／T=3／T=2），与分层无关；
 *  - END-A 为 `kind:'ending'` 节点：播完进结局页（`phase='end'`）。
 */
import type { StoryNode } from '@/types/story'
import { card, nar, narIf, say, stage } from './format'

const CHAPTER = '链A·守旧线'

export const chainANodes: StoryNode[] = [
  /* ============ A1｜开坊 ============ */
  {
    id: 'A1',
    chapter: CHAPTER,
    sectionTitle: 'A1｜开坊',
    scene: 'workshop_next_year',
    lines: [
      stage('【A1】开坊'),
      stage(
        '画面：workshop_next_year。门口挂牌"传灯坊·每月十六开坊"，小桌摆开竹篾与纱纸。首批来的人（老中青都有，老人最少）围着老木台。'
      ),
      nar('灯坊的门重新开了。九婆把钥匙给了我。'),
      nar('"这盏灯，得有人用手接着，不能又搁回玻璃里。"'),
      nar('不卖灯，不收费。来了，就上手。'),
      nar('九婆立了新规矩：扎坏的篾不用赔——'),
      nar('"断了，才知道竹子的脾气。"'),
      stage('阿鲟（手机小窗）'),
      say('阿鲟', '开坊首日，到场 11 人。独立完成小鱼灯：2 盏。'),
      stage('九婆（收工，看着满桌歪歪扭扭的灯）'),
      say('九婆', '第一年，能有人会来，就算鱼下了子。'),
    ],
    nextNodeId: 'A2',
  },

  /* ============ A2｜记谱 ============ */
  {
    id: 'A2',
    chapter: CHAPTER,
    sectionTitle: 'A2｜记谱',
    scene: 'lantern_workshop',
    lines: [
      stage('【A2】记谱'),
      stage('画面：lantern_workshop 夜。九婆口述、知遥执笔、阿鲟录音转写。最后几页：九婆按住知遥的笔。'),
      nar('九婆一辈子的手法，一句一句记录下来。'),
      nar('写到最后一页，她死活不让写了。'),
      stage('九婆'),
      say('九婆', '手上那口气，字接不住。'),
      stage('（灯谱最后一页，留白）'),
      say('九婆', '看得懂的人，自然看得懂。'),
    ],
    nextNodeId: 'A3',
  },

  /* ============ A3｜三年后（后续发展） ============ */
  {
    id: 'A3',
    chapter: CHAPTER,
    sectionTitle: 'A3｜三年后（后续发展）',
    scene: 'workshop_next_year',
    lines: [
      stage('【A3】三年后（后续发展）'),
      stage(
        '画面：三帧蒙太奇——① 第一年，11 个人围桌；② 第二年，桌上坐满，窗台排满小鱼灯；③ 第三年，一个跟学了三年的姑娘独立扎完鳌鱼灯的龙首，九婆把用了几十年的旧篾刀放进她手心。'
      ),
      say('阿鲟', '全镇学过全套工序者：2 → 31。最年轻者，17 岁。'),
      nar('游鱼夜没改期，没改路线。'),
      nar('灯还是那些灯——举灯的手，换了一批年轻的。'),
      nar('九婆站在榕树下，眼睛半眯，像在看很远的水。'),
    ],
    nextNodeId: 'END-A',
  },

  /* ============ 结局 A｜《灯还亮着》 ============ */
  {
    id: 'END-A',
    chapter: CHAPTER,
    sectionTitle: '结局A｜灯还亮着',
    scene: 'workshop_next_year',
    // 结局段本身不是终点：末尾字卡后进尾声 EP（《开发文档》§2.4 速查表）
    lines: [
      stage('【结局 A】《灯还亮着》'),
      stage(
        '画面：三代人的手在同一张木台上；一排小鱼灯次第点亮；窗外，游鱼夜的光河漫过巷口（远景）。末帧定格在墙上那条奶奶的鳌鱼灯——它被那位姑娘接完了，点亮着，鳞片金红。'
      ),
      say('九婆', '手记得，灯就记得。'),
      // —— 代价段：按守旧值取一版（与分层无关）——
      narIf('县里那盏老灯还在玻璃里躺着。我每年去看一次。它还是只被点过一次。', [
        { key: 'tradition', gte: 4 },
      ]),
      narIf('街口那家店换了三茬货。鳞纹还是那个鳞纹，红还是那个红。', [
        { key: 'tradition', gte: 3, lte: 3 },
      ]),
      narIf('夜市上还挂着九块九。今年是第八代，充电的了。', [
        { key: 'tradition', gte: 2, lte: 2 },
      ]),
      nar('我没去成五月的展。阿禾在电话里说，展很成功。我说，那就好。'),
      nar('守，不是把灯锁进柜子，'),
      nar('是把灯留在人的手里。'),
      nar('路走得很慢。'),
      nar('慢，是灯的活法。'),
      card('结局一·灯还亮着。'),
    ],
    nextNodeId: 'EP',
    note: '代价段三版互斥（T≥4／T=3／T=2）：按守旧值取一版。',
  },
]
