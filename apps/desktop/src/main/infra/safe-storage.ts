import fs from 'node:fs/promises'

import { safeStorage } from 'electron'

export class SecretStorage {
  constructor(private rootDir: string) {}

  async storeSecret(key: string, value: string): Promise<void> {
    const encrypted = safeStorage.encryptString(value)

    // Base64 で保存する場合
    // const encryptedBase64 = encrypted.toString('base64')
    // await fs.writeFile(`${this.rootDir}/${key}.enc`, encryptedBase64, 'utf-8')

    await fs.writeFile(`${this.rootDir}/${key}.enc`, encrypted)
  }

  async retrieveSecret(key: string): Promise<string> {
    // Base64 で保存している場合
    // const encryptedBase64 = await fs.readFile(`${this.rootDir}/${key}.enc`, 'utf-8')
    // const encryptedBuffer = Buffer.from(encryptedBase64, 'base64')

    const encryptedBuffer = await fs.readFile(`${this.rootDir}/${key}.enc`)
    const decrypted = safeStorage.decryptString(encryptedBuffer)
    return decrypted
  }
}
