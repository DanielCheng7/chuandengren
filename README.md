# 《传灯人·游鱼》互动叙事网页

以**粤西·遂溪北坡游鱼**（省级非遗）为现实原型的网页端互动叙事作品。
玩家扮演返乡青年林知遥，在 AI 助手「阿鲟」的协助下，重新理解一门手艺、一段记忆与一条河的走向。

- 技术栈：Vue 3 + Vite + TypeScript（`<script setup>`），无后端、纯静态部署
- 体验时长：约 22–28 分钟（单轮完整通关）
- 设计文档由团队另行维护（位于工作区 `思路/`，**不随本仓库提交**）。本仓库只放工程代码。

| 事项 | 唯一依据 |
|---|---|
| 剧情、节点、文案 | 《传灯人·游鱼_开发文档》§2（现 **v1.8**）／剧本 **r7** |
| AI 机制、UI 规范、技术架构、制作计划 | 同上，其余各章 |
| 结局分派与分层 | 《传灯人·游鱼_结局机制设计》**v2.1** |
| 文化事实边界 | 《传灯人_北坡版设定卡》**r2** |
| 生图提示词与场景 key | 《传灯人_人物设定与场景设计》**r4** |
| 入场 CG | 《入场CG分镜概要》**v1.1** ＋《入场CG_AI视频提示词》**v1.1** |
| 人工审核台账 | 《传灯人_审核记录》 |

---

## 快速开始

```bash
# 仓库根目录即工程根目录，克隆后直接执行
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 dist/（已 gitignore，可随时重建）
npm run preview    # 预览构建产物
npm run gen:scenes # 重新生成 13 张场景渐变图 grad_<key>.svg
```

`npm run dev` 已开启局域网访问（`host: true`），手机同一 Wi-Fi 下打开 `http://<本机IP>:5173` 可直接测竖屏。

### 队友上手（clone 后三件事）

1. **Node ≥ 20.19 或 ≥ 22.12**（Vite 8 / rolldown 的硬要求，`package.json` 的 `engines` 已写明）。
   低版本会在 `npm install` 或启动时直接报错，先升 Node 再装。
2. **`npm install`**。若卡在 `502` / `ETIMEDOUT`（公司或校园网代理常见），先 `npm config get registry`
   确认没被改，再 `npm install --prefer-offline` 重试——多半是瞬时网络问题。
3. **AI 用自己的 Key**（2026-10-23 起）：`npm run dev` 后进游戏 →「设置 → AI 模型」，
   填「模型名称 / API Base URL / API Key」→ 先「测试连接」→ 再「保存并启用」。
   配置只存在**你这台设备的浏览器**里（localStorage），**不进 Git**；存多套可随时切换，
   多人共用一台电脑也互不干扰。也可以复制 `.env.example` 为 `.env.local`（已 gitignore）
   给整台机器配一个默认值。两者都不配 → 自动退回关键词 mock，CG、BGM、存档、结局均不受影响。


---

## 当前进度（V3.0）

| 章节 | 节点 | 状态 |
|---|---|---|
| 序章 | PRO-1a → PRO-6 | ✅ 已数据化（`prologue.ts`） |
| 第一章·灯往何处去 | C1-1 → C1-5（三错位排队） | ✅ 已数据化（`c1.ts`） |
| 第二章·两条路 | C2-0 → C2-A/B → C2-X → C2-AA/BB | ✅ 已数据化（`c2.ts`） |
| 第三章·灯会前夜 | C3-1 → C3-8（含触点②）＋ C3-A/B/C ＋ C3-R | ✅ 已数据化（`c3.ts`，步骤 34–35） |
| C4 结算节点 | 独白按 T／I 取句 + 开春转场按落点取句 | ✅ 已数据化（`c4.ts`，步骤 35） |
| 链 A《灯还亮着》 | A1 开坊 → A2 记谱 → A3 三年后 → 结局 A | ✅ 已数据化（`chainA.ts`，步骤 36） |
| 链 B《鱼入海》 | B1 数字灯谱 → B2 鱼游城市 → B3 后续 → 结局 B | ✅ 已数据化（`chainB.ts`，步骤 36） |
| 链 C《灯海相连》 | E1 不二选一 → E2 骨与鳞 → E3 三年后 → 结局 C | ✅ 已数据化（`chainC.ts`，步骤 37；温吞 (2,2)／坚定 (3,3)） |
| EP ＋「一日一篾」变体 ＋ 现实篇 EP-N | EP（三分派共用台词，三套镜头侧重）/ EP-BAL（4 组）/ EP-N1–N6 / END | ✅ 已数据化（`ep.ts`，步骤 38） |

已实现：**全篇主线可通关**——标题页、入场 CG、序章字卡蒙太奇、剧情页、打字机、回看、设置、道具亮相、两处触点（C2-X／C3-4）、倾向节点自动分派（`T>I`／`I>T`／`T=I`）、C3-R 倾向报告、C4 结算节点、三条结局链、尾声 EP、「一日一篾」变体、现实篇 EP-N（可跳过）、结局页、调试面板（节点/变量/跳幕/审核↔演示模式）、场景与立绘的图片优先机制。

---

## 验证脚本

```bash
node scripts/verify-act1.mjs     # 序章 + 第一章流程自查（18 项）
node scripts/verify-c2.mjs       # 第二章两条路 + 触点①（6 项）
node scripts/verify-c3.mjs       # 第三章 + 触点② + 倾向分派 + 行样式/角色/转场（19 项）
node scripts/verify-c4.mjs       # C3-R 六档报告 + C4 三分派/分层（11 项）
node scripts/verify-chains.mjs   # 链 A／B／C + 结局页（代价段两版、C 两档、B3 数据口径，9 项）
node scripts/verify-ep.mjs       # 尾声 + 一日一篾 4 组 + 现实篇 + 跳过入口（8 项）
node scripts/verify-options.mjs  # 选项穷举：C1 六种顺序 / C2 两顺序 / C2-X 四路 / C3-4 三路（16 项）
node scripts/verify-walkthrough.mjs # 整篇真实玩家路径连通性（11 项，不跳章）
node scripts/verify-ending.mjs   # 结局分派穷举（22 组可达 / 66 项）
node scripts/verify-headless.mjs # 无头浏览器走查（先 npm run build && npm run preview）
```

验证产物写入 `.verify*/`，已 gitignore；确认无用后可直接删除。

---

## 素材机制：图片优先，无图回落（代码零改动）

| 类型 | 过渡态（当前） | 到位后 | 落位方式 |
|---|---|---|---|
| 场景（13 个 key） | 每场景一张渐变图 `grad_<key>.svg` ＋ CSS 等价渐变回落 | AI 生成 16:9 场景图 | `public/assets/scenes/bg_<key>.webp`，同名即自动生效 |
| 人物（4 人 ＋ 群像） | 不渲染立绘，只保留名条与语气色 | AI 生成 2:3 立绘 | `public/assets/characters/char-*.webp` |
| 阿鲟 | 横卧鱼灯立绘 `char-ashun.webp`（透明底、约 2:1）＋名字行小金鱼 SVG | 可整图替换 | `public/assets/characters/` |
| 鳌鱼灯 | 纯代码 SVG（`LanternVisual.vue`） | 可换图，也可保留 | `public/assets/props/` |
| 音频 | 全程可静音运行，开关与接口已就位 | 环境音 / 音效 /《鱼灯谣》 | `public/assets/audio/` |

`SceneBackdrop.vue` 与 `CharacterLayer.vue` 都是**先尝试加载图片，404 静默回落**——素材到位只需放文件，不碰组件代码。**不使用灰块占位。**

场景 key（13 个在用）：

```text
train / laoxu_street / lantern_workshop / museum_case / gift_shop / night_stall
jiupo_courtyard / studio_night / banyan_night / fish_parade / workshop_next_year
city_facade / dry_field
→ public/assets/scenes/bg_<key>.webp（未到位时用 grad_<key>.svg）
```

字体：霞鹜文楷（LXGW WenKai，SIL OFL-1.1，按 unicode-range 分包、本地托管）＋ 马善政毛笔楷书标题子集。

---

## 目录结构

```text
app/
  public/
    favicon.svg
    assets/
      fonts/       # 霞鹜文楷（分包）＋ 马善政子集
      scenes/      # grad_<key>.svg ×13 ＋ prologue/ ＋ 开场CG/ ＋ 主页面/
      characters/  # 立绘落位（空目录，放图即生效）
      props/       # 道具图落位
      audio/       # 音频落位
  src/
    App.vue        # 屏幕路由：标题页 → 黑场 → 入场 CG → 剧情页 → 结局页
    main.ts
    components/
      TitleScreen.vue      OpeningCg.vue       StoryScreen.vue
      SceneLayer.vue       SceneBackdrop.vue   SceneCard.vue
      CharacterLayer.vue   DialogueBox.vue     ChoiceButtons.vue
      FreeInput.vue        HistoryPanel.vue    SettingsPanel.vue
      ItemShowcase.vue     Watermark.vue       EndingScreen.vue
      DevPanel.vue         AiFish.vue          LanternVisual.vue
    composables/
      useStoryEngine.ts    # 剧情引擎（节点流转 / 条件 / 双轴计分 / 触点 / 续玩）
      useSettings.ts       # 字号 / 打字速度 / 音量 / 审核模式
      useTypewriter.ts     # 打字机
    data/
      story/index.ts       # 节点汇总 ＋ 章节入口
      story/prologue.ts    # 序章 PRO
      story/c1.ts          # 第一章 C1
      story/c2.ts          # 第二章 C2（含 C2-X 触点）
      story/format.ts      # 行格式工具
      scenes.ts            # 13 场景 key ＋ 氛围参数（LEGACY_SCENES 留档停用场景）
      characters.ts        # 人物立绘 key 与语气色
      fallbackDialogue.ts  # 备用文本台账
    services/aiClient.ts   # AI 判定层（mock / 远程代理 / 8s 超时 / 严格 JSON）
    types/story.ts         # 数据模型
    utils/ending.ts        # 结局分派 ＋ 强度分层
    utils/speakerTone.ts   # 名字语气色映射
    styles/global.css      # 色板与全局样式
  scripts/                 # 场景渐变生成 ＋ 无头验证
```

## 数据模型要点

- 双轴 `tradition` / `innovation`（**0–6**，互不联动）＋ `stances[]` 表态记录 ＋ `c1Order` / `c2First` / `visitedNodes` / `freeInputs` / `appliedOnce`
- 节点类型：`normal` / `montage`（序章蒙太奇）/ `choice` / `stance`（AI 判定触点）/ `report`（倾向报告）/ `settle`（C4 结算）/ `ending`
- 选项 `Choice.effects` 改数值，`onceKey` 保证同一选择只计分一次；C2「体验一条自动解锁另一条」与 C1「三错位必看全」由 `visitedNodes` / `c1Order` 驱动（`unlock` / `requiresVisited` 为预留字段，当前未使用）
- 条件统一走 `Condition`（`tradition` / `innovation` / `ending` / `endingTier` / `visited` 等）
- 剧本的**画面／声音／舞台提示**记为 `type: 'stage'`：审核模式显示、演示模式隐藏
- UI 默认不显示任何数值；AI 只返回严格 JSON `{tradition, innovation, evidence}`，不写剧情、不参与跳转

## AI 服务

**仓库里不放任何密钥**（项目要公开）。AI 配置有两个入口，都能用：

| 入口 | 适合谁 | 存在哪 | 进 Git 吗 |
|---|---|---|---|
| **设置 → AI 模型**（页面内） | 每个人自己测、随时换模型／换 Key | 本机浏览器 `localStorage` | 否 |
| `.env.local` | 演示机／整台机器的默认值 | 仓库目录（gitignore） | 否 |

游戏内路径：**设置 → AI 模型** → 填 `模型名称` / `API Base URL` / `API Key` →「测试连接」→「保存并启用」。
可以存多套（列表里点一下即切换），也可以「用服务端默认」把本地配置让开。

- **优先级**：设置页选中的那条 > `.env.local` > `.env`（若存在）> 缺省。都没有 → 关键词 mock，仍可完整通关。
- 代理实现在 `server/ai-proxy.mjs`，`vite.config.ts` 的 `cdr-ai-route` 挂在 `/api/ai`。
  设置页填的 Key 随请求体（`auth: {apiKey, baseUrl, model}`）发给**同源**代理，由服务端转发；
  代理不回显、不打日志，前端代码与构建产物里没有任何密钥。
- 协议按 **OpenAI 兼容**写死（`POST {base}/chat/completions` + `Authorization: Bearer`）：换服务商只改设置页三项（或 `AI_BASE_URL`/`AI_MODEL`），代码零改动。

### 模型兼容性（能填什么）

| 情况 | 举例 | 设置页怎么填 |
|---|---|---|
| **可直接用**（OpenAI 兼容 `/chat/completions`） | 火山方舟、DeepSeek、阿里百炼（compatible-mode）、智谱、Moonshot/Kimi、MiniMax、硅基流动、OpenRouter、Groq、Together，以及 one-api / new-api 之类中转 | 填 `…/v1` 形式的 Base URL + 模型名 + Key |
| **本地模型** | Ollama（`http://127.0.0.1:11434/v1`）、vLLM、LM Studio | 同上；代理允许 `http://` 与本机地址 |
| **需要兼容层／中转** | Gemini 原生（可用 `…/v1beta/openai`）、Claude（Anthropic 无官方 OpenAI 兼容端点）、百度千帆、腾讯混元原生、**Azure OpenAI**（`api-key` 头 + 部署路径）、AWS Bedrock / Vertex（SigV4 签名） | 前面挂 litellm / one-api 之类，再填中转地址 |

两个已知坑已自动兜底，不用手工处理：

- **严格网关拒 `thinking` / `response_format`**（方舟系扩展字段）→ 代理收到 4xx 且报错提到这些字段时，**自动剥掉扩展字段重试一次**，页面照常「连接成功」。
- **Base URL 误粘完整接口地址**（`…/v1/chat/completions`）→ 自动剥成 `…/v1`，不会拼成双路径。

注意：判定只给 **7s**（代理，早于前端 8s），慢的思考模型容易 504 → 判 `0/0`；测试建议先点「测试连接」看回包。
- **思考模型默认关思考**（`AI_THINKING=disabled`，可设 `default` 表示不传该参数）——DeepSeek-V4.1、doubao-seed 这类模型会先吐 `reasoning_content`，token 用尽时 `content` 是空的，判定就废了。
- 前端只发 `{ prompt, json?, auth? }`、收回 `{ text }`；`json:true` 时带 `response_format: json_object`（触点判定要严格 JSON）。
- **降级链**：代理不存在（纯静态托管）或没配 Key → 前端永久退回 mock（关键词粗判，仍可完整通关）；上游真出错 → 一律 `0/0` + 固定回退句，**绝不阻断剧情**；失败原因（含上游原文）透传到 `console.warn` 与设置页的「测试连接」结果。
- 纯静态部署：`node --env-file=.env.local server/ai-proxy.mjs`（默认 8787）单独起代理，再把 `VITE_AI_ENDPOINT` 指过去。
- `temperature 0.2`、每轴幅度锁 ±1、前端 8s／上游 7s 超时。

> ⚠️ **公开仓库前必做**：2026-10-22 曾把一份测试 Key 提交进 `.env`（commit `172ed42`～`35bfd56`，
> 已于 2026-10-23 移出版本控制）。**删文件不等于删历史**——公开前请到方舟控制台**吊销那把 Key**，
> 需要的话再新签一把只放本地 `.env.local` 或设置页。
