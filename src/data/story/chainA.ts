/**
 * 链 A｜守旧线（T > I）——A1 开坊 → A1-2 围桌 → A2 记谱 → A3 三帧 → 结局 A《灯还亮着》
 *
 * 文案来源：《传灯人·游鱼_互动叙事剧本 r8》/ `思路/最终版剧情/结局.txt`（逐字录入）
 *
 * 机制（《开发文档》§3.6／§3.7.3）：
 *  - C4 结算后按 `nextByEnding.A` 进入 A1；线性到 END-A-3；
 *  - 结局 A 的**代价段**按守旧值取一版（T≥4／T=3／T=2），与分层无关；
 *  - 末段播完进尾声 EP（《开发文档》§2.4 速查表）。
 *
 * 背景落位（2026-10-21，`public/assets/scenes/chains/`，图源 `photo/结局/`）：
 *  - 一个节点只能挂一张底图，剧本「一个节点多个镜头」的地方按镜头拆节点，**台词逐字未改**：
 *    A1 →A1-2（门口挂牌／门内围桌）／A3 →A3-1→A3-2→A3-3（三年后的三帧）／
 *    END-A →END-A-1→END-A-2→END-A-3（三代人的手／窗外光河／末帧鳌鱼灯）。
 *  - 底图里已经画入角色的节点必须写 `backdropCast`（否则同一人出现两次）。
 *  - 源文件名与本文件节点号不完全同名：`A1-1.jpg→A1.webp`、`A3-4.jpg→A3-3.webp`、
 *    `结局A-1~3.jpg→END-A-1~3.webp`。**A3-3.jpg（九婆与阿禾各自扎灯）剧本里没有对应镜头，未使用。**
 */
import type { StoryNode } from '@/types/story'
import { card, nar, narIf, say, stage } from './format'

const CHAPTER = '链A·守旧线'

export const chainANodes: StoryNode[] = [
  /* ============ A1｜开坊（门口挂牌） ============ */
  {
    id: 'A1',
    chapter: CHAPTER,
    sectionTitle: 'A1｜开坊',
    scene: 'workshop_next_year',
    backdrop: 'chains/A1.webp',
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
    ],
    nextNodeId: 'A1-2',
  },

  /* ============ A1-2｜开坊首日·收工 ============ */
  {
    id: 'A1-2',
    chapter: CHAPTER,
    sectionTitle: 'A1-2｜开坊首日·收工',
    scene: 'workshop_next_year',
    backdrop: 'chains/A1-2.webp',
    lines: [
      stage('画面：同场门内——小桌上摊着竹篾与纱纸，几个人围着老木台动手，桌上堆着歪歪扭扭的成品。'),
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
    backdrop: 'chains/A2.webp',
    backdropCast: ['九婆', '知遥'],
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
    nextNodeId: 'A3-1',
  },

  /* ============ A3-1｜三年后·第一年（11 人围桌） ============ */
  {
    id: 'A3-1',
    chapter: CHAPTER,
    sectionTitle: 'A3-1｜三年后·第一年',
    scene: 'workshop_next_year',
    backdrop: 'chains/A3-1.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('【A3】三年后（后续发展）'),
      stage(
        '画面：三帧蒙太奇——① 第一年，11 个人围桌；② 第二年，桌上坐满，窗台排满小鱼灯；③ 第三年，一个跟学了三年的姑娘独立扎完鳌鱼灯的龙首，九婆把用了几十年的旧篾刀放进她手心。'
      ),
      stage('画面（三帧之一）：第一年，11 个人围桌，九婆在桌尾教握篾。'),
      say('阿鲟', '全镇学过全套工序者：2 → 31。最年轻者，17 岁。'),
    ],
    nextNodeId: 'A3-2',
  },

  /* ============ A3-2｜第二年（桌上坐满） ============ */
  {
    id: 'A3-2',
    chapter: CHAPTER,
    sectionTitle: 'A3-2｜第二年',
    scene: 'workshop_next_year',
    backdrop: 'chains/A3-2.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('画面（三帧之二）：第二年，门口长桌坐满，窗台排满小鱼灯。'),
      nar('游鱼夜没改期，没改路线。'),
    ],
    nextNodeId: 'A3-3',
  },

  /* ============ A3-3｜第三年（姑娘接篾刀） ============ */
  {
    id: 'A3-3',
    chapter: CHAPTER,
    sectionTitle: 'A3-3｜第三年',
    scene: 'workshop_next_year',
    backdrop: 'chains/A3-3.webp',
    backdropCast: ['九婆'],
    lines: [
      stage('画面（三帧之三）：一个跟学了三年的姑娘独立扎完鳌鱼灯的龙首，九婆把用了几十年的旧篾刀放进她手心。'),
      nar('灯还是那些灯——举灯的手，换了一批年轻的。'),
      nar('九婆站在榕树下，眼睛半眯，像在看很远的水。'),
    ],
    nextNodeId: 'END-A-1',
  },

  /* ============ 结局 A｜《灯还亮着》 ============ */
  {
    id: 'END-A-1',
    chapter: CHAPTER,
    sectionTitle: '结局A｜灯还亮着',
    scene: 'workshop_next_year',
    backdrop: 'chains/END-A-1.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('【结局 A】《灯还亮着》'),
      stage(
        '画面：三代人的手在同一张木台上；一排小鱼灯次第点亮；窗外，游鱼夜的光河漫过巷口（远景）。末帧定格在墙上那条奶奶的鳌鱼灯——它被那位姑娘接完了，点亮着，鳞片金红。'
      ),
      stage('画面（一）：三代人的手在同一张木台上，一排小鱼灯次第点亮。'),
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
    ],
    nextNodeId: 'END-A-2',
    note: '代价段三版互斥（T≥4／T=3／T=2）：按守旧值取一版。',
  },

  /* ============ 结局 A-2｜窗外光河（远景） ============ */
  {
    id: 'END-A-2',
    chapter: CHAPTER,
    sectionTitle: '结局A-2｜窗外光河',
    scene: 'fish_parade',
    backdrop: 'chains/END-A-2.webp',
    lines: [
      stage('画面（二）：从灯坊窗内望出去，游鱼夜的光河漫过巷口。'),
      nar('守，不是把灯锁进柜子，'),
      nar('是把灯留在人的手里。'),
    ],
    nextNodeId: 'END-A-3',
  },

  /* ============ 结局 A-3｜末帧·点亮着的鳌鱼灯 ============ */
  {
    id: 'END-A-3',
    chapter: CHAPTER,
    sectionTitle: '结局A-3｜末帧',
    scene: 'workshop_next_year',
    backdrop: 'chains/END-A-3.webp',
    lines: [
      stage('画面（末帧）：定格在墙上那条奶奶的鳌鱼灯——它被那位姑娘接完了，点亮着，鳞片金红。'),
      nar('路走得很慢。'),
      nar('慢，是灯的活法。'),
      card('结局一·灯还亮着。'),
    ],
    nextNodeId: 'EP',
  },
]
