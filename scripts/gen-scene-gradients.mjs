/**
 * 生成场景渐变图 grad_<key>.svg（每个场景一张独立渐变图）
 *
 * 用法：npm run gen:scenes（或 node scripts/gen-scene-gradients.mjs）
 * 说明：
 *   - 色值与 src/data/scenes.ts 的 SCENES 一一对应（13 个在用 key，改色时两处同步）；
 *   - V3.0（步骤 30）：新增 museum_case／gift_shop／night_stall／studio_night／city_facade 五张；
 *     home_door／flashback 停用（对应 grad 图已清理，色值留档于 scenes.ts LEGACY_SCENES）；
 *   - 生成文件放在 public/assets/scenes/，可随时用设计稿同覆盖替换，代码零改动；
 *   - 合成规则与 SceneLayer.vue 的 CSS 回落一致：底部纵向渐变 + 圆形光源。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/assets/scenes')

const SCENES = {
  train: { base: ['#1E314B', '#31486A'], glow: '#8FB4D6', glowPos: [70, 30], glowStrength: 0.42 },
  laoxu_street: { base: ['#3A2A22', '#604632'], glow: '#E8A33D', glowPos: [80, 22], glowStrength: 0.62 },
  lantern_workshop: { base: ['#2B2119', '#503B29'], glow: '#FFB65C', glowPos: [50, 18], glowStrength: 0.58 },
  museum_case: { base: ['#232C3E', '#3E4A61'], glow: '#D8E2EE', glowPos: [50, 26], glowStrength: 0.44 },
  gift_shop: { base: ['#3E3446', '#6A5666'], glow: '#F2D8AE', glowPos: [52, 20], glowStrength: 0.6 },
  night_stall: { base: ['#1F2C44', '#34405E'], glow: '#E6EFFA', glowPos: [50, 30], glowStrength: 0.5 },
  jiupo_courtyard: { base: ['#3B382C', '#605A46'], glow: '#F5EFE2', glowPos: [65, 12], glowStrength: 0.55 },
  studio_night: { base: ['#1B2740', '#2C3A5C'], glow: '#9CC8E0', glowPos: [62, 28], glowStrength: 0.5 },
  banyan_night: { base: ['#1A2A46', '#26395C'], glow: '#FFB65C', glowPos: [50, 40], glowStrength: 0.85 },
  fish_parade: { base: ['#1C2A45', '#2C4266'], glow: '#FFD79A', glowPos: [50, 64], glowStrength: 0.8 },
  workshop_next_year: { base: ['#453A2B', '#705A3E'], glow: '#FFD79A', glowPos: [62, 20], glowStrength: 0.62 },
  city_facade: { base: ['#131F36', '#25355A'], glow: '#FFD79A', glowPos: [50, 44], glowStrength: 0.72 },
  dry_field: { base: ['#4A3628', '#805C3A'], glow: '#FFB65C', glowPos: [84, 30], glowStrength: 0.55 },
}

const W = 1600
const H = 900

function svg(def) {
  const [cx, cy] = def.glowPos
  const a1 = def.glowStrength
  const a2 = Number((def.glowStrength * 0.32).toFixed(3))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${def.base[0]}"/>
      <stop offset="1" stop-color="${def.base[1]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${cx}%" cy="${cy}%" r="80%">
      <stop offset="0" stop-color="${def.glow}" stop-opacity="${a1}"/>
      <stop offset="0.26" stop-color="${def.glow}" stop-opacity="${a2}"/>
      <stop offset="0.64" stop-color="${def.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>
`
}

mkdirSync(outDir, { recursive: true })
let count = 0
for (const [key, def] of Object.entries(SCENES)) {
  writeFileSync(resolve(outDir, `grad_${key}.svg`), svg(def), 'utf8')
  count += 1
}
console.log(`[gen-scenes] 已生成 ${count} 张场景渐变图 → public/assets/scenes/grad_*.svg`)
