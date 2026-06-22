import fs from 'node:fs'
import util from 'node:util'

export class Logger implements Disposable {
  private ws: fs.WriteStream

  constructor(
    path: string,
    private isDebugMode: boolean,
  ) {
    const ws = fs.createWriteStream(path, { flags: 'a' })
    ws.on('open', () => {
      this.info('-----------------------------------------------------------------------------')
      this.info(new Date().toLocaleString())
      this.info('                                                               |\\__/,|   (`\\')
      this.info('                                                             _.|o o  |_   ) )')
      this.info('------------------------------------------------------------(((---(((--------')
      this.info(`[Logger] open ${path}`)
    })
    this.ws = ws
  }

  info(...args: any[]) {
    const message = util.format('[INFO]', ...args)
    this.ws.write(message + '\n')
    console.log(...args)
  }

  warn(...args: any[]) {
    const message = util.format('[WARN]', ...args)
    this.ws.write(message + '\n')
    console.warn(...args)
  }

  error(...args: any[]) {
    const message = util.format('[ERROR]', ...args)
    this.ws.write(message + '\n')
    console.error(...args)
  }

  debug(...args: any[]) {
    if (!this.isDebugMode) return
    const message = util.format('[DEBUG]', ...args)
    this.ws.write(message + '\n')
    console.debug(...args)
  }

  dispose() {
    // すでにdestroyされている場合は何もしない
    if (!this.ws.destroyed) {
      this.info(`[Logger] close ${this.ws.path}`)
      this.ws.end()
    }
  }

  [Symbol.dispose]() {
    this.dispose()
  }
}
