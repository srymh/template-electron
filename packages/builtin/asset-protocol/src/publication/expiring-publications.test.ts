import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, it, vi } from 'vitest'

import { handleAppAssetProtocol } from '../core/protocol-handler'
import { createAppAssetRootRegistry } from '../core/root-registry'
import { createExpiringAppAssetPublications } from './expiring-publications'

it('期限付き公開でクエリを生成・転送し、期限後はresolverを呼ばない', async () => {
  const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'app-asset-publication-'))
  const roots = createAppAssetRootRegistry([])
  let now = 100
  const publications = createExpiringAppAssetPublications({
    roots,
    rootIdPrefix: 'preview-',
    createId: () => 'test',
    now: () => now,
  })
  try {
    const filePath = path.join(basePath, 'image.bin')
    await fs.writeFile(filePath, new Uint8Array([1, 2]))
    const resolveFile = vi.fn((relativePath: string, searchParams: URLSearchParams) =>
      relativePath === 'image' && searchParams.get('token') === 'a+b /日本語' ? { filePath } : null,
    )
    const publication = publications.publish({ basePath, expiresAt: 200, resolveFile })
    const url = publication.createUrl('image', { token: 'a+b /日本語' })
    expect(new URL(url).searchParams.get('token')).toBe('a+b /日本語')
    const response = await handleAppAssetProtocol(new Request(url), roots)
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
    expect(
      (await handleAppAssetProtocol(new Request(publication.createUrl('image')), roots)).status,
    ).toBe(404)
    expect(resolveFile).toHaveBeenCalledTimes(2)
    now = 200
    expect((await handleAppAssetProtocol(new Request(url), roots)).status).toBe(404)
    expect(resolveFile).toHaveBeenCalledTimes(2)
  } finally {
    publications.dispose()
    await fs.rm(basePath, { recursive: true, force: true })
  }
})
