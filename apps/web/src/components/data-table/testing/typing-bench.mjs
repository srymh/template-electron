// /demo/table の一覧検索・列フィルターの入力（反映を待つ間の1文字ごと）の描画時間を測る。
// 対象ごとに絞り込みを解除し、300行を表示した状態から測る。
// usage: node typing-bench.mjs <out.json> [runs] [devtoolsHidden=true|false]
import fs from 'node:fs'

import { connect, round, sleep, waitForExpression } from './cdp-client.mjs'

const [outFile, runsArg = '5', hideDevtoolsArg = 'true'] = process.argv.slice(2)
const runs = Number(runsArg)
const keystrokes = 8
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

// ページ内のヘルパー。入力を dispatch し、同期描画の完了（タスク）と次のフレームまでを測る。
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
  type(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  },
  setSelect(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  },
  pageSizeSelect: () => [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === 'すべて')),
  search: () => document.querySelector('input[aria-label="一覧を検索"]'),
  // 生成データで値が文字列の列（名前）のフィルター入力欄
  columnText: () => [...document.querySelectorAll('input[aria-label$="を含む"]')][0],
}
true`

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const samples = { search: { task: [], frame: [] }, columnText: { task: [], frame: [] } }
// 各対象の計測前の行数。すべて300行であることを結果に残す
const rowCounts = []
try {
  await cdp.evaluate(
    hideDevtoolsArg === 'true'
      ? `localStorage.setItem('vite-ui-devtools', 'true'); true`
      : `localStorage.removeItem('vite-ui-devtools'); true`,
  )
  for (let run = 0; run < runs; run += 1) {
    await cdp.evaluate(`location.hash = '#/demo/table'; location.reload(); true`).catch(() => {})
    await sleep(500)
    await waitForExpression(cdp, `!!document.querySelector('table tbody tr')`)
    await sleep(1000)
    await cdp.evaluate(helpers)
    // 300行を1ページに表示し、列フィルターを見出しに出す
    await cdp.evaluate(`__tb.setSelect(__tb.pageSizeSelect(), 'Infinity'); true`)
    await sleep(500)
    await cdp.evaluate(`document.querySelector('button[aria-label="列フィルター"]').click(); true`)
    await sleep(500)
    for (const target of ['search', 'columnText']) {
      // 前の対象の入力で絞り込まれた一覧を解除し、300行を表示した状態から測る
      await cdp.evaluate(
        `document.querySelector('button[aria-label="絞り込みを解除"]')?.click(); true`,
      )
      await sleep(300)
      const rowCount = await cdp.evaluate(`document.querySelector('table tbody').rows.length`)
      if (rowCount !== 300) throw new Error(`${target} の計測前の行数が300ではない: ${rowCount}`)
      rowCounts.push({ run, target, rowCount })
      // 反映を待つ間（200ms・500ms 未満）の入力だけを測るため、1文字ごとに短く待つ
      for (let index = 1; index <= keystrokes; index += 1) {
        const text = 'あいうえおかきくけこ'.slice(0, index)
        const result = await cdp.evaluate(
          `__tb.measure(() => __tb.type(__tb.${target}(), ${JSON.stringify(text)}))`,
        )
        samples[target].task.push(result.task)
        samples[target].frame.push(result.frame)
        await sleep(30)
      }
      // 反映を待つ間に一覧が絞り込まれていない（300行のまま測った）ことを確かめる
      const rowCountAfterTyping = await cdp.evaluate(
        `document.querySelector('table tbody').rows.length`,
      )
      if (rowCountAfterTyping !== 300) {
        throw new Error(`${target} の入力中に行数が変わった: ${rowCountAfterTyping}`)
      }
      // 次の対象の前に、待機中の入力を反映させて落ち着かせる
      await sleep(800)
    }
  }
} finally {
  if (originalDevtools === null) {
    await cdp.evaluate(`localStorage.removeItem('vite-ui-devtools'); true`)
  } else {
    await cdp.evaluate(
      `localStorage.setItem('vite-ui-devtools', ${JSON.stringify(originalDevtools)}); true`,
    )
  }
  cdp.close()
}

const summary = Object.fromEntries(
  Object.entries(samples).map(([target, { task, frame }]) => [
    target,
    { task: round(median(task)), frame: round(median(frame)), samples: task.length },
  ]),
)
fs.writeFileSync(
  outFile,
  JSON.stringify({ runs, keystrokes, summary, rowCounts, samples }, null, 2),
)
console.log(JSON.stringify(summary, null, 2))
