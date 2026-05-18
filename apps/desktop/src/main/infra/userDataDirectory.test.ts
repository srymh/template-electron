import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureUserDataAppDirectory } from './userDataDirectory'

const tmpDirs: string[] = []

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-data-directory-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('ensureUserDataAppDirectory', () => {
  it('creates the app directory below userData when it does not exist', async () => {
    const root = await createTempDir()
    const userDataAppPath = path.join(root, 'userData', 'app')

    await ensureUserDataAppDirectory(userDataAppPath)

    const stats = await fs.stat(userDataAppPath)
    expect(stats.isDirectory()).toBe(true)
  })

  it('does not fail when the directory already exists', async () => {
    const root = await createTempDir()
    const userDataAppPath = path.join(root, 'userData', 'app')
    await fs.mkdir(userDataAppPath, { recursive: true })

    await expect(ensureUserDataAppDirectory(userDataAppPath)).resolves.toBeUndefined()
  })
})
