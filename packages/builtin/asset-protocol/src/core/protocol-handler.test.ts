import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleAppAssetProtocol } from './protocol-handler'
import { createAppAssetRootRegistry } from './root-registry'
import type { AppAssetRootRegistry } from './root-registry'

describe('handleAppAssetProtocol', () => {
  let immutableRoot: string
  let demoRoot: string
  let registry: AppAssetRootRegistry

  beforeEach(async () => {
    immutableRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'app-asset-protocol-'))
    demoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'app-asset-protocol-demo-'))
    await fs.mkdir(path.join(immutableRoot, 'ab'), { recursive: true })
    await fs.writeFile(path.join(immutableRoot, 'ab', 'abcdef.png'), new Uint8Array([1, 2, 3]))
    await fs.mkdir(path.join(demoRoot, 'images'), { recursive: true })
    await fs.writeFile(path.join(demoRoot, 'images', 'sample.png'), new Uint8Array([4, 5, 6]))
    await fs.writeFile(path.join(immutableRoot, 'abcdef'), new Uint8Array([7, 8]))

    registry = createAppAssetRootRegistry([
      {
        id: 'immutable',
        basePath: immutableRoot,
        resolution: 'directory',
        immutable: true,
      },
      {
        id: 'demo',
        basePath: demoRoot,
        resolution: 'directory',
      },
      {
        id: 'provider',
        basePath: immutableRoot,
        resolution: 'provider',
        immutable: true,
        resolveFile: (relativePath) =>
          relativePath === 'assets/1'
            ? { filePath: path.join(immutableRoot, 'abcdef'), mediaType: 'audio/ogg' }
            : null,
      },
    ])
  })

  afterEach(async () => {
    await fs.rm(immutableRoot, { recursive: true, force: true })
    await fs.rm(demoRoot, { recursive: true, force: true })
  })

  it('serves files from an immutable root', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://immutable/ab/abcdef.png'),
      registry,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('serves files from mutable roots', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://demo/images/sample.png?token=ignored'),
      registry,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]))
  })

  it('supports HEAD requests without a response body', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://immutable/ab/abcdef.png', { method: 'HEAD' }),
      registry,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect((await response.text()).length).toBe(0)
  })

  it('streams a single byte range', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://immutable/ab/abcdef.png', {
        headers: { Range: 'bytes=1-2' },
      }),
      registry,
    )

    expect(response.status).toBe(206)
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Range')).toBe('bytes 1-2/3')
    expect(response.headers.get('Content-Length')).toBe('2')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([2, 3]))
  })

  it('streams a byte range from a provider without a file path', async () => {
    const requestedRanges: Array<{ offset: number; length: number }> = []
    registry.register({
      id: 'stream-provider',
      resolution: 'stream',
      resolveStream: (relativePath, searchParams) =>
        relativePath === 'asset' && searchParams.getAll('token').join(',') === 'a+b,c'
          ? {
              byteSize: 4,
              mediaType: 'audio/ogg',
              read: async (range) => {
                requestedRanges.push(range)
                return (async function* () {
                  yield new Uint8Array([1, 2, 3, 4]).subarray(
                    range.offset,
                    range.offset + range.length,
                  )
                })()
              },
            }
          : null,
    })

    const head = await handleAppAssetProtocol(
      new Request('app-asset://stream-provider/asset?token=a%2Bb&token=c', { method: 'HEAD' }),
      registry,
    )
    expect(head.status).toBe(200)
    expect(requestedRanges).toEqual([])

    const response = await handleAppAssetProtocol(
      new Request('app-asset://stream-provider/asset?token=a%2Bb&token=c', {
        headers: { Range: 'bytes=1-2' },
      }),
      registry,
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4')
    expect(response.headers.get('Content-Type')).toBe('audio/ogg')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([2, 3]))
    expect(requestedRanges).toEqual([{ offset: 1, length: 2 }])
  })

  it('uses the media type returned by a provider for extensionless objects', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://provider/assets/1?media-type=text%2Fhtml'),
      registry,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/ogg')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('providerにもデコード済みクエリと重複値を渡し、対象の選択を委譲する', async () => {
    registry.register({
      id: 'query-provider',
      basePath: immutableRoot,
      resolution: 'provider',
      resolveFile: (relativePath, searchParams) =>
        relativePath === 'asset' && searchParams.getAll('token').join(',') === 'a+b,日本語'
          ? { filePath: path.join(immutableRoot, 'abcdef') }
          : null,
    })
    for (const method of ['GET', 'HEAD']) {
      const response = await handleAppAssetProtocol(
        new Request(
          'app-asset://query-provider/asset?token=a%2Bb&token=%E6%97%A5%E6%9C%AC%E8%AA%9E',
          { method },
        ),
        registry,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Length')).toBe('2')
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        new Uint8Array(method === 'HEAD' ? [] : [7, 8]),
      )
    }
    expect(
      (await handleAppAssetProtocol(new Request('app-asset://query-provider/asset'), registry))
        .status,
    ).toBe(404)
  })

  it('does not expose files rejected by a provider', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://provider/sha256/abcdef'),
      registry,
    )

    expect(response.status).toBe(404)
  })

  it('reports provider failures as internal server errors', async () => {
    const providerError = new Error('provider failed')
    const reportedErrors: Array<{ error: unknown; rootId: string; relativePath: string }> = []
    registry.register({
      id: 'failing-provider',
      basePath: immutableRoot,
      resolution: 'provider',
      resolveFile: () => {
        throw providerError
      },
    })

    const response = await handleAppAssetProtocol(
      new Request('app-asset://failing-provider/assets/1'),
      registry,
      {
        onInternalError: (error, context) => {
          reportedErrors.push({ error, rootId: context.rootId, relativePath: context.relativePath })
        },
      },
    )

    expect(response.status).toBe(500)
    expect(reportedErrors).toEqual([
      { error: providerError, rootId: 'failing-provider', relativePath: 'assets/1' },
    ])
  })

  it('does not serve a provider result outside its registered root', async () => {
    registry.register({
      id: 'provider-escape',
      basePath: immutableRoot,
      resolution: 'provider',
      resolveFile: () => ({
        filePath: path.join(demoRoot, 'images', 'sample.png'),
        mediaType: 'image/png',
      }),
    })

    const response = await handleAppAssetProtocol(
      new Request('app-asset://provider-escape/assets/1'),
      registry,
    )

    expect(response.status).toBe(404)
  })

  it('rejects unsatisfiable ranges', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://immutable/ab/abcdef.png', {
        headers: { Range: 'bytes=10-20' },
      }),
      registry,
    )

    expect(response.status).toBe(416)
    expect(response.headers.get('Content-Range')).toBe('bytes */3')
  })

  it('rejects unsupported methods', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://cas/ab/abcdef.png', { method: 'POST' }),
      registry,
    )

    expect(response.status).toBe(405)
  })

  it('returns 404 when the file is outside the allowed URL space', async () => {
    const response = await handleAppAssetProtocol(
      new Request('app-asset://unknown/abcdef.png'),
      registry,
    )

    expect(response.status).toBe(404)
  })
})
