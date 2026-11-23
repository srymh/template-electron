// Phase 4 の画面確認。列の並べ替え（キーボード・ポインター、中央・先頭側固定の領域、領域をまたぐ移動の抑止）と、
// 並べ替えた後の矢印キーでのセル移動を確かめる。生成データの /demo/table、全能力、10行。
// usage: node dnd-check.mjs <out.json>
import fs from 'node:fs'

import { connect, sleep, waitForExpression } from './cdp-client.mjs'

const [outFile] = process.argv.slice(2)
const cdp = await connect({ port: 9222, urlPrefix: 'http://localhost:5173' })
await cdp.send('Page.bringToFront').catch(() => {})
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
})

const headersExpr = `[...document.querySelector('thead tr').cells].map((th) => th.querySelector('button[aria-label$="の列を並べ替える"]')?.getAttribute('aria-label')?.replace('の列を並べ替える', '') ?? (th.textContent.trim() || '-'))`
const pinnedExpr = `[...document.querySelector('thead tr').cells].map((th) => th.dataset.isPinned ?? '')`
const focusedHeaderExpr = `(() => { const td = document.querySelector('td[data-selected-state=focused]'); if (!td) return null; const th = document.querySelector('thead tr').cells[td.cellIndex]; return th.querySelector('button[aria-label$="の列を並べ替える"]')?.getAttribute('aria-label')?.replace('の列を並べ替える', '') ?? th.textContent.trim() })()`
const center = (selector) =>
  cdp.evaluate(
    `(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`,
  )

async function reload() {
  await cdp.evaluate(`location.hash = '#/demo/table'; location.reload(); true`).catch(() => {})
  await sleep(500)
  await waitForExpression(cdp, `!!document.querySelector('tbody tr')`)
  await sleep(800)
}
async function key(keyName, code, keyCode, modifiers = 0) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: keyName,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  })
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: keyName,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  })
  await sleep(150)
}
async function click(selector) {
  const p = await center(selector)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y })
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: p.x,
    y: p.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.x,
    y: p.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await sleep(200)
}
// 移動先の列の中央を越えると、その列の向こう側に入る。移動の向きの奥側 1/4 の位置で離す
async function pointerDrag(fromName, toName) {
  const a = await center(`button[aria-label="${fromName}の列を並べ替える"]`)
  const target = await cdp.evaluate(
    `(() => { const r = document.querySelector('button[aria-label="${toName}の列を並べ替える"]').getBoundingClientRect(); return { x: r.x + r.width / 2, width: r.width } })()`,
  )
  const b = { x: target.x + (Math.sign(target.x - a.x) * target.width) / 4 }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y })
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: a.x,
    y: a.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await sleep(250)
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: a.x + ((b.x - a.x) * i) / 5,
      y: a.y,
      button: 'left',
      buttons: 1,
    })
    await sleep(120)
  }
  await sleep(300)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: b.x,
    y: a.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await sleep(800)
}
// 先頭行で、指定した列の見出しの位置にある本文のセルをクリックする
async function clickBodyCellOf(name) {
  const index = await cdp.evaluate(`${headersExpr}.indexOf(${JSON.stringify(name)})`)
  await cdp.evaluate(
    `(() => { document.querySelector('tbody tr').cells[${index}].setAttribute('data-check-target', ''); return true })()`,
  )
  await click('td[data-check-target]')
  await cdp.evaluate(
    `(() => { document.querySelector('td[data-check-target]')?.removeAttribute('data-check-target'); return true })()`,
  )
}

const results = {}

// 1. キーボードで中央の列を並べ替え、確定・取り消し
await reload()
results.keyboardBefore = await cdp.evaluate(headersExpr)
await cdp.evaluate(
  `(() => { document.querySelector('button[aria-label="名前の列を並べ替える"]').focus(); return true })()`,
)
await key(' ', 'Space', 32)
await key('ArrowRight', 'ArrowRight', 39)
await key('ArrowRight', 'ArrowRight', 39)
await key(' ', 'Space', 32)
await sleep(800)
results.keyboardDrop = await cdp.evaluate(headersExpr)
// 並べ替えた後の矢印キー: 名前のセルから左へ移ると、新しい並びで左隣の列へ移る
await clickBodyCellOf('名前')
await key('ArrowLeft', 'ArrowLeft', 37)
results.arrowAfterKeyboardDrop = await cdp.evaluate(focusedHeaderExpr)
await key('ArrowRight', 'ArrowRight', 39, 8) // Shift
results.shiftArrowAfterKeyboardDrop = await cdp.evaluate(
  `[...document.querySelectorAll('td[data-selected-state]')].length`,
)

await reload()
await cdp.evaluate(
  `(() => { document.querySelector('button[aria-label="名前の列を並べ替える"]').focus(); return true })()`,
)
await key(' ', 'Space', 32)
await key('ArrowRight', 'ArrowRight', 39)
await key('Escape', 'Escape', 27)
await sleep(800)
results.keyboardCancel = await cdp.evaluate(headersExpr)

// 2. ポインターで中央の列を並べ替え、矢印キー
await reload()
await pointerDrag('名前', 'レベル')
results.pointerDrop = await cdp.evaluate(headersExpr)
await clickBodyCellOf('名前')
await key('ArrowLeft', 'ArrowLeft', 37)
results.arrowAfterPointerDrop = await cdp.evaluate(focusedHeaderExpr)

// 3. 先頭側の固定領域の中での並べ替えと、領域をまたぐ移動の抑止
await reload()
await click('button[aria-label="テーブルの設定"]')
await cdp.evaluate(
  `(() => { const input = [...document.querySelectorAll('[role=dialog] input')].find((i) => i.getAttribute('aria-label') === '見出しに固定ボタンを表示する'); if (!input.checked) input.click(); return true })()`,
)
await key('Escape', 'Escape', 27)
await click('button[aria-label="名前の列を先頭に固定"]')
await click('button[aria-label="種類の列を先頭に固定"]')
results.pinnedBefore = {
  headers: await cdp.evaluate(headersExpr),
  pinned: await cdp.evaluate(pinnedExpr),
}
await pointerDrag('種類', '名前')
results.pinnedReorder = {
  headers: await cdp.evaluate(headersExpr),
  pinned: await cdp.evaluate(pinnedExpr),
}
await pointerDrag('レベル', '名前')
results.crossRegion = {
  headers: await cdp.evaluate(headersExpr),
  pinned: await cdp.evaluate(pinnedExpr),
}
await clickBodyCellOf('種類')
await key('ArrowRight', 'ArrowRight', 39)
results.arrowAfterPinnedReorder = await cdp.evaluate(focusedHeaderExpr)

fs.writeFileSync(outFile, JSON.stringify(results, null, 2))
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(28), JSON.stringify(v))
await cdp.evaluate(`location.reload(); true`).catch(() => {})
await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {})
cdp.close()
