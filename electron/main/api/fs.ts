import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { dialog, shell } from 'electron'

import type {
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron'
import type {
  ApiInterface,
  WithWebContents,
  WithWebContentsApi,
} from '#/shared/lib/ipc'

// -----------------------------------------------------------------------------
// 型定義

export const FS_API_KEY = 'fs' as const
export type FileSystemApiKey = typeof FS_API_KEY

export type DirectoryEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
}

export type FileDetails = {
  name: string // ファイル名
  size: number // サイズ（バイト単位）
  creationTime: Date // 作成時間
  modificationTime: Date // 最終更新時間
  isDirectory: boolean // ディレクトリかどうか
  isFile: boolean // ファイルかどうか
  isSymbolicLink: boolean // シンボリックリンクかどうか
  extension: string // 拡張子がある場合のみ
  lastAccessTime: Date // 最終アクセス時間
  mimeType?: string // MIME タイプ（オプション）
}

// -----------------------------------------------------------------------------
// インターフェイス定義

/**
 * メインプロセスで処理するファイルシステム API のインターフェイスです。
 */
export type FileSystemApi = ApiInterface<{
  /**
   * パスを結合します。
   *
   * @example
   * const result = await fs.joinPath({ parts: ['foo', 'bar.txt'] })
   * console.log(result) // => 'foo/bar.txt'
   *
   * @param options.parts 結合するパスの部品
   * @returns 結合されたパス
   */
  joinPath: (options: { parts: string[] }) => Promise<string>
  /**
   * ファイルをテキストとして読み込みます。
   * @note この関数は、テキストファイルを UTF-8 エンコーディングで読み込みます。
   * @param options.path 読み込むファイルのパス
   * @returns 読み込んだテキスト
   */
  readFileAsText: (options: { path: string }) => Promise<string>
  /**
   * ファイルをバイナリとして読み込みます。
   * @param options.path 読み込むファイルのパス
   * @returns 読み込んだバイナリデータ
   */
  readFileAsArrayBuffer: (options: { path: string }) => Promise<ArrayBuffer>
  /**
   * テキストをファイルに書き込みます。
   * @note この関数は、テキストを UTF-8 エンコーディングで書き込みます。
   * @param options.path 書き込むファイルのパス
   * @param options.data 書き込むテキスト
   */
  writeFileAsText: (options: { path: string; data: string }) => Promise<void>
  /**
   * バイナリデータをファイルに書き込みます。
   * @param options.path 書き込むファイルのパス
   * @param options.data 書き込むバイナリデータ
   */
  writeFileAsArrayBuffer: (options: {
    path: string
    data: ArrayBuffer
  }) => Promise<void>
  /**
   * ファイルを開くダイアログを表示します。
   * @param options オプション https://www.electronjs.org/ja/docs/latest/api/dialog#dialogshowopendialogwindow-options
   * @returns 選択されたファイルのパス
   */
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>
  /**
   * ファイルを保存するダイアログを表示します。
   * @param options オプション https://www.electronjs.org/ja/docs/latest/api/dialog#dialogshowsavedialogwindow-options
   * @returns 保存先のファイルのパス
   */
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>
  /**
   * ディレクトリを読み込みます。
   * @param options.path 読み込むディレクトリのパス
   * @returns 読み込んだディレクトリエントリの配列
   */
  readDirectory: (options: { path: string }) => Promise<DirectoryEntry[]>
  /**
   * デフォルトのアプリでファイルを開きます。
   * @param options.path 開くファイルのパス
   */
  openFileByDefaultApp: (options: { path: string }) => Promise<void>
  getFileDetails: (options: { path: string }) => Promise<FileDetails>
}>

/**
 * レンダラープロセスで処理するファイルシステム API のインターフェイスです。
 */
export type FileSystemRendererApi = Readonly<{
  /**
   * ファイルのパスを取得します。
   * @param options.file ファイルオブジェクト
   * @returns ファイルのパス
   */
  getPathForFile: (options: { file: File }) => Promise<string>
}>

// -----------------------------------------------------------------------------
// 実装

const joinPath: WithWebContents<FileSystemApi['joinPath']> = async (options) =>
  nodePath.join(...options.parts)

const readFileAsText: WithWebContents<FileSystemApi['readFileAsText']> = async (
  options,
) => {
  const { path } = options
  const text = await fs.readFile(path, 'utf-8')
  return text
}

const readFileAsArrayBuffer: WithWebContents<
  FileSystemApi['readFileAsArrayBuffer']
> = async (options) => {
  const { path } = options
  const buffer = await fs.readFile(path)

  // ArrayBuffer へ変換
  // Note: Buffer は Node.js のバッファで、ArrayBuffer はブラウザで使用されるバッファです。
  const arrayBufferMaybe = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )

  const arrayBuffer = new ArrayBuffer(arrayBufferMaybe.byteLength)
  const view = new Uint8Array(arrayBuffer)
  view.set(new Uint8Array(arrayBufferMaybe))

  return arrayBuffer
}

const writeFileAsText: WithWebContents<
  FileSystemApi['writeFileAsText']
> = async (options) => {
  const { path, data } = options
  await fs.writeFile(path, data, 'utf-8')
}

const writeFileAsArrayBuffer: WithWebContents<
  FileSystemApi['writeFileAsArrayBuffer']
> = async (options) => {
  const { path, data } = options
  const buffer = Buffer.from(data)
  await fs.writeFile(path, buffer)
}

const showOpenDialog: WithWebContents<FileSystemApi['showOpenDialog']> = async (
  options,
) => {
  return await dialog.showOpenDialog(options)
}

const showSaveDialog: WithWebContents<FileSystemApi['showSaveDialog']> = async (
  options,
) => {
  return await dialog.showSaveDialog(options)
}

const readDirectory: WithWebContents<FileSystemApi['readDirectory']> = async (
  options,
) => {
  const { path } = options
  const entries = await fs.readdir(path, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    path: nodePath.join(path, entry.name),
    type: entry.isDirectory() ? 'directory' : 'file',
  }))
}

const openFileByDefaultApp: WithWebContents<
  FileSystemApi['openFileByDefaultApp']
> = async (options) => {
  const { path } = options
  await shell.openPath(path)
}

const getFileDetails: WithWebContents<FileSystemApi['getFileDetails']> = async (
  options,
) => {
  let path: string
  if ('path' in options) {
    path = options.path
  } else {
    const { fileName, folderPath } = options
    path = nodePath.join(folderPath, fileName)
  }

  const stats = await fs.stat(path)
  const isDirectory = stats.isDirectory()
  const isFile = stats.isFile()
  const isSymbolicLink = stats.isSymbolicLink()
  const lastAccessTime = stats.atime

  return {
    name: nodePath.basename(path),
    size: stats.size,
    creationTime: stats.birthtime,
    modificationTime: stats.mtime,
    isDirectory,
    isFile,
    isSymbolicLink,
    extension: isFile ? nodePath.extname(path) : '',
    lastAccessTime,
  }
}

export function getFileSystemApi(): WithWebContentsApi<FileSystemApi> {
  return {
    joinPath,
    readFileAsText,
    readFileAsArrayBuffer,
    writeFileAsText,
    writeFileAsArrayBuffer,
    showOpenDialog,
    showSaveDialog,
    readDirectory,
    openFileByDefaultApp,
    getFileDetails,
  }
}
