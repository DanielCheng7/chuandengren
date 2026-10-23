# readme.md · 运行说明

> 项目：《传灯人·游鱼》——粤西北坡游鱼非遗互动叙事网页（纯前端）
> 技术栈：Vue 3 + Vite + TypeScript（`<script setup>`），无后端、纯静态部署

## 一、环境要求

- Node.js ≥ 20.19 或 ≥ 22.12（Vite 8 / rolldown 的硬性要求，`package.json` 的 `engines` 已写明；低版本会在 `npm install` 或启动时直接报错）
- npm ≥ 9
- 现代浏览器：Chrome / Edge 最新版，兼容 Safari 与移动端（16:9 横屏体验最佳）

## 二、安装与启动

```bash
cd chuandengren
npm install
npm run dev        # 开发模式，默认 http://localhost:5173
```

- `npm run dev` 已开启局域网访问（`host: true`），手机同一 Wi-Fi 下打开 `http://<本机IP>:5173` 可直接测试。
- 若 `npm install` 卡在 `502` / `ETIMEDOUT`（校园网代理常见），先 `npm config get registry` 确认没被改动，再 `npm install --prefer-offline` 重试——多半是瞬时网络问题。

## 三、构建与本地演示

```bash
cd chuandengren
npm run build      # 产出静态文件到 dist/
npm run preview    # 本地预览构建产物（默认 http://localhost:4173）
```

构建使用 `base:'./'` 相对路径与 hash 路由（`createWebHashHistory`），`dist/` 目录可直接放到任意静态托管（Netlify / GitHub Pages / 校内服务器）或本地直接打开，刷新不会 404。

## 四、体验路径

`标题页 → 入场 CG → 序章 → 第一章 → 第二章 → 第三章 → 结算节点 → 三条结局链之一 → 尾声 EP → 结局页`

- **抉择**：关键节点在「守旧 / 创新 / 平衡」间表态，实时改变后台双轴数值（界面不显示任何数值）；三条结局链由结算自动分派。
- **AI 触点**：两处触点支持预设选项与自由输入（≤100 字），自由输入由大模型判定倾向；预设选项为固定判定，不调 AI。
- **存档**：localStorage 自动保存，首页可「继续游戏」。
- 单次完整通关约 **20–25 分钟**。

## 五、AI 服务配置

- **开箱即用**：仓库 `.env` 已带一份团队共用测试 Key（火山方舟），clone 后 `npm run dev` 就能用真模型，日志会打印 `✅ [ai] …`。
- **换自己的 Key / 模型**：不要改 `.env`，新建 `.env.local` 覆盖（优先级更高、且不进 Git）；`AI_API_KEY` 留空即退回关键词 mock。
- **不配 Key 也能完整通关**：代理不存在或未配 Key 时，前端永久退化为本地关键词判定，剧情、存档、结局均不受影响。
- **密钥安全**：密钥只存在于服务端进程，不进浏览器、不进构建产物。
- 纯静态部署时，可单独启动轻量代理：`node --env-file=.env server/ai-proxy.mjs`（默认 8787），再把 `VITE_AI_ENDPOINT` 指过去。

## 六、素材机制：图片优先，无图回落

| 类型           | 落位方式                                            | 未到位时                      |
| ------------ | ----------------------------------------------- | ------------------------- |
| 场景（13 个 key） | `public/assets/scenes/bg_<key>.webp`（16:9）      | 代码生成的渐变图 `grad_<key>.svg` |
| 人物立绘         | `public/assets/characters/char-*.webp`（2:3 透明底） | 不渲染立绘，仅保留名条与语气色           |
| 音频           | `public/assets/audio/`                          | 全程可静音运行，开关与接口已就位          |

素材按「放对目录、按规范命名」即自动生效，**无需改任何代码**（`SceneBackdrop.vue` / `CharacterLayer.vue` 先尝试加载图片，404 静默回落）。

字体：霞鹜文楷（LXGW WenKai，SIL OFL-1.1，本地分包托管）＋ 马善政毛笔楷书标题子集。

## 七、目录速览

```text
chuandengren/
├── package.json               # dev / build / preview 脚本
├── vite.config.ts             # base:'./'，@ -> ./src，cdr-ai-route 挂载 /api/ai
├── server/ai-proxy.mjs        # AI 服务端代理（密钥不下发浏览器）
└── src/
    ├── App.vue                # 屏幕路由：标题页 → 黑场 → 入场 CG → 剧情页 → 结局页
    ├── components/            # TitleScreen / OpeningCg / StoryScreen / DialogueBox
    │                          # ChoiceButtons / FreeInput / HistoryPanel / SettingsPanel
    │                          # ItemShowcase / EndingScreen / DevPanel / AiFish / LanternVisual
    ├── composables/
    │   ├── useStoryEngine.ts  # 剧情引擎（节点流转 / 条件 / 双轴计分 / 触点 / 续玩）
    │   ├── useSettings.ts     # 字号 / 打字速度 / 音量 / 审核模式
    │   └── useTypewriter.ts   # 打字机
    ├── data/
    │   ├── story/             # prologue / c1 / c2 / c3 / c4 / chainA / chainB / chainC / ep
    │   ├── scenes.ts          # 13 场景 key ＋ 氛围参数
    │   ├── characters.ts      # 人物立绘 key 与语气色
    │   └── fallbackDialogue.ts# 备用文本台账
    ├── services/aiClient.ts   # AI 判定层（mock / 远程代理 / 超时 / 严格 JSON）
    ├── types/story.ts         # 数据模型
    ├── utils/ending.ts        # 结局分派 ＋ 强度分层
    └── styles/global.css      # 色板与全局样式
```

## 八、常见问题

- **页面空白 / 启动报错**：确认在 `chuandengren` 目录执行命令；Node 版本低于 20.19 / 22.12 会直接报错，先升级 Node 再安装。
- **`npm install` 网络超时**：多为瞬时网络问题，`npm install --prefer-offline` 重试。
- **缺图**：由 `assetFallback.js` 以内联 SVG / 渐变图占位兜底，不影响通关流程。
- **AI 判定无响应**：属预期降级——未配 Key 或上游失败时自动落为固定回退，不阻断剧情。
- **想改剧情文案**：编辑 `src/data/story/*.ts` 各章数据文件，无需改组件。
