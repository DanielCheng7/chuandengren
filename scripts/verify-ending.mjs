/**
 * 结局分派穷举校验（《结局机制设计 v2.1》§11 验收清单）
 *
 * 运行：node scripts/verify-ending.mjs
 * 需要 Node ≥ 22.18（原生 TypeScript 类型擦除）；本机用 Node 24 跑。
 *
 * 数值来源（v2.1 / 剧本 r5）：C1 选择①(+1/0，仅首次) ／ C2 选择②(+1，仅首次)
 *                            ／ C2-X(±2 或 +1+1，可跳过) ／ C3-4(±2 或 +1+1)
 *
 * 校验项：
 *  ① 可达组合 22 组，全部命中且只命中一个结局；
 *  ② 分布 A 10 / B 10 / C 2；
 *  ③ 关键点：(2,2)(3,3) → C；T>I → A；I>T → B；
 *  ④ 「一日一篾」变体恰 4 组：(1,2)(2,1)(2,3)(3,2)；
 *  ⑤ 分层：A t≤3 温吞/t≥4 坚定；B i≤3 温吞/i≥4 坚定；C sum≤4 温吞；
 *  ⑥ 72 条预设路径全部落在 22 组内，(2,2) 与 (3,3) 均可达。
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

/* 数值来源定义 */
const C1 = [
  { key: 'C1-A', t: 1, i: 0 }, // 文化馆（守+1）
  { key: 'C1-B', t: 0, i: 1 }, // 文创店（新+1）
  { key: 'C1-C', t: 0, i: 0 }, // 夜市摊（不计分）
]
const C2 = [
  { key: 'C2-A', t: 1, i: 0 }, // 九婆
  { key: 'C2-B', t: 0, i: 1 }, // 阿禾
]
const X = [
  { key: 'X-A', t: 2, i: 0 },
  { key: 'X-B', t: 0, i: 2 },
  { key: 'X-C', t: 1, i: 1 },
  { key: 'X-skip', t: 0, i: 0 }, // 可跳过
]
const C34 = [
  { key: '34-A', t: 2, i: 0 },
  { key: '34-B', t: 0, i: 2 },
  { key: '34-C', t: 1, i: 1 },
]

/* ① 可达组合 */
const reach = new Set()
for (const a of C1) {
  for (const b of C2) {
    for (const c of X) {
      for (const d of C34) {
        reach.add(`${a.t + b.t + c.t + d.t},${a.i + b.i + c.i + d.i}`)
      }
    }
  }
}
const combos = [...reach]
  .map((k) => k.split(',').map(Number))
  .sort((p, q) => p[0] - q[0] || p[1] - q[1])
ok(combos.length === 22, `可达组合应为 22，实际 ${combos.length}：${combos.map((p) => `(${p})`).join(' ')}`)
ok(combos.every(([t, i]) => t + i <= MAX_AXIS), '所有组合的 T+I 应 ≤ 6')
ok(Math.min(...combos.map(([t, i]) => t + i)) === 3, '最小投入应为 T+I = 3（空版不可达）')

/* ② 分布 */
const counts = { A: 0, B: 0, C: 0 }
for (const [t, i] of combos) {
  const e = resolveEnding(t, i)
  ok(['A', 'B', 'C'].includes(e), `(${t},${i}) 结局应唯一且合法，得到 ${e}`)
  counts[e] += 1
}
ok(counts.A === 10, `链 A 应为 10 组，实际 ${counts.A}`)
ok(counts.B === 10, `链 B 应为 10 组，实际 ${counts.B}`)
ok(counts.C === 2, `链 C 应为 2 组，实际 ${counts.C}`)

/* ③ 关键点 */
ok(resolveEnding(2, 2) === 'C', '(2,2) 平手应进《灯海相连》')
ok(resolveEnding(3, 3) === 'C', '(3,3) 平手应进《灯海相连》')
ok(resolveEnding(3, 2) === 'A', '(3,2) 守多应进《灯还亮着》')
ok(resolveEnding(2, 3) === 'B', '(2,3) 新多应进《鱼入海》')
ok(resolveEnding(6, 0) === 'A', '(6,0) 应进《灯还亮着》')
ok(resolveEnding(0, 6) === 'B', '(0,6) 应进《鱼入海》')

/* ④ 一日一篾变体 */
const bal = combos.filter(([t, i]) => isBalancedEp(t, i)).map(([t, i]) => `${t},${i}`)
const expectBal = ['1,2', '2,1', '2,3', '3,2']
ok(
  bal.length === expectBal.length && expectBal.every((x) => bal.includes(x)),
  `一日一篾变体应为 ${expectBal.join(' / ')}，实际 ${bal.join(' / ')}`
)
ok(!isBalancedEp(2, 2), '(2,2) 已进合流，不应触发一日一篾')
ok(!isBalancedEp(3, 3), '(3,3) 已进合流，不应触发一日一篾')
ok(!isBalancedEp(4, 2), '(4,2) 差值 2，不应触发一日一篾')

/* ⑤ 分层 */
for (const [t, i] of combos) {
  const e = resolveEnding(t, i)
  const tier = resolveEndingTier(e, t, i)
  if (e === 'A') {
    ok(tier === (t <= 3 ? 'mild' : 'firm'), `A(${t},${i}) 分层错误：${tier}`)
  } else if (e === 'B') {
    ok(tier === (i <= 3 ? 'mild' : 'firm'), `B(${t},${i}) 分层错误：${tier}`)
  } else {
    ok(tier === (t + i <= 4 ? 'mild' : 'firm'), `C(${t},${i}) 分层错误：${tier}`)
  }
}
ok(resolveEndingTier('C', 2, 2) === 'mild', '链 C (2,2) 应为温吞版')
ok(resolveEndingTier('C', 3, 3) === 'firm', '链 C (3,3) 应为坚定版')

/* ⑥ 预设路径 */
const paths = []
for (const a of C1) {
  for (const b of C2) {
    for (const c of X) {
      for (const d of C34) {
        paths.push([a, b, c, d])
      }
    }
  }
}
ok(paths.length === 72, `预设路径应为 72 条，实际 ${paths.length}`)
ok(reach.has('2,2'), '(2,2) 应可达')
ok(reach.has('3,3'), '(3,3) 应可达')
ok(reach.has('6,0') && reach.has('0,6'), '(6,0) 与 (0,6) 均应可达')

/* 汇总 */
console.log(`\n结局分派穷举校验：${pass} 通过 / ${fail} 失败`)
console.log(
  `分布：A ${counts.A} · B ${counts.B} · C ${counts.C}；可达组合 ${combos.length}；一日一篾 ${bal.join(' ')}`
)
if (fail > 0) process.exit(1)
