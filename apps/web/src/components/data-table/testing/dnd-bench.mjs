// 列の DnD を離した後の描画待ちを測る（Phase 4）。`名前`（150 px）を `レベル`（120 px）の後ろへ動かす。
// 主指標 firstFrame: pointerup（capture）から、本文の先頭行で `名前` のセルが移動先へ来た後の rAF 後の MessageChannel タスクまで。
// 完了は本文の並びで判定する（見出しの並びが先に変わる実装でも同じ判定で比べられる）。lastMutation は最後の DOM 変更まで（後処理を含む別指標）。
// usage: node dnd-bench.mjs <out.json> [runs] [devtoolsHidden=true|false] [pageSizes=10,100,Infinity] [--profile <out.cpuprofile>]
import fs from 'node:fs'

import { connect, sleep, waitForExpression } from './cdp-client.mjs'

const args = process.argv.slice(2)
const profileIndex = args.indexOf('--profile')
const profileFile = profileIndex >= 0 ? args.splice(profileIndex, 2)[1] : null
const [outFile, runsArg = '5', hideDevtoolsArg = 'true', pageSizesArg = '10,100,Infinity'] = args
const runs = Number(runsArg)
const pageSizes = pageSizesArg.split(',')

const cdp = await connect({ port: 9222, urlPrefix: 'http://localhost:5173' })
await cdp.send('Page.enable')
await cdp.send('Page.bringToFront').catch(() => {})
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})
const versions = await cdp
  .evaluate(`JSON.stringify({ userAgent: navigator.userAgent })`)
  .then(JSON.parse)
const originalDevtools = await cdp.evaluate(`localStorage.getItem('vite-ui-devtools')`)

const results = []
try {
  await cdp.evaluate(
    hideDevtoolsArg === 'true'
      ? `localStorage.setItem('vite-ui-devtools', 'true'); true`
      : `localStorage.removeItem('vite-ui-devtools'); true`,
  )
  for (const pageSize of pageSizes) {
    for (let run = 0; run < runs; run++) {
      await cdp.evaluate(`location.hash = '#/demo/table'; location.reload(); true`).catch(() => {})
      await sleep(500)
      await waitForExpression(cdp, `!!document.querySelector('tbody tr')`)
      await sleep(800)
      await cdp.evaluate(
        `(() => { const s = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === 'すべて')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(pageSize)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`,
      )
      await sleep(800)
      const p = await cdp.evaluate(
        `(() => { const a = document.querySelector('button[aria-label="名前の列を並べ替える"]').getBoundingClientRect(), b = document.querySelector('button[aria-label="レベルの列を並べ替える"]').getBoundingClientRect(); return { x: a.x + a.width / 2, y: a.y + a.height / 2, to: b.x + (b.width * 3) / 4, rows: document.querySelectorAll('tbody tr').length } })()`,
      )
      // 本文の先頭行で `名前`（「行-」で始まる）のセルの位置
      const nameIndexExpr = `[...document.querySelector('tbody tr').cells].findIndex((td) => td.textContent.startsWith('行-'))`
      const beforeIndex = await cdp.evaluate(nameIndexExpr)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y })
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: p.x,
        y: p.y,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      })
      await sleep(250)
      for (let i = 1; i <= 5; i++) {
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: p.x + ((p.to - p.x) * i) / 5,
          y: p.y,
          button: 'left',
          buttons: 1,
        })
        await sleep(120)
      }
      await sleep(300)
      // 確定後の `名前` の位置を求め、完了の判定を仕掛ける。`名前` は `レベル` より左にあり、
      // `レベル` の後ろへ入るため、移動後はいまの `レベル` の位置になる（ドラッグ中に見出しは動かない）
      await cdp.evaluate(`(() => {
        const headers = [...document.querySelector('thead tr').cells]
        const expected = headers.findIndex((th) => th.querySelector('button[aria-label="レベルの列を並べ替える"]'))
        const state = (window.__dnd = { expected, mutations: 0 })
        const done = () => [...document.querySelector('tbody tr').cells].findIndex((td) => td.textContent.startsWith('行-')) === expected
        let pending = false
        state.observer = new MutationObserver((records) => {
          state.mutations += records.length
          state.lastMutation = performance.now()
          if (state.reflectedAt || pending) return
          // 判定は1タスクにまとめ、DOM 変更ごとに読まない
          pending = true
          queueMicrotask(() => {
            pending = false
            if (state.reflectedAt || !done()) return
            state.reflectedAt = performance.now()
            requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => { state.firstFrameAt = performance.now(); c.port1.close() }; c.port2.postMessage(0) })
          })
        })
        state.observer.observe(document.querySelector('table'), { subtree: true, childList: true, attributes: true, characterData: true })
        // DnD のライブラリの pointerup の処理が先に動き、その中で描画まで終わることがあるため、
        // 開始はリスナーが動いた時刻でなく、イベントが作られた時刻（performance.now() と同じ基準）にする
        document.addEventListener('pointerup', (event) => { state.start = event.timeStamp; state.listenerAt = performance.now() }, { once: true, capture: true })
        return true
      })()`)
      const profiling = profileFile && pageSize === pageSizes.at(-1) && run === runs - 1
      if (profiling) {
        await cdp.send('Profiler.enable')
        await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
        await cdp.send('Profiler.start')
      }
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: p.to,
        y: p.y,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      })
      await waitForExpression(cdp, `!!window.__dnd.firstFrameAt`, {
        timeoutMs: 20000,
        intervalMs: 50,
      })
      if (profiling) {
        const { profile } = await cdp.send('Profiler.stop')
        fs.writeFileSync(profileFile, JSON.stringify(profile))
      }
      await sleep(1000)
      const r = await cdp.evaluate(
        `(() => { const s = window.__dnd; s.observer.disconnect(); const names = [...document.querySelector('thead tr').cells].map((th) => th.querySelector('button[aria-label$="の列を並べ替える"]')?.getAttribute('aria-label')?.replace('の列を並べ替える', '') ?? '-'); return { expected: s.expected, reflectedMs: s.reflectedAt - s.start, listenerDelayMs: s.listenerAt - s.start, firstFrameMs: s.firstFrameAt - s.start, lastMutationMs: s.lastMutation - s.start, mutations: s.mutations, headers: names, nameIndexAfter: ${nameIndexExpr} } })()`,
      )
      const out = { pageSize, rows: p.rows, beforeIndex, ...r }
      console.log(
        JSON.stringify({
          pageSize,
          firstFrameMs: Math.round(out.firstFrameMs * 10) / 10,
          listenerDelayMs: Math.round(out.listenerDelayMs * 10) / 10,
          lastMutationMs: Math.round(out.lastMutationMs * 10) / 10,
          moved: out.beforeIndex !== out.nameIndexAfter && out.nameIndexAfter === out.expected,
        }),
      )
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

const summary = {}
for (const pageSize of pageSizes) {
  const group = results.filter((r) => r.pageSize === pageSize)
  const stat = (key) => {
    const v = group.map((r) => r[key]).sort((a, b) => a - b)
    return `${v[Math.floor(v.length / 2)].toFixed(1)} (${v[0].toFixed(1)}-${v.at(-1).toFixed(1)})`
  }
  summary[pageSize] = {
    rows: group[0]?.rows,
    firstFrameMs: stat('firstFrameMs'),
    reflectedMs: stat('reflectedMs'),
    lastMutationMs: stat('lastMutationMs'),
    allMoved: group.every(
      (r) => r.nameIndexAfter === r.expected && r.beforeIndex !== r.nameIndexAfter,
    ),
  }
}
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      hideDevtools: hideDevtoolsArg,
      versions,
      results,
      summary,
    },
    null,
    2,
  ),
)
console.log(JSON.stringify(summary, null, 2))
cdp.close()
