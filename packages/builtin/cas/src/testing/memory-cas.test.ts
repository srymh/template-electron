import { expect, it } from 'vitest'

import { createMemoryCas } from './index'

it('memory fixtureは内容を複製し、破損の検証と期待サイズの拒否を提供する', async () => {
  const cas = createMemoryCas()
  const content = new Uint8Array([1, 2])
  const stored = await cas.put(content, { expectedByteSize: 2 })
  content[0] = 9
  const read = await cas.read(stored.sha256)
  read[0] = 9
  await expect(cas.read(stored.sha256)).resolves.toEqual(new Uint8Array([1, 2]))
  await expect(cas.put(new Uint8Array([1]), { expectedByteSize: 2 })).rejects.toThrow('期待値')
  cas.overwrite(stored.sha256, new Uint8Array([9]))
  await expect(cas.verify(stored.sha256)).resolves.toMatchObject({ status: 'corrupt' })
})
