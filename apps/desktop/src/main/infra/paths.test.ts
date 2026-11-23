import path from 'node:path'

import { afterEach, beforeEach, expect, it } from 'vitest'

import { resolveMainPaths } from './paths'

beforeEach(() => {
  // 配布時の dataPath 計算に必要な Electron 固有の値を補う。
  Object.defineProperty(process, 'resourcesPath', {
    value: path.resolve('test', 'resources'),
    configurable: true,
  })
})

afterEach(() => {
  Reflect.deleteProperty(process, 'resourcesPath')
})

it.each([
  { label: '開発時', isPackaged: false },
  { label: '配布時', isPackaged: true },
])('$label は注入したホーム以下の共有データとElectron固有データに分ける', ({ isPackaged }) => {
  // Arrange
  const homePath = path.resolve('test', 'home')

  // Act
  const paths = resolveMainPaths({
    isPackaged,
    dirname: path.resolve('test', 'app', 'dist', 'main'),
    homePath,
  })

  // Assert
  expect(paths.appDataPath).toBe(path.join(homePath, '.your-app-name', 'app-data'))
  expect(paths.electronDataPath).toBe(path.join(homePath, '.your-app-name', 'electron'))
})
