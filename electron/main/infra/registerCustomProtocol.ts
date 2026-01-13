import { protocol } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

export function registerCustomProtocol() {
  protocol.handle('app', async (request) => {
    const url = decodeURI(request.url.replace(/^app:\/\//, ''))
    let filePath = path.win32.normalize(url)
    if (filePath.startsWith('\\')) {
      filePath = filePath.slice(1) // \C:\path\to\file => C:\path\to\file
    }
    console.log({ input: url, filePath })
    const buffer = await fs.readFile(filePath)
    // BufferをUint8Arrayに変換してResponseに渡す
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  })
}
