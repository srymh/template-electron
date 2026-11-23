import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  put: vi.fn(),
  verify: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@your-app-name/api/renderer', () => ({
  storageDemo: { objects: api },
}))

import { ObjectStoreSection } from './object-store-section'

const storedObject = {
  key: 'uploads/sample.png',
  byteSize: 2048,
  mediaType: 'image/png',
  fileName: 'sample.png',
  revision: '1',
  url: 'app-asset://storage-demo-objects/objects/uploads/sample.png?revision=1',
}

beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue([storedObject])
  api.put.mockResolvedValue(storedObject)
  api.verify.mockResolvedValue('valid')
  api.remove.mockResolvedValue(true)
})

/** 取得の再試行をしない QueryClient で区画を描画する。 */
function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ObjectStoreSection />
    </QueryClientProvider>,
  )
}

describe('ObjectStoreSection', () => {
  it('保存済みのオブジェクトを一覧に表示し、画像を配信 URL でプレビューする', async () => {
    // Arrange
    renderSection()
    const table = await screen.findByRole('table', { name: '保存済みオブジェクト' })

    // Act
    fireEvent.click(within(table).getByRole('button', { name: '表示' }))

    // Assert
    expect(within(table).getByText('2.0 KB')).toBeDefined()
    expect(screen.getByRole('img', { name: 'sample.png' }).getAttribute('src')).toBe(
      storedObject.url,
    )
  })

  it('選んだファイルの内容と metadata を、入力したキーで保存する', async () => {
    // Arrange
    renderSection()
    await screen.findByRole('table', { name: '保存済みオブジェクト' })
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    // Act
    fireEvent.change(screen.getByLabelText('ファイル'), { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('キー'), { target: { value: 'notes/hello.txt' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    const input = api.put.mock.calls[0]?.[0]
    expect(input).toMatchObject({
      key: 'notes/hello.txt',
      mediaType: 'text/plain',
      fileName: 'hello.txt',
    })
    expect(new TextDecoder().decode(input.content)).toBe('hello')
  })

  it('検証の結果を行に表示する', async () => {
    // Arrange
    renderSection()
    const table = await screen.findByRole('table', { name: '保存済みオブジェクト' })

    // Act
    fireEvent.click(within(table).getByRole('button', { name: `${storedObject.key} を検証` }))

    // Assert
    expect(await within(table).findByText('正常')).toBeDefined()
    expect(api.verify).toHaveBeenCalledWith({ key: storedObject.key })
  })
})
