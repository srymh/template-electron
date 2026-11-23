// 列の DnD の途中・取り消し後・確定後に、見出しと本文の先頭行のセルの並びと幅を記録する。
// `名前`（初期幅は既定の 150 px）を `レベル`（120 px）の後ろへ動かす（レベルの右寄り 3/4 の位置で離す）。生成データの /demo/table、全能力、件数は10行。
// usage: node dnd-widths.mjs <out.json>
import fs from 'node:fs'

import { connect, sleep, waitForExpression } from './cdp-client.mjs'

const [outFile] = process.argv.slice(2)
const label = outFile.replace(/^.*\//, '').replace(/\.json$/, '')
const cdp = await connect({ port: 9222, urlPrefix: 'http://localhost:5173' })
await cdp.send('Page.bringToFront').catch(() => {})
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})

// 見出しは並べ替えボタンの名前、本文はセルの位置で表し、幅を px で返す
const snapshot = `(() => {
  const w = (el) => Math.round(el.getBoundingClientRect().width * 10) / 10
  const headers = [...document.querySelectorAll('thead th')].map((th) => {
    const name = th.querySelector('button[aria-label$="の列を並べ替える"]')?.getAttribute('aria-label')?.replace('の列を並べ替える', '') ?? th.textContent.trim()
    return [name, w(th), th.dataset.dndPlaceholder ?? null]
  })
  const body = [...document.querySelector('tbody tr').cells].map((td) => [td.textContent.slice(0, 8), w(td)])
  return { headers, body }
})()`

async function drag(finish) {
  await cdp.evaluate(`location.hash = '#/demo/table'; location.reload(); true`).catch(() => {})
  await sleep(500)
  await waitForExpression(cdp, `!!document.querySelector('tbody tr')`)
  await sleep(800)
  const p = await cdp.evaluate(
    `(() => { const a = document.querySelector('button[aria-label="名前の列を並べ替える"]').getBoundingClientRect(), b = document.querySelector('button[aria-label="レベルの列を並べ替える"]').getBoundingClientRect(); return { x: a.x + a.width / 2, y: a.y + a.height / 2, to: b.x + (b.width * 3) / 4 } })()`,
  )
  const before = await cdp.evaluate(snapshot)
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
  const during = await cdp.evaluate(snapshot)
  if (finish === 'cancel') {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    })
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    })
    await sleep(200)
  }
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.to,
    y: p.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await sleep(800)
  const after = await cdp.evaluate(snapshot)
  return { before, during, after }
}

const result = { drop: await drag('drop'), cancel: await drag('cancel') }
fs.writeFileSync(outFile, JSON.stringify(result, null, 2))
for (const [kind, r] of Object.entries(result)) {
  for (const phase of ['before', 'during', 'after']) {
    console.log(
      label,
      kind.padEnd(6),
      phase.padEnd(6),
      'headers',
      JSON.stringify(
        r[phase].headers.slice(0, 5).map(([n, w, ph]) => `${n}:${w}${ph ? '(' + ph + ')' : ''}`),
      ),
      'body',
      JSON.stringify(r[phase].body.slice(0, 5).map(([, w]) => w)),
    )
  }
}
await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
cdp.close()
