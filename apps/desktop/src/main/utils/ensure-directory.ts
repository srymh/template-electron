import fs from 'node:fs/promises'

export async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true })
}
