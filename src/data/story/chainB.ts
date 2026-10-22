/**
 * 链 B｜创新线（I > T）——B1 数字灯谱 → B2 鱼游城市 → B3 把人请回来 → 结局 B《鱼入海》
 *
 * 文案来源：《传灯人·游鱼_互动叙事剧本 r8》/ `思路/最终版剧情/结局.txt`（逐字录入）
 *
 * 机制（《开发文档》§3.6／§3.7.3）：
 *  - C4 结算后按 `nextByEnding.B` 进入 B1；线性到 END-B-2，播完进尾声 EP；
 *  - B3／结局 B 的数据口径：观展 11 万／进坊 5140／常客 130（2026-10-18 拍板）。
 *
 * 背景落位（2026-10-21，`public/assets/scenes/chains/`，图源 `photo/结局/`）：
 *  - 按镜头拆节点，台词逐字未改：B2 →B2-1（城市鱼群）→B2-2（末帧·真人点睛的手）／
 *    END-B →END-B-1（同一晚双画面）→END-B-2（数字鱼游出屏幕／真手提灯）。
 *  - 源文件名：`B2-1.png→B2-1.webp`、`结局B-1.png→END-B-1.webp`。
 */
import type { StoryNode } from '@/types/story'
import { card, nar, say, stage } from './format'

const CHAPTER = '链B·创新线'

export const chainBNodes: StoryNode[] = [
  /* ============ B1｜数字灯谱 ============ */
  {
    id: 'B1',
    chapter: CHAPTER,
    sectionTitle: 'B1｜数字灯谱',
    scene: 'studio_night',
    backdrop: 'chains/B1.webp',
    // 底图里阿禾与知遥都是全身，中间的墨蓝面板就是阿鲟的界面——全帧已完整，不再叠立绘
    cast: [],
    backdropCast: ['阿禾', '知遥'],
    lines: [
      stage('【B1】数字灯谱'),
      stage(
        '画面：studio_night。阿鲟展现出墨蓝的界面，鳌鱼灯结构模型可旋转、可拆解为竹篾经纬。'
      ),
      stage('旁白（抉择回响·新）'),
      nar('这一路，我眼睛一直盯着屏幕外的那盏灯。'),
      nar('阿禾把数位笔塞进我手里：去吧，先把鱼放出去——根，留在灯坊。'),
      say('阿禾', '这鱼再真，也没有重量。手是笨的，可弯过的篾，认得那双手。'),
      say('阿鲟', '数字灯谱仅作观赏与预习。欢迎各位前往坊内体验。'),
      nar('屏幕是门票。'),
      nar('不是灯。'),
    ],
    nextNodeId: 'B2-1',
  },

  /* ============ B2-1｜鱼游城市（楼宇之间） ============ */
  {
    id: 'B2-1',
    chapter: CHAPTER,
    sectionTitle: 'B2-1｜鱼游城市',
    scene: 'city_facade',
    backdrop: 'chains/B2-1.webp',
    lines: [
      stage('【B2】鱼游城市'),
      nar('开春，阿禾接到省城一个展的邀请。'),
      stage(
        '画面：city_facade。数百条金线数字鱼游过楼宇之间，广场人群仰头。末帧特写：每条数字鱼的"点睛"一帧，其实是一段影像——村中真人提笔点睛的手。'
      ),
      stage('画面（一）：数百条数字鱼游过楼宇之间，广场人群仰头。'),
      nar('阿禾给这次展览立了三条规矩——'),
      nar('一，不做贴牌授权，鳞纹不进量产线；'),
      nar('二，凡是有兴趣上手的人，都能免费体验；'),
    ],
    nextNodeId: 'B2-2',
  },

  /* ============ B2-2｜末帧·真人点睛的手 ============ */
  {
    id: 'B2-2',
    chapter: CHAPTER,
    sectionTitle: 'B2-2｜末帧·点睛',
    scene: 'city_facade',
    backdrop: 'chains/B2-2.webp',
    backdropCast: ['九婆', '阿禾'],
    lines: [
      stage('画面（末帧特写）：每条数字鱼的"点睛"一帧，其实是一段影像——村中真人提笔点睛的手。'),
      nar('三，展览最后一屏不放购物链接——'),
      nar('放一张回村的车票。'),
    ],
    nextNodeId: 'B3',
  },

  /* ============ B3｜后续（把人请回来） ============ */
  {
    id: 'B3',
    chapter: CHAPTER,
    sectionTitle: 'B3｜后续（把人请回来）',
    scene: 'workshop_next_year',
    backdrop: 'chains/B3.webp',
    // 周经理本场是电话画外音，不站台；坊里只有阿禾
    cast: ['阿禾'],
    lines: [
      stage('【B3】后续（把人请回来）'),
      stage(
        '画面：workshop_next_year。灯坊里出现许多生面孔——看完展开车回来的年轻人围着木台，笨拙地弯篾。'
      ),
      say('阿鲟', '城市展观展 11 万人次；由此进坊体验 5140 人次，坊内常客 130 人。转化的是被看见的机会，不是钱包。'),
      stage('周经理（电话画外音）'),
      say('周经理', '又有人问鳞纹授权开价多少——你真不卖？'),
      stage('阿禾（笑）'),
      say('阿禾', '不卖。卖回村的票。'),
      nar('鱼游出去，是为了把人带回来。'),
    ],
    nextNodeId: 'END-B-1',
  },

  /* ============ 结局 B｜《鱼入海》 ============ */
  {
    id: 'END-B-1',
    chapter: CHAPTER,
    sectionTitle: '结局B｜鱼入海',
    scene: 'fish_parade',
    backdrop: 'chains/END-B-1.webp',
    // 结局段用整幅双画面讲故事（左城市幕墙／右百鱼夜游），不叠立绘；名条照常
    cast: [],
    lines: [
      stage('【结局 B】《鱼入海》'),
      stage(
        '画面：fish_parade。同一晚双画面——城市幕墙的鱼群与村里的百鱼夜游同时亮起；一条数字鱼游过屏幕边缘，画面切到一只真手提起一盏真灯，光从纱纸里透出来。'
      ),
      stage('画面（一）：同一晚双画面——城市幕墙的鱼群，与村里的百鱼夜游，同时亮起。'),
      say('阿禾', '屏幕是河，灯坊是海。'),
      say('阿禾', '鱼从河里游过来，总得有个海可以回。'),
      nar('五千多个人进了灯坊。留下来的 130 个。'),
      nar('是从十一万个人里，一个一个走回来的。'),
    ],
    nextNodeId: 'END-B-2',
  },

  /* ============ 结局 B-2｜数字鱼游出屏幕／真手提灯 ============ */
  {
    id: 'END-B-2',
    chapter: CHAPTER,
    sectionTitle: '结局B-2｜末帧',
    scene: 'fish_parade',
    backdrop: 'chains/END-B-2.webp',
    lines: [
      stage('画面（末帧）：一条数字鱼游过屏幕边缘，画面切到一只真手提起一盏真灯，光从纱纸里透出来。'),
      nar('新，不是把灯掏空了换件衣裳，'),
      nar('是让灯走到更远的地方——'),
      nar('还认得回家的水路。'),
      card('结局二·鱼入海。'),
    ],
    nextNodeId: 'EP',
    note: 'B3／结局 B 的数据口径：观展 11 万／进坊 5140／常客 130（2026-10-18 拍板）。',
  },
]
