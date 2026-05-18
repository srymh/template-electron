import fs from 'node:fs/promises'

export async function ensureUserDataAppDirectory(userDataAppPath: string): Promise<void> {
  await fs.mkdir(userDataAppPath, { recursive: true })
}
