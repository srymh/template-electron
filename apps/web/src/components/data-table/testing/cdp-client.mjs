// Chrome DevTools Protocol の最小クライアント。Node 22 以降の組み込み WebSocket と fetch だけを使う。
// 開発起動中の Electron renderer（--remote-debugging-port で開いたポート）へ接続する。

/**
 * 指定ポートの page target のうち、URL が prefix で始まるものへ接続する。
 * 起動直後は target がまだないことが多いので、見つかるまで1秒ごとに再試行する。
 * @param {{ port: number | string, urlPrefix: string, timeoutMs?: number }} options
 */
export async function connect({ port, urlPrefix, timeoutMs = 120_000 }) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = targets.find((t) => t.type === 'page' && t.url.startsWith(urlPrefix))
      if (page) return openSocket(page.webSocketDebuggerUrl)
    } catch (error) {
      lastError = error
    }
    await sleep(1000)
  }
  throw new Error(`page target not found: ${urlPrefix} (port ${port}) ${lastError ?? ''}`)
}

function openSocket(url) {
  const ws = new WebSocket(url)
  let nextId = 1
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    } else if (message.method) {
      for (const listener of listeners) listener(message)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  /** ページ内で式を評価し、Promise なら待って、結果を値として返す。 */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
      throw new Error(`page evaluate failed: ${detail}`)
    }
    return result.result.value
  }
  return new Promise((resolve, reject) => {
    ws.onerror = (event) => reject(new Error(`websocket error: ${event.message ?? event.type}`))
    ws.onopen = () =>
      resolve({ send, evaluate, on: (fn) => listeners.add(fn), close: () => ws.close() })
  })
}

/**
 * 再読み込みなどの後、条件式が true になるまで待つ。評価に失敗（読み込み途中）しても待ち続ける。
 * @param {{ evaluate: (expression: string) => Promise<unknown> }} cdp
 */
export async function waitForExpression(
  cdp,
  expression,
  { timeoutMs = 60_000, intervalMs = 200 } = {},
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression).catch(() => false)) return
    await sleep(intervalMs)
  }
  throw new Error(`timeout waiting for: ${expression}`)
}

/**
 * URL が prefix で始まる要求の数・所要時間を Network イベントから集める。
 * custom protocol でも requestWillBeSent / loadingFinished は届くが、encodedDataLength は 0 になるので転送量は数えない。
 * @returns 区間ごとに要約できる記録。mark() で区切り、summarizeSince(mark) で区間の要約を得る
 */
export async function trackRequests(cdp, urlPrefix) {
  const starts = new Map()
  const finished = []
  let failed = 0
  cdp.on((m) => {
    if (m.method === 'Network.requestWillBeSent' && m.params.request.url.startsWith(urlPrefix)) {
      starts.set(m.params.requestId, { t: m.params.timestamp, url: m.params.request.url })
    } else if (m.method === 'Network.loadingFinished' && starts.has(m.params.requestId)) {
      const s = starts.get(m.params.requestId)
      finished.push({
        url: s.url,
        start: s.t,
        end: m.params.timestamp,
        ms: (m.params.timestamp - s.t) * 1000,
      })
    } else if (m.method === 'Network.loadingFailed' && starts.has(m.params.requestId)) {
      failed += 1
    }
  })
  await cdp.send('Network.enable')
  return {
    mark: () => ({ finished: finished.length, failed }),
    summarizeSince: (mark) => {
      const requests = finished.slice(mark.finished)
      const ms = requests.map((r) => r.ms).sort((a, b) => a - b)
      return {
        count: requests.length,
        failed: failed - mark.failed,
        medianMs: ms.length ? round(ms[Math.floor(ms.length / 2)]) : null,
        maxMs: ms.length ? round(ms.at(-1)) : null,
        // 0 ms 近い要求はメモリキャッシュなどから返ったとみなせる
        nearZero: ms.filter((v) => v < 1).length,
        spanMs: requests.length
          ? round(
              (Math.max(...requests.map((r) => r.end)) -
                Math.min(...requests.map((r) => r.start))) *
                1000,
            )
          : null,
      }
    },
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const round = (v) => Math.round(v * 10) / 10
