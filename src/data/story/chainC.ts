/**
 * 链 C｜合流线（T = I）——E1 不二选一 → E2 骨与鳞 → E3 三年后 → 结局 C《灯海相连》
 *
 * 文案来源：《传灯人·游鱼_互动叙事剧本 r8》/ `思路/最终版剧情/结局.txt`（逐字录入）
 *
 * 机制（《开发文档》§3.7.3 · v1.6 关键取舍）：
 *  - C4 结算后按 `nextByEnding.C` 进入 E1；E1→E2→E3-1…→END-C→END-C-CG→EP；
 *  - **双入口、不同火候**：`(2,2)` 温吞（t+i=4）／`(3,3)` 坚定（t+i=6）；
 *  - 温吞版只改两句旁白（E1「抉择回响」＋结局旁白），并**去掉末帧双灯彩蛋**；
 *  - 坚定版用现文案（"河跟海，挨着。"），保留末帧彩蛋（数字模型与真灯并列、虚线补齐）。
 *
 * 背景落位（2026-10-21，`public/assets/scenes/chains/`，图源 `photo/结局/`）：
 *  - 按镜头拆节点，台词逐字未改：E3 →E3-1（孩子围桌／城市幕墙／姑娘扎龙首／展厅指鱼）四帧，
 *    第三帧无台词，按序章的**纯图片镜头**写法（`kind:'montage'` + `holdMs`）停留 1.4s 自动推进。
 *  - 源文件名：`C1.jpg→E1.webp`、`C2.jpg→E2.webp`、`C3-1~4.jpg→E3-1~4.webp`。
 *  - **结局 C 用成片**（2026-10-21 用户决定）：`chains/结局C.mp4`（30.02s／1280×720／27.8MB／无音轨）
 *    挂在 `END-C-CG` 的 `cg` 上；END-C 正文仍逐字播完，再接成片，播完进 EP。
 *    END-C 的静态底图取自成片首帧，`cast: []`——画面是实拍真人，不叠立绘。
 */
import type { Condition, StoryNode } from '@/types/story'
import { card, nar, narIf, say, stage, stageIf } from './format'

const CHAPTER = '链C·合流线'

/** 链 C 内置条件：本链只在 `ending='C'` 时进入，另加分层判断（防御性写法） */
const FIRM: Condition[] = [
  { key: 'ending', eq: 'C' },
  { key: 'endingTier', eq: 'firm' },
]
const MILD: Condition[] = [
  { key: 'ending', eq: 'C' },
  { key: 'endingTier', eq: 'mild' },
]

export const chainCNodes: StoryNode[] = [
  /* ============ E1｜不二选一 ============ */
  {
    id: 'E1',
    chapter: CHAPTER,
    sectionTitle: 'E1｜不二选一',
    scene: 'lantern_workshop',
    backdrop: 'chains/E1.webp',
    backdropCast: ['九婆', '阿禾', '知遥'],
    lines: [
      stage('【E1】不二选一'),
      stage('画面：lantern_workshop 深夜。竹篾与数位笔并排搁在老木台上。九婆和阿禾坐在同一张桌子前。'),
      stage('旁白（抉择回响·平衡）'),
      // 分层：坚定 (3,3) 用现文案；温吞 (2,2) 改这一句
      narIf('我数了数这一路：先想把手里的篾弯好，又总惦记着让鱼游到人眼前。两笔账，一样重。', FIRM),
      narIf('两条路我都试了，都不算深。可我知道，缺哪一条都不成。', MILD),
      stage('九婆（把篾刀往桌上一放）'),
      say('九婆', '竹子教过你，跟它较劲，就断。'),
      stage('阿禾（把数位笔也放下）'),
      say('阿禾', '屏幕也教过我，硬要它承重，就只剩一张图。'),
      say('知遥', '那都不放。把两样，合在一张桌上。'),
      nar('我没选竹篾，也没选数位笔。'),
      nar('我把灯坊的门，朝两边开。'),
    ],
    nextNodeId: 'E2',
  },

  /* ============ E2｜骨与鳞 ============ */
  {
    id: 'E2',
    chapter: CHAPTER,
    sectionTitle: 'E2｜骨与鳞',
    scene: 'lantern_workshop',
    backdrop: 'chains/E2.webp',
    backdropCast: ['九婆', '知遥'],
    // 九婆与知遥已画在底图里；显式只留阿禾与阿鲟——
    // 若照旧按说话人推断（九婆+阿禾+阿鲟），limitCast 上限 2 会按优先级先给九婆、把阿鲟挤掉，
    // 于是阿鲟那句台词没有立绘。这里绕过上限，改成「画中两人不上立绘」的等价写法。
    cast: ['阿禾', '阿鲟'],
    lines: [
      stage('【E2】骨与鳞'),
      stage(
        '画面：灯坊里，阿鲟把九婆的手法录成可旋转的数字灯谱；阿禾把"回村车票"嵌进每条数字鱼的点睛帧。知遥两头跑，左手递篾，右手递笔。'
      ),
      say('阿鲟', '数字灯谱已接入传灯坊预约。原真手法为骨，线上游鱼为鳞。'),
      nar('九婆的"先定骨"，有了可带走的样子；'),
      nar('阿禾的"游出去"，有了能上手的根。'),
      stage('九婆（看着屏里自己扎灯的手）'),
      say('九婆', '这鱼，还是得有人伸手进竹篾里。'),
      stage('阿禾（笑）'),
      say('阿禾', '所以点睛那一帧，我用了你的手。'),
      nar('骨是老的，鳞是新的。鱼，才算活全了。'),
    ],
    nextNodeId: 'E3-1',
  },

  /* ============ E3-1｜三年后·① 传灯坊开坊 ============ */
  {
    id: 'E3-1',
    chapter: CHAPTER,
    sectionTitle: 'E3-1｜三年后·开坊',
    scene: 'workshop_next_year',
    backdrop: 'chains/E3-1.webp',
    backdropCast: ['九婆'],
    lines: [
      stage('【E3】三年后（合流发展）'),
      stage(
        '画面：三帧蒙太奇——① 传灯坊每月十六开坊，孩子围桌弯篾；② 同一周，城市幕墙的数字鱼点亮，扫二维码跳出"鱼灯作坊"；③ 第三年，一个姑娘在灯坊扎完龙首，另一个年轻人在展厅指着数字鱼说"这是我家灯坊的灯"。'
      ),
      stage('画面（一）：传灯坊每月十六开坊，孩子围桌弯篾，九婆在中间扶着一条大鱼的骨架。'),
      say('阿鲟', '传灯坊学员 31 人；数字鱼观展 3 万人次，进坊学艺 214 人次。骨与鳞，各自长出了手。'),
    ],
    nextNodeId: 'E3-2',
  },

  /* ============ E3-2｜② 城市幕墙点亮 ============ */
  {
    id: 'E3-2',
    chapter: CHAPTER,
    sectionTitle: 'E3-2｜城市幕墙',
    scene: 'city_facade',
    backdrop: 'chains/E3-2.webp',
    lines: [
      stage('画面（二）：同一周，城市幕墙的数字鱼点亮，扫二维码跳出"鱼灯作坊"。'),
      nar('游鱼夜没改期。灯还是那些灯——'),
    ],
    nextNodeId: 'E3-3',
  },

  /* ============ E3-3｜③上·姑娘扎完龙首（纯画面镜头） ============ */
  {
    id: 'E3-3',
    chapter: CHAPTER,
    sectionTitle: 'E3-3｜姑娘扎完龙首',
    scene: 'workshop_next_year',
    backdrop: 'chains/E3-3.webp',
    kind: 'montage',
    holdMs: 1400,
    lines: [stage('画面（三·上）：第三年，一个姑娘在灯坊扎完龙首。')],
    nextNodeId: 'E3-4',
  },

  /* ============ E3-4｜③下·展厅里指着数字鱼的年轻人 ============ */
  {
    id: 'E3-4',
    chapter: CHAPTER,
    sectionTitle: 'E3-4｜展厅',
    scene: 'city_facade',
    backdrop: 'chains/E3-4.webp',
    lines: [
      stage('画面（三·下）：另一个年轻人在展厅指着数字鱼说"这是我家灯坊的灯"。'),
      nar('举灯的手，换了一批年轻的；屏幕里的鱼，也认得回村的水路。'),
    ],
    nextNodeId: 'END-C',
  },

  /* ============ 结局 C｜《灯海相连》 ============ */
  {
    id: 'END-C',
    chapter: CHAPTER,
    sectionTitle: '结局C｜灯海相连',
    scene: 'fish_parade',
    backdrop: 'chains/END-C.webp',
    // 底图取自成片首帧（实拍真人），不叠立绘；名条照常
    cast: [],
    lines: [
      stage('【结局 C】《灯海相连》'),
      stage(
        '画面：fish_parade。同年游鱼夜，老灯、新灯、孩子扎歪的小鱼灯同一条河；画面中央，一只真手提起真灯，光透出纱纸，与幕墙上的数字鱼并排亮起。'
      ),
      // 末帧双灯彩蛋：仅坚定版（(3,3)）——温吞版不放这一帧
      stageIf(
        '画面（末帧·双灯彩蛋）：奶奶那条鳌鱼灯的数字模型与现实之灯并列点亮，虚线的那根篾——已在真灯上补齐。',
        FIRM
      ),
      say('九婆', '手记得，灯就记得。'),
      say('阿禾', '屏幕是河，灯坊是海——这回，河跟海，挨着。'),
      // 分层：坚定用现文案；温吞改一句
      narIf('平衡，不是把两条路各走一半。', FIRM),
      narIf('是把一条路，走成了两头的灯火。', FIRM),
      narIf('两条路都没走满，但都留着。', MILD),
      card('结局三·灯海相连。'),
    ],
    nextNodeId: 'END-C-CG',
    note: '分层：坚定 (3,3) 保留末帧双灯彩蛋与"两头的灯火"；温吞 (2,2) 只留"两条路都没走满，但都留着"。',
  },

  /* ============ 结局 C 成片｜《灯海相连》视频 ============ */
  {
    id: 'END-C-CG',
    chapter: CHAPTER,
    sectionTitle: '结局C｜成片',
    scene: 'fish_parade',
    // 30.02s 实拍成片（真人游鱼夜 + 末帧双鱼灯）；播完或跳过 → 尾声 EP
    cg: { src: 'chains/结局C.mp4' },
    lines: [stage('【结局 C 成片】30.02s：游鱼夜实拍 + 末帧双灯并列。')],
    nextNodeId: 'EP',
  },
]
