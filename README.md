# 《传灯人》互动叙事网页原型

以**粤西·遂溪北坡游鱼**（省级非遗）为现实原型的网页端互动叙事作品。
玩家扮演返乡青年林知遥，面对奶奶留下的一盏未完成的鳌鱼灯，在 AI 助手「阿鲟」的协助下重新理解技艺、记忆与代际传承。

- 技术栈：Vue 3 + Vite + TypeScript（组合式 API + `<script setup>`），无后端、纯静态部署
- 体验时长：约 18–22 分钟（单轮完整通关）
- 依据文档（设计文档由团队另行分发，不随本仓库提交）：

| 事项 | 唯一依据 |
|---|---|
| 台词、分支、场景题注 | **《传灯人_剧本_V2.0.md》（艺术精简版 · 修订 r1「保存 vs 使用」主线）** |
| 节点表、变量、阈值、验收标准 | 《传灯人_互动叙事网页原型规格书_MVP1.0.md》（r4） |
| 工程结构、素材机制、UI 规范、AI 服务 | 《传灯人_项目搭建实现方案书.md》 |
| 文化事实边界 | 《传灯人_北坡版设定卡_r2.md》 |
| 生图提示词与场景 key | 《传灯人_人物设定与场景设计.md》（r2） |
| 执行顺序、审核卡点、进度 | 《传灯人_制作计划.md》（r4） |

---

## 快速开始

```bash
# 仓库根目录即工程根目录，克隆后直接执行
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run preview  # 预览产物
```

`npm run dev` 已开启局域网访问（`host: true`），手机同一 Wi-Fi 下打开 `http://<本机IP>:5173` 可直接测竖屏。

---

## 当前进度（制作计划 r4）

| 阶段 | 状态 |
|---|---|
| 0 调研（技术参考 + 非遗视觉方向） | ✅ |
| 1 工程初始化（步骤 1–4） | ✅ |
| 2 剧情引擎与组件（步骤 5–8） | ✅ |
| 3 工程对齐 V2.0（步骤 9–11） | ✅ 场景体系升级 / 素材机制 / **第一幕按 V2.0 重录 → 待审核卡点 ①** |
| 4 第二幕（步骤 12） | ⏸ 等审核通过 |
| 5 第三幕（步骤 13–14，含纸条显影演出） | ⏸ |
| 6–9 AI 完善 / 素材接入 / 测试 / 部署 | ⏸ 接口与骨架已就位 |

已实现：标题页、剧情页（舞台 + 叙事 + 选择 + 工具栏）、打字机、回看、重新开始、进度续玩、S04 自由输入（mock AI + 备用文本）、调试面板（节点/变量/一键跳幕/审核↔演示模式）、结局页框架、场景图片优先机制、人物立绘层。

---

## 步骤 0-1｜技术参考调研结论

检索了 GitHub 与社区里的 Vue 视觉小说实现，**只看思路，不引依赖**（本项目体量小，自研引擎更可控，也避免为 UI 框架耗时）：

| 参考 | 取了什么 | 不取什么 |
|---|---|---|
| [KosuzuEngine](https://github.com/AndreaFrederica/KosuzuEngine)（Vue3 + Quasar 视觉小说引擎） | 模块划分思路：引擎核心 / 渲染 / 音频 / 持久化分层；对白推进、历史回看、存档是三个独立职责 | Quasar 组件库、Pinia、i18n、舞台坐标系等重架构 |
| [vue-visual-novel-engine](https://yarnpkg.com/en/package/vue-visual-novel-engine) | 章节数据结构（chapter → dialogues → choices）、分支上挂数值、"选择影响好感度"的表达方式 | 直接依赖、6 槽位存档等超出 MVP 的功能 |
| 视觉小说通用交互惯例 | 打字机 + 点击跳过；历史回看；自动播放；"点击任意处推进" | 立绘进场/退场动画、语音系统 |

据此自研最小引擎：`composables/useStoryEngine.ts`（节点流转 + 条件过滤 + effects + localStorage 续玩 + 回看），剧情数据全部外置在 `src/data/story/`。

## 步骤 0-2｜非遗视觉方向调研结论

参考了顺德大良鱼灯互动体验《鱼影成灯》（工艺分步 + 粒子、"宣纸水面"质感）、抖音文创"DOU 来跃龙门"鱼灯礼盒配色（朱砂红 × 青灰蓝 × 沉香色 × 鱼肚白）、泉州元宵专题《鲤上元》（深墨底 + 米白 + 金）等同类作品。

**结论（克制清单）**

采用：
- 既定色板（`src/styles/global.css` 的 `:root`）：墨蓝 `#101B2C` / 暖金 `#E8A33D` / 烛光橙 `#FFB65C` / 竹青 `#6E8B7A` / 纱纸白 `#F5EFE2` / 暗红 `#8C3B2E`
- "一冷一暖"的光比：夜色永远是墨蓝底 + 一处明确暖光源
- **四意象定调**（剧本 V2.0）：火（承诺与记忆，光永远是暖的、有呼吸的）、水（乡愁与"游鱼带水"，只作意象，画面不出现海／码头／船）、竹（技艺与父辈，竹篾弧度是画面骨架线）、纸（脆弱的记录，透光与纤维质感）
- 纸纹颗粒（SVG 噪声，低透明度）统一全套画面的质感
- 鱼鳞纹只在边角、分隔线、进度条上克制使用

不做：
- 科幻 HUD、赛博朋克、机器人拟人形象（阿鲟是"一条由暖金细线构成的鱼"）
- 满屏铺传统纹样、金碧辉煌的"国潮模板感"
- 高饱和大红大绿；不为风格牺牲正文可读性
- 复杂 3D 场景、夸张粒子爆炸

---

## 素材机制：图片优先，无图回落（代码零改动）

**当前人物与场景素材尚未到位**，工程用"有意图的过渡态"顶住，而不是灰块占位：

| 类型 | 过渡态（现在） | 到位后 | 怎么替换 |
|---|---|---|---|
| 场景（10 个 key） | 底色渐变 + 光源 + 纸纹 + 暗角的**氛围底版** | AI 生成 16:9 场景图 | 放进 `public/assets/scenes/bg_*.webp`，**同名即自动启用** |
| 人物（4 人 + 群像） | 不渲染立绘，只保留对白框角色名条与语气色 | AI 生成 2:3 立绘 | 放进 `public/assets/characters/char-*.webp` |
| 阿鲟 / 鳌鱼灯三态 | 纯代码 SVG（`AiFish.vue` / `LanternVisual.vue`） | 可换 AI 图，也可保留（与"竹篾骨架"气质一致） | 道具图入 `public/assets/props/` |
| 音频 | 全程可静音运行，开关与接口已就位 | 实拍环境音 / 音效 /《鱼灯谣》 | 放入 `public/assets/audio/` |

实现要点：`SceneBackdrop.vue` 与 `CharacterLayer.vue` 都是**先尝试加载图片，404 即静默回落**——素材到位时只需放文件，不碰任何组件代码。

场景 key 与文件命名（对齐《剧本 V2.0》§3、《人物设定与场景设计 r2》§2）：

```text
train / laoxu_street / lantern_workshop / home_door / jiupo_courtyard
banyan_night / fish_parade / workshop_next_year / dry_field / flashback
→ public/assets/scenes/bg_<key>.webp
```

---

## 目录结构

```text
app/
  public/
    favicon.svg
    assets/                     # 可替换素材（AI 生图与音频落位处）
      scenes/ characters/ props/ audio/
  src/
    App.vue                     # 屏幕路由：标题页 / 剧情页 / 结局页
    main.ts
    components/
      TitleScreen.vue           # 标题页
      StoryScreen.vue           # 剧情页（舞台 + 叙事 + 选择 + 工具栏）
      DialogueBox.vue           # 对白框（打字机、五类文本样式）
      ChoiceButtons.vue         # 选项组（审核模式显示剧本编号）
      FreeInput.vue             # S04 自由输入（预设 ×3 + 自由文本，200 字上限）
      EndingScreen.vue          # 结局页（固定结局 + 变量标签 + AI 旅程回顾位）
      ProgressBar.vue           # 进度条
      HistoryPanel.vue          # 回看
      DevPanel.vue              # 调试面板（变量 / 跳幕 / 审核↔演示模式）
      SceneBackdrop.vue         # 场景层（图片优先、无图回落氛围底版）
      CharacterLayer.vue        # 人物立绘层（无素材自动隐藏）
      LanternVisual.vue         # 鳌鱼灯三态（纯代码 SVG）
      AiFish.vue                # 阿鲟（纯代码 SVG）
    composables/
      useStoryEngine.ts         # 剧情引擎
      useSettings.ts            # 设置（打字机 / 审核模式），模块级单例
      useTypewriter.ts          # 打字机
    data/
      story/act1.ts             # 第一幕（对齐剧本 V2.0，逐字录入）
      story/index.ts            # 节点汇总 + 幕入口
      scenes.ts                 # 10 个场景 key + 氛围参数 + 素材文件名
      characters.ts             # 人物立绘 key 与语气色
      fallbackDialogue.ts       # 备用文本台账
    services/
      aiClient.ts               # AI 服务层（mock / 远程代理 / 8s 超时 / 两套提示词模板）
    types/story.ts              # 数据模型
    styles/global.css           # 色板与全局样式
```

## 数据模型要点

- `StoryNode.lines[]` 是**顺序播放的行**；每行可有 `when` 条件（例：A3-2 的"口袋里有没有那封信"）
- 选项 `Choice.outcome[]` 装该选项展开的分支叙述，再按 `nextNodeId` 汇合
- 条件文本、门控选项统一用 `Condition` 表达（`hasLetter` / `memory>=4` / `route` / `lightingChoice` …）
- 剧本的**斜体场景题注与箭头提示**记为 `type: 'stage'`：**审核模式显示、演示模式隐藏**
- 只有对白与短信显示角色名条（V2.0 正文为第一人称叙述，旁白不带名条）
- 数值统一 0–5 钳制；AI 只提供文本，不参与跳转与变量计算

## 环境变量

AI 默认走 **mock 模式**（无需任何 Key 即可完整跑通）。接入真实模型时只需提供**服务端代理地址**：

```bash
# .env.local（不要提交）
VITE_AI_ENDPOINT=https://<你的服务端代理>/api/ashun
```

代理需接收 `{ prompt: string }`、返回 `{ text: string }`。**任何 API Key 都不得写入前端代码。**
