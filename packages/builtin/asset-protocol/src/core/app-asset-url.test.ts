import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createAppAssetUrl,
  createAppAssetUrlFromFilePath,
  resolveAppAssetProtocolFilePath,
  resolveAppAssetProtocolTarget,
} from './app-asset-url'
import { createAppAssetRootRegistry } from './root-registry'

describe('createAppAssetUrl', () => {
  it('パスの区切りを保持し、キーとクエリをそれぞれ一度だけエンコードする', () => {
    const registry = createAppAssetRootRegistry([
      { id: 'demo', resolution: 'stream', resolveStream: () => null },
    ])
    const relativePath = 'objects/画像/a ?#%/literal%2F/%2E%2E'
    const url = createAppAssetUrl({
      rootId: 'demo',
      relativePath,
      searchParams: { token: 'a /?#+%日本語' },
    })
    expect(new URL(url).pathname).toBe(
      '/objects/%E7%94%BB%E5%83%8F/a%20%3F%23%25/literal%252F/%252E%252E',
    )
    const target = resolveAppAssetProtocolTarget(url, registry)
    expect(target.relativePath).toBe(relativePath)
    expect(target.searchParams.get('token')).toBe('a /?#+%日本語')
  })

  it('creates app-asset URLs for arbitrary registered roots', () => {
    expect(
      createAppAssetUrl({
        rootId: 'demo',
        relativePath: 'images/sample image.png',
      }),
    ).toBe('app-asset://demo/images/sample%20image.png')
  })

  it('rejects traversal segments', () => {
    expect(() =>
      createAppAssetUrl({
        rootId: 'demo',
        relativePath: '../sample.png',
      }),
    ).toThrow('Asset path contains traversal segment')
  })
})

describe('createAppAssetUrlFromFilePath', () => {
  const demoRoot = path.resolve('/Users/alice/Pictures/demo')
  const registry = createAppAssetRootRegistry([
    {
      id: 'demo',
      basePath: demoRoot,
      resolution: 'directory',
    },
  ])

  it('assigns a resolver to directory roots at registration', () => {
    const root = registry.getOrThrow('demo')
    expect(root.resolution).toBe('directory')
    if (root.resolution !== 'directory') throw new Error('directory root expected')
    expect(root.resolveFile('images/sample.png', new URLSearchParams())).toEqual({
      filePath: path.join(demoRoot, 'images', 'sample.png'),
    })
  })

  it('creates URLs from absolute file paths inside a registered root', () => {
    expect(
      createAppAssetUrlFromFilePath(
        {
          rootId: 'demo',
          filePath: path.join(demoRoot, 'images', 'sample image.png'),
        },
        registry,
      ),
    ).toBe('app-asset://demo/images/sample%20image.png')
  })

  it('rejects file paths outside the requested root', () => {
    expect(() =>
      createAppAssetUrlFromFilePath(
        {
          rootId: 'demo',
          filePath: path.resolve('/Users/alice/Pictures/other/sample.png'),
        },
        registry,
      ),
    ).toThrow('Asset file path escapes root')
  })

  it('rejects relative file paths', () => {
    expect(() =>
      createAppAssetUrlFromFilePath(
        {
          rootId: 'demo',
          filePath: 'images/sample.png',
        },
        registry,
      ),
    ).toThrow('Asset file path must be absolute')
  })

  it('does not bypass provider-backed roots with a file path', () => {
    const providerRegistry = createAppAssetRootRegistry([
      {
        id: 'provider',
        basePath: demoRoot,
        resolution: 'provider',
        resolveFile: () => null,
      },
    ])

    expect(() =>
      createAppAssetUrlFromFilePath(
        { rootId: 'provider', filePath: path.join(demoRoot, 'sample.png') },
        providerRegistry,
      ),
    ).toThrow('Provider-backed app asset root does not accept file paths')
  })
})

describe('resolveAppAssetProtocolFilePath', () => {
  const immutableRoot = path.resolve('/Users/alice/AppData/images')
  const demoRoot = path.resolve('/Users/alice/Pictures/demo')
  const registry = createAppAssetRootRegistry([
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
  ])

  it('resolves app-asset paths inside an immutable root', () => {
    expect(
      resolveAppAssetProtocolFilePath('app-asset://immutable/ab/sample%20image.png', registry),
    ).toBe(path.join(immutableRoot, 'ab', 'sample image.png'))
  })

  it('resolves app-asset paths inside the requested root', () => {
    expect(resolveAppAssetProtocolFilePath('app-asset://demo/images/sample.png', registry)).toBe(
      path.join(demoRoot, 'images', 'sample.png'),
    )
  })

  it('rejects non app-asset protocols', () => {
    expect(() =>
      resolveAppAssetProtocolFilePath('file:///Users/alice/Pictures/sample.png', registry),
    ).toThrow('Unsupported protocol')
  })

  it('rejects unsupported roots', () => {
    expect(() =>
      resolveAppAssetProtocolFilePath('app-asset://unknown/sample.png', registry),
    ).toThrow('Unsupported app asset root')
  })

  it('rejects POSIX absolute paths', () => {
    expect(() =>
      resolveAppAssetProtocolFilePath(
        'app-asset://immutable/%2FUsers/alice/secrets/token.txt',
        registry,
      ),
    ).toThrow('Asset path must be relative')
  })

  it('rejects Windows absolute paths', () => {
    expect(() =>
      resolveAppAssetProtocolFilePath(
        'app-asset://immutable/C:/Users/Alice/secrets/token.txt',
        registry,
      ),
    ).toThrow('Asset path must be relative')
  })

  it('rejects encoded traversal segments', () => {
    expect(() =>
      resolveAppAssetProtocolFilePath('app-asset://immutable/%2E%2E/secrets/token.txt', registry),
    ).toThrow('Asset path contains traversal segment')
  })

  it('allows path segments that merely start with dots', () => {
    expect(
      resolveAppAssetProtocolFilePath('app-asset://immutable/..cache/sample.png', registry),
    ).toBe(path.join(immutableRoot, '..cache', 'sample.png'))
  })
})
