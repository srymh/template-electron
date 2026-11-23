// /demo/table の操作ごとの描画時間を測る。
// usage: node bench-table.mjs <out.json> [runs] [devtoolsHidden=true|false]
import fs from 'node:fs'

import { connect, sleep, waitForExpression } from './cdp-client.mjs'

const [outFile, runsArg = '5', hideDevtoolsArg = 'true'] = process.argv.slice(2)
const runs = Number(runsArg)
const cdp = await connect({ port: 9222, urlPrefix: 'http://localhost:5173' })
await cdp.send('Page.enable')
await cdp.send('Page.bringToFront').catch(() => {})
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 0,
  mobile: false,
})

const originalDevtools = await cdp.evaluate(`localStorage.getItem('vite-ui-devtools')`)

// ページ内のヘルパー。操作を dispatch し、同期描画の完了（タスク）と次のフレームまでを測る。
const helpers = `
window.__tb = {
  task: () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0) }),
  frame: () => new Promise((r) => requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0) })),
  async measure(fn) {
    const t0 = performance.now()
    fn()
    await this.task()
    const t1 = performance.now()
    await this.frame()
    const t2 = performance.now()
    return { task: t1 - t0, frame: t2 - t0 }
  },
  table: () => document.querySelector('table'),
  cell: (r, c) => document.querySelector('table tbody').rows[r].cells[c],
  mouse(el, type, extra = {}) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'mouseenter', cancelable: true, button: 0, buttons: 1, view: window, ...extra }))
  },
  setSelect(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  },
  pageSizeSelect: () => [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === 'すべて')),
  scenarioSelect: () => document.querySelector('select[aria-label="検証ケース"]'),
}
true`

async function evaluate(expression) {
  return cdp.evaluate(`(async () => { ${expression} })()`)
}

const results = []
try {
  await cdp.evaluate(
    hideDevtoolsArg === 'true'
      ? `localStorage.setItem('vite-ui-devtools', 'true'); true`
      : `localStorage.removeItem('vite-ui-devtools'); true`,
  )
  for (const pageSize of ['10', '100', 'Infinity']) {
    for (let run = 0; run < runs; run += 1) {
      await cdp.evaluate(`location.hash = '#/demo/table'; location.reload(); true`).catch(() => {})
      await sleep(500)
      await waitForExpression(cdp, `!!document.querySelector('table tbody tr')`)
      await sleep(1000)
      await cdp.evaluate(helpers)
      const out = { pageSize }

      // 件数の変更（行の描画）
      out.setPageSize = await evaluate(
        `return __tb.measure(() => __tb.setSelect(__tb.pageSizeSelect(), ${JSON.stringify(pageSize)}))`,
      )
      await sleep(500)
      out.rowCount = await cdp.evaluate(`document.querySelector('table tbody').rows.length`)
      // DOM の大きさ（文書全体と表の中の要素数）
      out.elementCount = await cdp.evaluate(`document.querySelectorAll('*').length`)
      out.tableElementCount = await cdp.evaluate(
        `document.querySelector('table').querySelectorAll('*').length`,
      )

      // ケースの切り替えで作り直す（マウント）
      out.remount = await evaluate(`
        __tb.setSelect(__tb.scenarioSelect(), 'display'); await __tb.frame(); await new Promise((r) => setTimeout(r, 300))
        return __tb.measure(() => __tb.setSelect(__tb.scenarioSelect(), 'all'))`)
      await sleep(500)
      // 作り直すと件数は初期値に戻るため、もう一度合わせる
      await evaluate(
        `__tb.setSelect(__tb.pageSizeSelect(), ${JSON.stringify(pageSize)}); await __tb.frame(); return true`,
      )
      await sleep(500)

      // 行選択のチェックボックス
      out.rowSelect = await evaluate(
        `return __tb.measure(() => __tb.cell(2, 0).querySelector('button,input').click())`,
      )
      await sleep(300)

      // セルの選択（起点なし → 1つ目）
      out.cellSelectFirst = await evaluate(
        `return __tb.measure(() => { const td = __tb.cell(3, 2); __tb.mouse(td, 'mousedown'); __tb.mouse(td, 'mouseup') })`,
      )
      await sleep(300)
      // セルの選択（起点あり → 別のセル）
      out.cellSelectSecond = await evaluate(
        `return __tb.measure(() => { const td = __tb.cell(5, 3); __tb.mouse(td, 'mousedown'); __tb.mouse(td, 'mouseup') })`,
      )
      await sleep(300)

      // ドラッグで範囲を広げる（隣のセルへ1回入る）。React の mouseenter は mouseover/mouseout から合成される
      out.dragExtend = await evaluate(`
        const start = __tb.cell(1, 2); __tb.mouse(start, 'mousedown'); await __tb.frame()
        const next = __tb.cell(4, 4)
        const r = await __tb.measure(() => { __tb.mouse(start, 'mouseout', { relatedTarget: next }); __tb.mouse(next, 'mouseover', { relatedTarget: start }) })
        __tb.mouse(next, 'mouseup'); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return r`)
      await sleep(300)

      // 列幅のドラッグ（mousemove 1回ぶん。columnResizeMode は onChange）
      out.resizeMove = await evaluate(`
        const handle = document.querySelector('button[aria-label="名前の列幅を変更"]')
        const x = handle.getBoundingClientRect().left
        __tb.mouse(handle, 'mousedown', { clientX: x }); await __tb.frame()
        const r = await __tb.measure(() => document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x + 20 })))
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x + 20 })); return r`)
      await sleep(300)

      // 矢印キーでの移動
      out.arrowKey = await evaluate(`
        const td = __tb.cell(3, 3); __tb.mouse(td, 'mousedown'); __tb.mouse(td, 'mouseup'); await __tb.frame(); await new Promise((r) => setTimeout(r, 100))
        const focused = document.querySelector('td[data-selected-state=focused]') ?? td
        return __tb.measure(() => focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })))`)
      await sleep(300)

      console.log(JSON.stringify(out))
      results.push(out)
    }
  }
} finally {
  await cdp
    .evaluate(
      originalDevtools === null
        ? `localStorage.removeItem('vite-ui-devtools'); true`
        : `localStorage.setItem('vite-ui-devtools', ${JSON.stringify(originalDevtools)}); true`,
    )
    .catch((e) => console.error('restore failed', e.message))
  await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
  await sleep(5000)
}

// pageSize・操作ごとの中央値と最小・最大
const summary = {}
for (const pageSize of ['10', '100', 'Infinity']) {
  const group = results.filter((r) => r.pageSize === pageSize)
  summary[pageSize] = {
    rowCount: group[0]?.rowCount,
    elementCount: group[0]?.elementCount,
    tableElementCount: group[0]?.tableElementCount,
  }
  for (const key of Object.keys(group[0] ?? {})) {
    if (typeof group[0][key] !== 'object') continue
    for (const phase of ['task', 'frame']) {
      const values = group.map((r) => r[key][phase]).sort((a, b) => a - b)
      summary[pageSize][`${key}.${phase}`] =
        `${values[Math.floor(values.length / 2)].toFixed(1)} (${values[0].toFixed(1)}-${values.at(-1).toFixed(1)})`
    }
  }
}
fs.writeFileSync(
  outFile,
  JSON.stringify(
    { measuredAt: new Date().toISOString(), hideDevtools: hideDevtoolsArg, results, summary },
    null,
    2,
  ),
)
console.log(JSON.stringify(summary, null, 2))
cdp.close()
