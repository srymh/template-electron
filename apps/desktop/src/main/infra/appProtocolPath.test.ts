import { describe, expect, it } from 'vitest'

import { resolveAppProtocolFilePath } from './appProtocolPath'

describe('resolveAppProtocolFilePath', () => {
  it('resolves macOS and POSIX absolute paths', () => {
    expect(resolveAppProtocolFilePath('app:////Users/alice/Pictures/sample.png', 'darwin')).toBe(
      '/Users/alice/Pictures/sample.png',
    )
  })

  it('decodes percent-encoded POSIX paths', () => {
    expect(resolveAppProtocolFilePath('app:////Users/alice/My%20Files/sample.png', 'darwin')).toBe(
      '/Users/alice/My Files/sample.png',
    )
  })

  it('resolves Windows drive-letter paths', () => {
    expect(resolveAppProtocolFilePath('app:///C:/Users/Alice/Pictures/sample.png', 'win32')).toBe(
      'C:\\Users\\Alice\\Pictures\\sample.png',
    )
    expect(
      resolveAppProtocolFilePath(String.raw`app:///C:\Users\Alice\Pictures\sample.png`, 'win32'),
    ).toBe('C:\\Users\\Alice\\Pictures\\sample.png')
  })

  it('decodes percent-encoded Windows paths', () => {
    expect(
      resolveAppProtocolFilePath('app:///C%3A/Users/Alice/My%20Files/sample.png', 'win32'),
    ).toBe('C:\\Users\\Alice\\My Files\\sample.png')
  })

  it('resolves Windows UNC paths', () => {
    expect(resolveAppProtocolFilePath('app://server/share/sample.png', 'win32')).toBe(
      '\\\\server\\share\\sample.png',
    )
    expect(resolveAppProtocolFilePath('app:////server/share/sample.png', 'win32')).toBe(
      '\\\\server\\share\\sample.png',
    )
  })

  it('rejects non-app protocols', () => {
    expect(() => resolveAppProtocolFilePath('file:///Users/alice/sample.png', 'darwin')).toThrow(
      'Unsupported protocol',
    )
  })
})
