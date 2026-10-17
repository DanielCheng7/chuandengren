/**
 * 结局分派穷举校验（《结局机制设计 v2.0》§11 验收清单）
 *
 * 运行：node scripts/verify-ending.mjs
 * 需要 Node ≥ 22.18（原生 TypeScript 类型擦除）；本机用 Node 24 跑。
 *
 * 校验项：
 *  ① 28 种可达组合（T+I ≤ 6）全部命中且只命中一个结局；
 *  ② 分布 A 15 / B 12 / C 1；
 *  ③ (3,3) → C，(0,0)/(1,1)/(2,2) 平手归 A；
 *  ④ 「一日一篾」变体恰为 5 组：(2,1)(1,2)(2,2)(3,2)(2,3)；
 *  ⑤ 分层：A 有空/温吞/坚定，B 只有温吞/坚定，C 不分层；
 *  ⑥ 三次表态的 27 条预设路径（A/B/C 全排列）均落在 28 组之内，(3,3) 可由 CCC 与 ABC 两条路径到达。
 */
import {
  MAX_AXIS,
  isBalancedEp,
  resolveEnding,
  resolveEndingTier,
} from '../src/utils/ending.ts'

let pass = 0
let fail = 0
function ok(cond, label) {
  if (cond) {
    pass += 1
  } else {
    fail += 1
    console.error(`✗ ${label}`)
  }
}

/* ① 全部可达组合 */
const combos = []
for (let t = 0; t <= MAX_AXIS; t++) {
  for (let i = 0; i <= MAX_AXIS; i++) {
    if (t + i <= MAX_AXIS) combos.push([t, i])
  }
}
ok(combos.length === 28, `可达组合应为 28，实际 ${combos.length}`)

const counts = { A: 0, B: 0, C: 0 }
for (const [t, i] of combos) {
  const e = resolveEnding(t, i)
  ok(['A', 'B', 'C'].includes(e), `(${t},${i}) 结局应唯一且合法，得到 ${e}`)
  counts[e] += 1
}
ok(counts.A === 15, `链 A 应为 15 组，实际 ${counts.A}`)
ok(counts.B === 12, `链 B 应为 12 组，实际 ${counts.B}`)
ok(counts.C === 1, `链 C 应为 1 组，实际 ${counts.C}`)

/* ② 关键点 */
ok(resolveEnding(3, 3) === 'C', '(3,3) 应判为《两条河》')
ok(resolveEnding(2, 2) === 'A', '(2,2) 平手应归灯')
ok(resolveEnding(1, 1) === 'A', '(1,1) 平手应归灯')
ok(resolveEnding(0, 0) === 'A', '(0,0) 平手应归灯')
ok(resolveEnding(0, 1) === 'B', '(0,1) 应判为《鱼入海》')
ok(resolveEnding(3, 2) === 'A', '(3,2) 应判为《灯还亮着》')
ok(resolveEnding(2, 3) === 'B', '(2,3) 应判为《鱼入海》')
ok(resolveEnding(6, 0) === 'A', '(6,0) 应判为《灯还亮着》')
ok(resolveEnding(0, 6) === 'B', '(0,6) 应判为《鱼入海》')

/* ③ 一日一篾变体 */
const bal = combos.filter(([t, i]) => isBalancedEp(t, i)).map(([t, i]) => `${t},${i}`)
const expectBal = ['1,2', '2,1', '2,2', '2,3', '3,2']
ok(
  bal.length === expectBal.length && expectBal.every((x) => bal.includes(x)),
  `一日一篾变体应为 ${expectBal.join(' / ')}，实际 ${bal.join(' / ')}`
)
ok(!isBalancedEp(3, 3), '(3,3) 不应触发一日一篾变体')
ok(!isBalancedEp(1, 1), '(1,1) 投入过浅，不应触发一日一篾变体')
ok(!isBalancedEp(4, 2), '(4,2) 差值 2，不应触发一日一篾变体')

/* ④ 分层 */
for (const [t, i] of combos) {
  const e = resolveEnding(t, i)
  const tier = resolveEndingTier(e, t, i)
  if (e === 'A') {
    ok(tier === (t <= 1 && i <= 1 ? 'empty' : t <= 3 ? 'mild' : 'firm'), `A(${t},${i}) 分层错误：${tier}`)
  } else if (e === 'B') {
    ok(tier === (i <= 3 ? 'mild' : 'firm'), `B(${t},${i}) 分层错误：${tier}`)
  } else {
    ok(tier === undefined, `C(${t},${i}) 不应分层，得到 ${tier}`)
  }
}

/* ⑤ 三处表态的预设路径 */
const PRESETS = {
  A: { tradition: 2, innovation: 0 },
  B: { tradition: 0, innovation: 2 },
  C: { tradition: 1, innovation: 1 },
}
const paths = []
for (const p1 of Object.keys(PRESETS)) {
  for (const p2 of Object.keys(PRESETS)) {
    for (const p3 of Object.keys(PRESETS)) {
      paths.push([p1, p2, p3])
    }
  }
}
ok(paths.length === 27, `预设路径应为 27 条，实际 ${paths.length}`)
const seen = new Set()
for (const path of paths) {
  let t = 0
  let i = 0
  for (const k of path) {
    t += PRESETS[k].tradition
    i += PRESETS[k].innovation
  }
  ok(t + i <= MAX_AXIS, `${path.join('')} 超过单轴上限：(${t},${i})`)
  seen.add(`${t},${i}`)
  resolveEnding(t, i)
}
ok(seen.has('3,3'), '(3,3) 应可由预设路径到达')
ok(
  paths.some((p) => p.join('') === 'CCC') && paths.some((p) => p.join('') === 'ABC'),
  'CCC 与 ABC 两条路径都应存在'
)

/* 汇总 */
console.log(`\n结局分派穷举校验：${pass} 通过 / ${fail} 失败`)
console.log(`分布：A ${counts.A} · B ${counts.B} · C ${counts.C}；可达组合 ${combos.length}；一日一篾 ${bal.join(' ')}`)
if (fail > 0) process.exit(1)
