import fs from 'node:fs/promises'

import { protocol } from 'electron'

import { resolveAppProtocolFilePath } from './appProtocolPath'

export function registerCustomProtocol() {
  protocol.handle('app', async (request) => {
    const filePath = resolveAppProtocolFilePath(request.url)
    const buffer = await fs.readFile(filePath)
    // BufferをUint8Arrayに変換してResponseに渡す
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  })
}
