/**
 * 第二章 C2｜两条路（C2-0 → C2-A／C2-B → C2-X → C2-AA／C2-BB）
 *
 * 文案来源：**《传灯人·游鱼_互动叙事剧本 - 人工修改》r6（2026-10-18，团队最终版）**
 * 录入原则：旁白／台词逐字录入；画面／声音／舞台提示 → `stage`（仅审核模式显示）。
 *
 * 机制（《开发文档》§2.3 / §3.4 / §6.3）：
 *  - 选择②（C2-0）：两条路「体验一条，另一条自动解锁（必看）」——
 *    带 `setFlags.c2First` 的选项按「目标节点是否已访问」去重；两条都体验后汇合至 C2-X；
 *    数值：A 守 +1／B 新 +1，**仅首次计分**（`onceKey='C2-0'`）。
 *  - C2-X（触点①·次，可跳过）：3 预设走固定判定（守 +2／新 +2／双 +1+1），
 *    自由输入走 AI 双轴判定；A→C2-AA、B→C2-BB、C／自由／跳过→C3-1。
 *  - C2-AA／C2-BB 为分支段，合流 C3-1（第三章待接入）。
 *
 * 背景落位（2026-10-21，`public/assets/scenes/ch2/`，17 节点 16 图）：
 *  - 一个节点只能挂一张底图。剧本里「一个节点多个镜头」的地方按镜头拆节点
 *    （C2-A→A2／C2-B→B2→B3／C2-AA→AA2→AA3→AA4→AA5／C2-BB→BB2→BB3→BB4→BB5），**台词逐字未改**。
 *  - 图源＝`photo/第二章/`（15 张）。剧本写、但文件夹里没有对应镜头的两处，按「用相近的图代替」处理：
 *    ① C2-AA2「烛火烘篾特写」→ 由 C2-AA1 截取木台中心区放大（同场同道具，只把镜头推近，不出新图）；
 *    ② C2-AA5「第二天下午·院子磨灯架」→ 复用 C2-A2 院子空镜（同院同日、只换一天，不与 BB5 抢图）。
 *  - **底图里已经画入角色的，必须写 `backdropCast`**（否则同一人出现两次，见 §素材落位规范 §3）。
 *    已配：A1／B2／B3／X1／X2／AA3／AA4／BB1／BB2／BB3／BB4／BB5。
 */
import type { StoryNode } from '@/types/story'
import { nar, say, stage } from './format'

const CHAPTER = '第二章·两条路'

export const c2Nodes: StoryNode[] = [
  /* ============ C2-0｜选择②：先去哪儿学？ ============ */
  {
    id: 'C2-0',
    chapter: CHAPTER,
    sectionTitle: 'C2-0｜选择②：先去哪儿学？',
    scene: 'lantern_workshop',
    kind: 'choice',
    lines: [
      stage('【C2-0】【选择②】先去哪儿学？'),
      stage('界面：两张卡——"九婆的竹篾"／"阿禾的数字鱼"。体验完所选的一条，另一条晚上再去（必看）。'),
    ],
    choices: [
      {
        id: 'C2-0-A',
        text: '去九婆家——她答应教我弯第一根篾',
        outcome: [],
        nextNodeId: 'C2-A',
        effects: { tradition: 1 },
        setFlags: { c2First: 'jiupo' },
        onceKey: 'C2-0',
        note: 'A（守+1，仅首次计分）',
      },
      {
        id: 'C2-0-B',
        text: '去阿禾的工作室——她想给我看她的鱼',
        outcome: [],
        nextNodeId: 'C2-B',
        effects: { innovation: 1 },
        setFlags: { c2First: 'ahe' },
        onceKey: 'C2-0',
        note: 'B（新+1，仅首次计分）',
      },
    ],
    // 两条路都体验完后汇合至 C2-X（解锁机制见文件头「机制」）
    nextNodeId: 'C2-X',
    note: '两路体验：本组节点会被重复进入（补看轮），属预期行为。',
  },

  /* ============ C2-A｜九婆的竹篾（守旧体验） ============ */
  {
    id: 'C2-A',
    chapter: CHAPTER,
    sectionTitle: 'C2-A｜九婆的竹篾（守旧体验）',
    scene: 'jiupo_courtyard',
    // 2026-10-21 按镜头落图：一个节点只能挂一张背景，所以把多镜头节点拆开（台词逐字不动）
    backdrop: 'ch2/C2-A1.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('【C2-A】九婆的竹篾（守旧体验）'),
      stage('画面：jiupo_courtyard。午后光斑，九婆择完菜，递给知遥一根竹篾。特写：两只手，一老一少。'),
      stage('声音：jiupo_courtyard。'),
      say('九婆', '手上有汗就握不住篾。先擦手。'),
      stage('（知遥弯断了一根）'),
      say('九婆', '断了好。竹子教你，比我省口舌。'),
    ],
    nextNodeId: 'C2-A2',
  },

  /* ============ C2-A2｜院子空镜（同场，镜头拉远） ============ */
  {
    id: 'C2-A2',
    chapter: CHAPTER,
    sectionTitle: 'C2-A2｜院子空镜（同场，镜头拉远）',
    scene: 'jiupo_courtyard',
    backdrop: 'ch2/C2-A2.webp',
    lines: [
      stage('画面：同场拉远——院子全景，石台上摊着弯断的竹篾，夕光斜过来，院里没别人。'),
      stage('（她扶正他的手腕）'),
      say('九婆', '篾要顺它的性子弯。你跟它较劲，它就断。'),
      say('九婆', '你顺着它，它带你走。'),
      nar('第二根，弯到一半又断了。第三根，成了个歪的。'),
      nar('那个下午我只学会一件事：'),
      nar('竹篾不会骗人。你急，它知道；你静，它也知道。'),
      say('九婆', '明天还来吗？'),
      stage('（没等他答）'),
      say('九婆', '不来也行。来了，从擦手开始。'),
    ],
    nextNodeId: 'C2-0',
  },

  /* ============ C2-B｜阿禾的数字鱼（创新体验） ============ */
  {
    id: 'C2-B',
    chapter: CHAPTER,
    sectionTitle: 'C2-B｜阿禾的数字鱼（创新体验）',
    scene: 'studio_night',
    backdrop: 'ch2/C2-B1.webp',
    lines: [
      stage('【C2-B】阿禾的数字鱼（创新体验）'),
      stage(
        '画面：studio_night。大屏上数百条金线鱼缓缓游动；知遥伸手去"摸"，指尖触屏，鱼散成金线，又慢慢聚拢。屏幕冷光与窗外一盏真鱼灯的暖光在阿禾脸上对撞。'
      ),
      stage('声音：studio_night。'),
      say('阿禾', '我能让一万个人在屏幕前看见这条鱼。', { cast: ['阿禾'], side: 'right' }),
    ],
    nextNodeId: 'C2-B2',
  },

  /* ============ C2-B2｜指尖触屏（鱼散开） ============ */
  {
    id: 'C2-B2',
    chapter: CHAPTER,
    sectionTitle: 'C2-B2｜指尖触屏（鱼散开）',
    scene: 'studio_night',
    backdrop: 'ch2/C2-B2.webp',
    backdropCast: ['知遥'],
    lines: [
      stage('画面：知遥伸手去"摸"，指尖触到屏幕，鱼群散成金线躲避。'),
      stage('（屏幕上鱼散开时，她停了一下）'),
      say('阿禾', '看到了吗。它躲你。', { cast: ['阿禾'], side: 'right' }),
    ],
    nextNodeId: 'C2-B3',
  },

  /* ============ C2-B3｜鱼聚回来（0.8% 那行小字） ============ */
  {
    id: 'C2-B3',
    chapter: CHAPTER,
    sectionTitle: 'C2-B3｜鱼聚回来（0.8% 那行小字）',
    scene: 'studio_night',
    backdrop: 'ch2/C2-B3.webp',
    backdropCast: ['知遥'],
    /**
     * 屏幕角落那行小字：AI 生图画不出稳定文字（原图角落是空的），
     * 由 `ProjectionLayer` 合成成"界面读数"（`pos: 'screen-tr'`）。
     * 不动底图，也不改台词——旁白照旧把那句话念完。
     */
    projection: { lines: ['渲染精度 99.2%'], pos: 'screen-tr' },
    lines: [
      stage('画面：手指松开，金线鱼一点点聚回来；镜头压到屏幕角落那行小字。'),
      stage('（屏幕上的鱼一点点聚回来）'),
      say('阿禾', '一万个人看见了，一万个人都挨不着。', { cast: ['阿禾'], side: 'right' }),
      nar('那晚谁也没说服谁。'),
      nar('但我记住了她屏幕角落那行小字——'),
      nar('渲染精度：99.2%。骨架来源：扫描自那条没扎完的鳌鱼灯。'),
      stage('阿禾（像知道我在看那行字）'),
      say('阿禾', '去年灯坊没锁，我进去扫的。'),
    ],
    nextNodeId: 'C2-0',
  },

  /* ============ C2-X｜两条路都看过了（触点①·次） ============ */
  {
    id: 'C2-X',
    chapter: CHAPTER,
    sectionTitle: 'C2-X｜两条路都看过了（触点①·次）',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-X1.webp',
    backdropCast: ['周经理'],
    lines: [
      stage('【C2-X】两条路都看过了（触点①·次，可跳过）'),
      stage('画面：夜。灯坊门口，门虚掩着，屋里那条半成品鳌鱼灯只剩个轮廓。周经理夹着方案书过来，看见知遥。'),
      stage('声音：lantern_workshop 黄昏版，极轻。'),
      say('周经理', '九婆在吗？镇里催方案，我放桌上了。'),
      stage('（他放下方案，走了两步，回头）'),
      say('周经理', '你是林家那小子？回来了好。灯会的事，回头一块儿聊。'),
    ],
    nextNodeId: 'C2-X2',
  },

  /* ============ C2-X2｜灯坊内谈话 ＋ 触点① ============ */
  {
    id: 'C2-X2',
    chapter: CHAPTER,
    sectionTitle: 'C2-X2｜灯坊内谈话 ＋ 触点①',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-X2.webp',
    backdropCast: ['周经理', '知遥'],
    kind: 'stance',
    lines: [
      stage('画面：灯坊内，两人隔着圆桌坐下，方案书摊在桌上；一盏灯泡吊在头顶。'),
      stage('阿鲟（手机小窗，小鱼灯悬空漂游，烛火轻轻呼吸）'),
      say('阿鲟', '两条路，我都记下了。'),
      say('阿鲟', '你自己怎么看？'),
    ],
    stance: {
      question: '你自己怎么看？',
      placeholder: '你也可以用自己的话说',
      limit: 100,
      skippable: true,
      skipClose: [say('阿鲟', '未记录。跳过。')],
      presets: [
        {
          id: 'C2-X-A',
          text: '灯得先有人会扎。先把手里这根篾弯完。灯在了，人才会来。',
          tradition: 2,
          innovation: 0,
          close: [say('阿鲟', '记录。倾向：先做扎实。')],
          nextNodeId: 'C2-AA',
        },
        {
          id: 'C2-X-B',
          text: '新那条更要紧。没人看见，扎得再好也没用。',
          tradition: 0,
          innovation: 2,
          close: [say('阿鲟', '记录。倾向：先被看见。')],
          nextNodeId: 'C2-BB',
        },
        {
          id: 'C2-X-C',
          text: '缺一条都不成。可一个春天，只够做一件。',
          tradition: 1,
          innovation: 1,
          close: [say('阿鲟', '记录。倾向：创新才能传承。')],
        },
      ],
      aiPromptKey: 'stance_c2x',
    },
    // C／自由输入／跳过后进入第三章（C3 待接入 → 断点）
    nextNodeId: 'C3-1',
    note: '触点①：预设走固定判定（不调 AI）；自由输入走 AI 双轴判定，失败按 0/0。',
  },

  /* ============ C2-AA｜先做扎实｜把手里这根弯完 ============ */
  {
    id: 'C2-AA',
    chapter: CHAPTER,
    sectionTitle: 'C2-AA｜先做扎实｜把手里这根弯完',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-AA1.webp',
    lines: [
      stage('【C2-AA】先做扎实｜把手里这根弯完'),
      stage(
        '画面：lantern_workshop 深夜版。老木台上摊着白天弯断的三截篾。手机扣在桌角，屏幕朝下。墙角，奶奶那条没扎完的鳌鱼灯只剩一个黑轮廓。'
      ),
      stage('声音：lantern_workshop 深夜版。门外虫声，比屋里响。'),
      nar('我回灯坊的时候，九婆已经睡了。'),
      nar('桌上留着半截蜡烛、一盒火柴，和白天我弯断的那三根篾。'),
      nar('断口很齐。像在等我。'),
    ],
    nextNodeId: 'C2-AA2',
  },

  /* ============ C2-AA2｜烛火烘篾（特写） ============ */
  {
    id: 'C2-AA2',
    chapter: CHAPTER,
    sectionTitle: 'C2-AA2｜烛火烘篾（特写）',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-AA2.webp',
    lines: [
      stage('画面：烛火烘篾特写——竹皮由青转黄，渗出一层薄油光；他的手腕跟着竹的弧，慢慢往下走。'),
      nar('第一根，还是断。断在我最想让它弯的那个地方。'),
      nar('第二根，我烘久了，它软了，弯过去，又塌了。'),
      nar('第三根...'),
      nar('手往下走，它自己跟上来。'),
    ],
    nextNodeId: 'C2-AA3',
  },

  /* ============ C2-AA3｜九婆站在门口 ============ */
  {
    id: 'C2-AA3',
    chapter: CHAPTER,
    sectionTitle: 'C2-AA3｜九婆站在门口',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-AA3.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('声音：竹篾轻响一声，很短。'),
      stage('九婆（披着外衣站在门口，不知站了多久）'),
      say('九婆', '响了？', { cast: ['阿鲟'], side: 'right' }),
      stage('（知遥点头）'),
      say('九婆', '响了就对了。它不是要断，它是在应你。'),
      nar('我把那根篾搁在奶奶的鳌鱼旁边，像交一份作业。'),
      nar('它弯得不好看。'),
      nar('可它还记得自己本来是什么样。'),
      stage('阿鲟（小窗亮起，鱼灯悬着，烛火压得很低）'),
      say('阿鲟', '今晚：弯成 1 根，废 3 根。用时 2 小时 47 分。'),
      say('阿鲟', '指腹伤口：1 处。'),
      nar('白天那道口子结了痂。'),
      nar('不深。可它一直在那儿——像有人用指甲轻轻掐着你，提醒你手在哪儿。'),
    ],
    nextNodeId: 'C2-AA4',
  },

  /* ============ C2-AA4｜九婆背影（派活） ============ */
  {
    id: 'C2-AA4',
    chapter: CHAPTER,
    sectionTitle: 'C2-AA4｜九婆背影（派活）',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-AA4.webp',
    backdropCast: ['九婆', '知遥'],
    lines: [
      stage('九婆（回屋前，背对着他）'),
      say('九婆', '明天下午，把院子里的灯架抬出来。锈了。'),
      nar('她没夸我。她给我派了活。'),
      nar('在灯坊，这就是夸。'),
    ],
    nextNodeId: 'C2-AA5',
  },

  /* ============ C2-AA5｜第二天下午·院子磨灯架 ============ */
  {
    id: 'C2-AA5',
    chapter: CHAPTER,
    sectionTitle: 'C2-AA5｜第二天下午·院子磨灯架',
    scene: 'jiupo_courtyard',
    // 复用手里的院子空镜（同日同院，只是换了第二天下午的光）
    backdrop: 'ch2/C2-A2.webp',
    lines: [
      stage('画面：第二天下午，院子里，知遥蹲在地上磨灯架；铁锈落在手上，红的。'),
      nar('第二天下午，我在院子里磨了一下午灯架。'),
      nar('锈落在手上，红的，像一层细鳞。'),
      nar('九婆说得对——灯架不直，鱼就游不直。'),
    ],
    nextNodeId: 'C3-1',
  },

  /* ============ C2-BB｜先被看见｜让一个人先看见 ============ */
  {
    id: 'C2-BB',
    chapter: CHAPTER,
    sectionTitle: 'C2-BB｜先被看见｜让一个人先看见',
    scene: 'studio_night',
    backdrop: 'ch2/C2-BB1.webp',
    backdropCast: ['阿禾'],
    lines: [
      stage('【C2-BB】先被看见｜让一个人先看见'),
      stage(
        '画面：studio_night 深夜。阿禾趴在桌上睡着了，屏幕还亮着。知遥把手机里的素材导进电脑——九婆的手、断掉的篾、落在围裙上的竹屑。'
      ),
      stage('声音：studio_night。键盘声很轻，怕吵醒她。'),
      nar('阿禾的电脑里有一面素材墙，三千多条。我的手机里只有三十七秒。'),
    ],
    nextNodeId: 'C2-BB2',
  },

  /* ============ C2-BB2｜导素材、剪在一起 ============ */
  {
    id: 'C2-BB2',
    chapter: CHAPTER,
    sectionTitle: 'C2-BB2｜导素材、剪在一起',
    scene: 'studio_night',
    backdrop: 'ch2/C2-BB2.webp',
    backdropCast: ['阿禾', '知遥'],
    lines: [
      stage('画面：知遥站在她身后，把手机里的素材一段段拖进电脑；屏幕上是素材墙缩略图。'),
      nar('九婆的手。断篾。一地的竹屑。'),
      nar('我把它们剪在一起，配了一行字：「这条鱼，还差 0.8%。」'),
    ],
    nextNodeId: 'C2-BB3',
  },

  /* ============ C2-BB3｜发布数据 ============ */
  {
    id: 'C2-BB3',
    chapter: CHAPTER,
    sectionTitle: 'C2-BB3｜发布数据',
    scene: 'studio_night',
    backdrop: 'ch2/C2-BB3.webp',
    backdropCast: ['阿禾', '知遥'],
    lines: [
      stage('画面：视频播放界面。金线数字鱼从屏幕这头游到那头，游到一半，画面硬切——一只真手，在烛火上烘一根竹篾。'),
      nar('发出去的时候是十一点四十。'),
      stage('阿鲟（小窗，数据往下滚）'),
      say('阿鲟', '发布 3 小时：播放 7120。完播率 43%。评论 38 条。'),
      say('阿鲟', '其中——「在哪里」9 条。「怎么学」3 条。「我外婆家也在北坡」1 条。'),
      nar('七千个人看见了这条鱼。'),
      nar('没有一个人摸到它。'),
    ],
    nextNodeId: 'C2-BB4',
  },

  /* ============ C2-BB4｜阿禾醒来 ============ */
  {
    id: 'C2-BB4',
    chapter: CHAPTER,
    sectionTitle: 'C2-BB4｜阿禾醒来',
    scene: 'studio_night',
    backdrop: 'ch2/C2-BB4.webp',
    backdropCast: ['阿禾'],
    lines: [
      stage('阿禾（醒了，眯着眼看屏幕，声音哑）'),
      say('阿禾', '你把我模型里那 0.8% 剪进去了。'),
      say('阿禾', '我做了两年，一直没跟人提过这 0.8%。你倒好，拿它当标题。'),
      say('知遥', '藏不住的东西，不如摆出来。'),
    ],
    nextNodeId: 'C2-BB5',
  },

  /* ============ C2-BB5｜第二天下午·回灯坊 ============ */
  {
    id: 'C2-BB5',
    chapter: CHAPTER,
    sectionTitle: 'C2-BB5｜第二天下午·回灯坊',
    scene: 'lantern_workshop',
    backdrop: 'ch2/C2-BB5.webp',
    backdropCast: ['知遥'],
    lines: [
      stage('画面：林知遥踏入灯坊，午后光线从门里进来；九婆抬头看他一眼。'),
      nar('第二天下午，我回灯坊抬灯架。'),
      nar('九婆看了我一眼，没问昨晚去哪儿了。'),
      nar('手机在口袋里震了一路。我没看。'),
    ],
    nextNodeId: 'C3-1',
  },
]
