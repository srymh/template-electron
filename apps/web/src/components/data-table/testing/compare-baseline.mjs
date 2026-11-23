// 変更後の300行（pageSize: Infinity）の結果を、同じ行数の基準（15回）と並べる。
// 判定: Phase の5回の中央値が、基準の同じ操作・同じ条件の最大値を超えたら「見直し」。
// usage: node compare-baseline.mjs <baselineDir> <resultDir>
// baselineDir は bench-table.mjs・dnd-bench.mjs の結果を hidden・shown ごとに3回分（`hidden.json`・`hidden-rerun.json`・`hidden-rerun2.json` と `dnd-` を前に付けたもの）持つ。
import fs from 'node:fs'

const [baselineDir, phaseDir] = process.argv.slice(2)
const base = `${baselineDir}/`
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const fmt = (a) =>
  `${med(a).toFixed(1)} (${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)})`
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const ops = [
  'setPageSize',
  'rowSelect',
  'cellSelectFirst',
  'cellSelectSecond',
  'dragExtend',
  'resizeMove',
  'arrowKey',
]
const samples = (file, op) =>
  op === 'dnd'
    ? read(file.replace(/([^/]+)$/, 'dnd-$1'))
        .results.filter((r) => String(r.pageSize) === 'Infinity')
        .map((r) => r.firstFrameMs)
    : read(file)
        .results.filter((r) => String(r.pageSize) === 'Infinity')
        .map((r) => r[op].task)

for (const condition of ['hidden', 'shown']) {
  console.log(`== ${condition}`)
  for (const op of [...ops, 'dnd']) {
    const baseline = ['', '-rerun', '-rerun2'].flatMap((s) =>
      samples(`${base}${condition}${s}.json`, op),
    )
    const phase = samples(`${phaseDir}/${condition}.json`, op)
    const verdict = med(phase) > Math.max(...baseline) ? '見直し' : '範囲内'
    const slow =
      op === 'resizeMove' ? ` 遅い側 ${phase.filter((v) => v > 9).length}/${phase.length}` : ''
    console.log(
      `${op.padEnd(17)} 基準 ${fmt(baseline).padEnd(22)} 今回 ${fmt(phase).padEnd(22)} ${verdict}${slow}`,
    )
  }
}
