import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export const Route = createFileRoute('/demo/fs')({
  component: RouteComponent,
  loader: () => ({ crumb: 'File System' }),
})

function RouteComponent() {
  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl mb-4">File System Demo</h1>

      <table className="[&_th]:border [&_td]:border [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_th]:min-w-[120px] [&_td]:min-w-[120px] text-xs">
        <thead>
          <tr>
            <th>メソッド</th>
            <th>説明</th>
            <th>実行</th>
            <th>結果</th>
          </tr>
        </thead>
        <tbody>
          <ShowOpenFileDialogRow />
          <ShowOpenFileDialogAndReadAsTextRow />
          <ShowOpenFileDialogAndReadAsImageRow />
          <ShowSaveDialogRow />
          <ShowSaveDialogAndWriteAsTextRow />
          <ShowSaveDialogAndWriteAsArrayBufferRow />
          <ShowOpenFolderDialogRow />
          <ShowOpenFolderDialogAndReadDirectoryRow />
          <GetPathForFileRow />
        </tbody>
      </table>
      <div className="mt-4">
        <FileExplorer />
      </div>
    </div>
  )
}

function ShowOpenFileDialogRow() {
  const {
    mutate: showOpenDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showOpenDialog,
  })
  const [files, setFiles] = React.useState<Array<string>>([])

  const handleClickAction = () => {
    showOpenDialog(
      {
        filters: [{ name: 'All Files', extensions: ['*'] }],
        properties: ['openFile', 'multiSelections'],
      },
      {
        onSuccess: (selectedFilePaths) => setFiles(selectedFilePaths.filePaths),
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.showOpenDialog</pre>
      </td>
      <td>ファイル選択ダイアログを開きます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル選択ダイアログを開く
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            <ul>
              {files.map((file) => (
                <li key={file} className="text-[10px]">
                  <pre>{file}</pre>
                </li>
              ))}
            </ul>
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowOpenFileDialogAndReadAsTextRow() {
  const {
    mutate: showOpenDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showOpenDialog,
  })
  const [filePath, setFilePath] = React.useState<string>('')
  const [content, setContent] = React.useState<string>('')

  const {
    mutate: readFileAsText,
    isIdle: isIdleOpenFile,
    isPending: isPendingOpenFile,
    isPaused: isPausedOpenFile,
    isSuccess: isSuccessOpenFile,
    isError: isErrorOpenFile,
  } = useMutation({
    mutationFn: api.fs.readFileAsText,
    onSuccess: (data) => {
      setContent(data)
    },
    onError: (error) => {
      console.error('Error reading file:', error)
      setContent('エラーが発生しました')
    },
  })

  const handleClickAction = () => {
    showOpenDialog(
      {
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
        properties: ['openFile'],
      },
      {
        onSuccess: (files) => {
          if (files.filePaths.length > 0) {
            const path = files.filePaths[0]
            setFilePath(path)
            readFileAsText({ path })
          } else {
            setFilePath('')
            setContent('')
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.readFileAsText</pre>
      </td>
      <td>ファイルをテキストとして読み込みます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending || isPendingOpenFile}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル選択ダイアログで選択したファイルを開く
        </button>
      </td>
      <td>
        {isIdle || isIdleOpenFile ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending || isPendingOpenFile ? (
          <span>処理中...</span>
        ) : isPaused || isPausedOpenFile ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess && isSuccessOpenFile ? (
          <>
            <span>ファイルが正常に開かれました</span>
            {filePath && (
              <div>
                <h3 className="text-sm font-bold">選択されたファイル:</h3>
                <pre>{filePath}</pre>
              </div>
            )}
            {content && (
              <div>
                <h3 className="text-sm font-bold">ファイル内容:</h3>
                <pre className="max-h-[200px] overflow-auto border">
                  {content}
                </pre>
              </div>
            )}
          </>
        ) : isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : isErrorOpenFile ? (
          <span className="text-red-500">
            ファイル読み込み中にエラーが発生しました
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowOpenFileDialogAndReadAsImageRow() {
  const {
    mutate: showOpenDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showOpenDialog,
  })
  const [filePath, setFilePath] = React.useState<string>('')
  const [content, setContent] = React.useState<ArrayBuffer | null>(null)

  const { mutate: readFileAsArrayBuffer } = useMutation({
    mutationFn: api.fs.readFileAsArrayBuffer,
    onSuccess: (data) => {
      setContent(data)
    },
    onError: (error) => {
      console.error('Error reading file:', error)
      setContent(null)
    },
  })

  const handleClickAction = () => {
    showOpenDialog(
      {
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
      },
      {
        onSuccess: (files) => {
          if (files.filePaths.length > 0) {
            const path = files.filePaths[0]
            setFilePath(path)
            readFileAsArrayBuffer({ path })
          } else {
            setFilePath('')
            setContent(null)
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.readFileAsArrayBuffer</pre>
      </td>
      <td>ファイルをバイナリデータとして読み込みます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル選択ダイアログで選択したファイルを開く
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ファイルが正常に開かれました</span>
            {filePath && (
              <div>
                <h3 className="text-sm font-bold">選択されたファイル:</h3>
                <pre>{filePath}</pre>
              </div>
            )}
            {filePath && (
              <div>
                <h3 className="text-sm font-bold">ファイル内容:</h3>
                <img
                  src={`app:///${filePath}`}
                  alt="Selected File"
                  className="max-h-[400px] max-w-full object-contain border"
                />
              </div>
            )}
            {content && (
              <div>
                <h3 className="text-sm font-bold">ファイル内容:</h3>
                <ImageFromArrayBuffer arrayBuffer={content} />
              </div>
            )}
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowSaveDialogRow() {
  const {
    mutate: showSaveDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showSaveDialog,
  })
  const [file, setFile] = React.useState<string>('')
  const handleClickAction = () => {
    showSaveDialog(
      { properties: ['createDirectory'] },
      {
        onSuccess: (result) => {
          if (result.filePath) {
            setFile(result.filePath)
          } else {
            setFile('')
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.showSaveDialog</pre>
      </td>
      <td>ファイル保存ダイアログを開きます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル保存ダイアログを開く
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            {file && (
              <div>
                <h3 className="text-sm font-bold">選択されたファイル:</h3>
                <pre>{file}</pre>
              </div>
            )}
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowSaveDialogAndWriteAsTextRow() {
  const {
    mutate: showSaveDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showSaveDialog,
  })
  const [file, setFile] = React.useState<string>('')

  const {
    mutate: writeFileAsText,
    isSuccess: isWriteSuccess,
    isError: isWriteError,
  } = useMutation({
    mutationFn: api.fs.writeFileAsText,
  })

  const handleClickAction = () => {
    showSaveDialog(
      {
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
        properties: ['createDirectory'],
      },
      {
        onSuccess: (result) => {
          if (result.filePath) {
            setFile(result.filePath)
            // テキストを書き込む
            writeFileAsText({ path: result.filePath, data: 'Hello, World!' })
          } else {
            setFile('')
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.writeFileAsText</pre>
      </td>
      <td>選択したファイルにテキストを書き込みます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル保存ダイアログを開いてテキストを書き込む
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            {file && (
              <div>
                <h3 className="text-sm font-bold">選択されたファイル:</h3>
                <pre>{file}</pre>
                {isWriteSuccess ? (
                  <span className="text-green-500">
                    テキストが正常に書き込まれました
                  </span>
                ) : (
                  <span className="text-red-500">
                    テキストの書き込みに失敗しました
                  </span>
                )}
              </div>
            )}
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">ダイアログが開かれませんでした</span>
        ) : isWriteError ? (
          <span className="text-red-500">
            ファイル書き込み中にエラーが発生しました
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowSaveDialogAndWriteAsArrayBufferRow() {
  const {
    mutate: showSaveDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showSaveDialog,
  })
  const [file, setFile] = React.useState<string>('')

  const {
    mutate: writeFileAsArrayBuffer,
    isSuccess: isWriteSuccess,
    isError: isWriteError,
  } = useMutation({
    mutationFn: api.fs.writeFileAsArrayBuffer,
  })

  const handleClickAction = () => {
    showSaveDialog(
      {
        filters: [{ name: 'Image Files', extensions: ['png'] }],
        properties: ['createDirectory'],
      },
      {
        onSuccess: (result) => {
          if (result.filePath) {
            setFile(result.filePath)
            // 10x10くらいの緑の画像データを生成
            const canvas = document.createElement('canvas')
            canvas.width = 10
            canvas.height = 10
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.fillStyle = 'green'
              ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
            const dataUrl = canvas.toDataURL('image/png')
            const byteString = atob(dataUrl.split(',')[1])
            const arrayBuffer = new ArrayBuffer(byteString.length)
            const uint8Array = new Uint8Array(arrayBuffer)
            for (let i = 0; i < byteString.length; i++) {
              uint8Array[i] = byteString.charCodeAt(i)
            }
            writeFileAsArrayBuffer({ path: result.filePath, data: arrayBuffer })
          } else {
            setFile('')
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.writeFileAsArrayBuffer</pre>
      </td>
      <td>選択したファイルにバイナリデータを書き込みます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          ファイル保存ダイアログを開いてバイナリデータを書き込む
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            {file && (
              <div>
                <h3 className="text-sm font-bold">選択されたファイル:</h3>
                <pre>{file}</pre>
                {isWriteSuccess ? (
                  <span className="text-green-500">
                    バイナリデータが正常に書き込まれました
                  </span>
                ) : (
                  <span className="text-red-500">
                    バイナリデータの書き込みに失敗しました
                  </span>
                )}
              </div>
            )}
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">ダイアログが開かれませんでした</span>
        ) : isWriteError ? (
          <span className="text-red-500">
            ファイル書き込み中にエラーが発生しました
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowOpenFolderDialogRow() {
  const {
    mutate: showOpenDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showOpenDialog,
  })
  const [folder, setFolder] = React.useState<string>('')
  const handleClickAction = () => {
    showOpenDialog(
      {
        properties: ['openDirectory'],
      },
      {
        onSuccess: (files) => setFolder(files.filePaths[0]),
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.showOpenDialog</pre>
      </td>
      <td>フォルダ選択ダイアログを開きます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          フォルダ選択ダイアログを開く
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            <ul>
              <li className="text-[10px]">
                <pre>{folder}</pre>
              </li>
            </ul>
          </>
        ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : null}
      </td>
    </tr>
  )
}

function ShowOpenFolderDialogAndReadDirectoryRow() {
  const {
    mutate: showOpenDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.showOpenDialog,
  })
  const [folder, setFolder] = React.useState<string>('')

  const [entries, setEntries] = React.useState<
    Awaited<ReturnType<typeof api.fs.readDirectory>>
  >([])
  const {
    mutate: readDirectory,
    isSuccess: isReadSuccess,
    isError: isReadError,
  } = useMutation({
    mutationFn: api.fs.readDirectory,
  })

  const handleClickAction = () => {
    showOpenDialog(
      {
        properties: ['openDirectory'],
      },
      {
        onSuccess: (files) => {
          if (files.filePaths.length > 0) {
            const path = files.filePaths[0]
            setFolder(path)
            readDirectory(
              { path },
              {
                onSuccess: (directoryEntries) => {
                  console.log('Directory entries:', directoryEntries)
                  setEntries(directoryEntries)
                },
                onError: (error) => {
                  console.error('Error reading directory:', error)
                  setFolder('エラーが発生しました')
                  setEntries([])
                },
              },
            )
          } else {
            setFolder('')
            setEntries([])
          }
        },
      },
    )
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.readDirectory</pre>
      </td>
      <td>選択したフォルダの内容を読み込みます。</td>
      <td>
        <button
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          フォルダ選択ダイアログを開いてフォルダ内容を読み込む
        </button>
      </td>
      <td>
        {isIdle ? (
          <span>ダイアログはまだ開かれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>処理が一時停止中です</span>
        ) : isSuccess && isReadSuccess ? (
          <>
            <span>ダイアログが正常に開かれました</span>
            <ul>
              <li className="text-[10px]">
                <pre>{folder}</pre>
              </li>
            </ul>
            <h3 className="text-sm font-bold">フォルダ内容:</h3>
            <FolderTree folder={folder} />
            {entries.length === 0 && (
              <span className="text-gray-500">フォルダは空です</span>
            )}
          </>
        ) : isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : isReadError ? (
          <span className="text-red-500">
            フォルダ読み込み中にエラーが発生しました
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function GetPathForFileRow() {
  const [file, setFile] = React.useState<File | null>(null)
  const [path, setPath] = React.useState<string>('')
  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null
    setFile(selectedFile)
    setPath('')
  }
  const handleClickAction = async () => {
    if (file) {
      const filePath = await api.fs.getPathForFile({ file })
      setPath(filePath)
    }
  }

  return (
    <tr>
      <td>
        <pre>window.electronApi.fs.getPathForFile</pre>
      </td>
      <td>
        <code>input[type="file"]</code>で選択したファイルのパスを取得します。
      </td>
      <td className="flex flex-col">
        <input
          type="file"
          id="fileInput"
          title="ファイルを選択"
          onChange={handleSelectFile}
          className="border rounded px-2 py-1 mb-2 w-full"
          accept="*"
        />
        <button
          type="button"
          onClick={handleClickAction}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          選択したファイルのパスを取得
        </button>
      </td>
      <td>
        {file ? (
          <>
            <span>選択されたファイル: </span>
            <pre className="text-[10px]">{file.name}</pre>
          </>
        ) : (
          <span>ファイルが選択されていません</span>
        )}

        <div>
          <h3 className="text-sm font-bold">取得したパス:</h3>
          {path ? (
            <pre className="text-[10px]">{path}</pre>
          ) : (
            <span>パスが取得されていません</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// 追加: ArrayBufferからBase64画像データURLを生成するコンポーネント
function ImageFromArrayBuffer({ arrayBuffer }: { arrayBuffer: ArrayBuffer }) {
  const [src, setSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    const blob = new Blob([arrayBuffer], { type: 'image/png' })
    const reader = new FileReader()
    reader.onload = () => setSrc(reader.result as string)
    reader.readAsDataURL(blob)
  }, [arrayBuffer])

  if (!src) return <span>画像を生成中...</span>
  return (
    <img
      src={src}
      alt="Selected File"
      className="max-h-[400px] max-w-full object-contain border"
    />
  )
}

/**
 * 簡単なフォルダツリー表示コンポーネント
 */
function FolderTree({
  folder,
  depth = 0,
  onSelectFile = () => {},
}: {
  folder: string
  depth?: number
  onSelectFile?: (path: string) => void
}) {
  type DirectoryEntry = Awaited<ReturnType<typeof api.fs.readDirectory>>[number]

  type DirectoryEntryEx = DirectoryEntry & {
    isOpen: boolean
  }

  const [tree, setTree] = React.useState<Array<DirectoryEntryEx>>([])

  const { data, isLoading, isFetching, isError, isSuccess } = useQuery({
    queryKey: ['readDirectory', folder],
    queryFn: () => api.fs.readDirectory({ path: folder }),
  })

  React.useEffect(() => {
    if (data) {
      const buildTree = (
        entries: Array<DirectoryEntry>,
      ): Array<DirectoryEntryEx> => {
        return entries.map((entry) => ({
          ...entry,
          isOpen: false,
        }))
      }

      setTree(buildTree(data))
    }
  }, [data])

  const handleClickEntry = (entry: DirectoryEntryEx) => {
    switch (entry.type) {
      case 'directory':
        setTree((prev) =>
          prev.map((e) =>
            e.path === entry.path ? { ...e, isOpen: !e.isOpen } : e,
          ),
        )
        break
      case 'file':
        onSelectFile(entry.path)
        break
      default:
        return
    }
  }

  return (
    <ul className="overflow-auto h-full">
      {isLoading || isFetching ? (
        <li>
          {/* 深さに応じてインデントを調整 */}
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="inline-block w-3">
              {i !== depth - 1 ? '│' : ''}
            </span>
          ))}
          Loading...
        </li>
      ) : isError ? (
        <li>
          {/* 深さに応じてインデントを調整 */}
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="inline-block w-3">
              {i !== depth - 1 ? '│' : ''}
            </span>
          ))}
          <span className="text-red-500">Error loading directory</span>
        </li>
      ) : isSuccess ? (
        tree.map((entry, index, self) => (
          <li
            key={entry.path}
            className="text-[10px] select-none cursor-pointer"
            onClick={(e) => {
              handleClickEntry(entry)
              e.stopPropagation() // Prevent the click from bubbling up
            }}
          >
            {/* 深さに応じてインデントを調整 */}
            {Array.from({ length: depth }).map((_, i) => (
              <span key={i} className="inline-block w-3">
                {i !== depth - 1 ? '│' : index === self.length - 1 ? '└' : '├'}
              </span>
            ))}

            {/* ディレクトリの場合は開閉ボタンを表示 */}
            <span className="inline-block">
              {entry.type === 'directory' ? (
                <div className="w-3 border flex justify-center items-center">
                  {entry.isOpen ? '-' : '+'}
                </div>
              ) : (
                <div className="w-3">─</div>
              )}
            </span>

            {/* アイコン */}
            <span>{entry.type === 'directory' ? '📁' : '📄'}</span>

            {/* エントリ名 */}
            <span className="hover:underline">{entry.name}</span>

            {/* サブフォルダの表示 */}
            {entry.isOpen ? (
              <FolderTree
                folder={entry.path}
                depth={depth + 1}
                onSelectFile={onSelectFile}
              />
            ) : null}
          </li>
        ))
      ) : null}
    </ul>
  )
}

function FileExplorer() {
  const [folder, setFolder] = React.useState<string>('')
  const [filePath, setFilePath] = React.useState<string>('')

  const {
    mutate: showOpenDirectoryDialog,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: () =>
      api.fs.showOpenDialog({
        properties: ['openDirectory'],
      }),
    onSuccess: (result) => {
      if (result.canceled) {
        setFolder('')
        setFilePath('')
      } else if (result.filePaths.length === 0) {
        setFolder('')
        setFilePath('')
      } else {
        const path = result.filePaths[0]
        setFolder(path)
        setFilePath('') // フォルダが選択されたらファイルパスをリセット
      }
    },
  })

  const handleClickAction = () => {
    showOpenDirectoryDialog()
  }

  const handleSelectFile = (path: string) => {
    setFilePath(path)
  }

  return (
    <div className="p-4 rounded shadow border h-screen text-xs">
      <h2 className="text-sm">📁ファイルエクスプローラー</h2>

      <div className="flex flex-row items-center justify-start gap-2 mt-2 h-8">
        <button
          type="button"
          onClick={handleClickAction}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          フォルダを選ぶ
        </button>

        <div>
          {isIdle ? (
            <span>まだフォルダは選択されていません</span>
          ) : isPending ? (
            <span>処理中...</span>
          ) : isPaused ? (
            <span>一時停止中...</span>
          ) : isSuccess ? (
            <>
              {folder ? (
                <span>
                  選択されたフォルダ: <pre>{folder}</pre>
                </span>
              ) : (
                <span>フォルダは選択されていません</span>
              )}
            </>
          ) : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          isError ? (
            <span className="text-red-500">エラーが発生しました</span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 overflow-auto border h-[500px] flex flex-row flex-wrap">
        <div className="h-full w-1/2 border-r">
          {isSuccess && folder ? (
            <FolderTree folder={folder} onSelectFile={handleSelectFile} />
          ) : (
            <span className="text-gray-500">フォルダが選択されていません</span>
          )}
        </div>
        <div className="h-full w-1/2">
          {isSuccess && filePath ? (
            <FileDetails key={filePath} filePath={filePath} />
          ) : (
            <span className="text-gray-500">ファイルが選択されていません</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * `isIdle` などの状態（isPending, isSuccess, isError など）は `useMutation` の内部で管理されており、`filePath` が変わっても自動的にはリセットされません。
 * **初期化したい場合は、`key` プロパティを使ってコンポーネント自体を再マウントする方法**が一般的です。
 *
 * 例えば、`FileDetails` を使う側でこうします：
 *
 * ````tsx
 * // ...existing code...
 * <FileDetails key={filePath} filePath={filePath} />
 * // ...existing code...
 * ````
 *
 * こうすると `filePath` が変わるたびに `FileDetails` が再マウントされ、`useMutation` の状態も初期化されます。
 *
 * `useMutation` 自体には状態をリセットするAPIはありません（2024年6月時点）。
 * `key` の利用が最もシンプルで確実です。
 */
function FileDetails({ filePath }: { filePath: string }) {
  const [textContent, setTextContent] = React.useState<string>('')

  const {
    mutate: readFileAsText,
    isIdle,
    isPending,
    isPaused,
    isSuccess,
    isError,
  } = useMutation({
    mutationFn: api.fs.readFileAsText,
    onSuccess: (data) => {
      setTextContent(data)
    },
    onError: (error) => {
      console.error('Error reading file:', error)
      setTextContent('エラーが発生しました')
    },
  })

  const DISPLAY_MODES = ['text', 'image', 'video'] as const
  type DisplayMode = (typeof DISPLAY_MODES)[number]

  const [isMountImg, setIsMountImage] = React.useState(false)
  const [isMountVideo, setIsMountVideo] = React.useState(false)
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>('text')
  const handleChangeDisplayMode = (mode: DisplayMode) => {
    if (DISPLAY_MODES.includes(mode)) {
      setDisplayMode(mode)
      setIsMountImage(false)
      setIsMountVideo(false)
    }
  }

  return (
    <div className="p-1 overflow-auto h-full">
      <h3 className="text-sm font-semibold">ファイル詳細</h3>
      <pre className="whitespace-pre-wrap">{filePath}</pre>
      <div className="mt-2"></div>
      <button
        type="button"
        onClick={() => api.fs.openFileByDefaultApp({ path: filePath })}
        disabled={isPending}
        className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
      >
        デフォルトアプリで開く
      </button>

      <div className="mt-2"></div>
      <RadioGroup
        defaultValue={displayMode}
        onValueChange={handleChangeDisplayMode}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="text" id="open-as-text" />
          <Label htmlFor="open-as-text" className="text-xs">
            テキストファイル
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="image" id="open-as-image" />
          <Label htmlFor="open-as-image" className="text-xs">
            画像ファイル
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="video" id="open-as-video" />
          <Label htmlFor="open-as-video" className="text-xs">
            動画ファイル
          </Label>
        </div>
      </RadioGroup>

      <div className="mt-2"></div>
      {displayMode === 'text' ? (
        <button
          type="button"
          onClick={() => readFileAsText({ path: filePath })}
          disabled={isPending}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          テキストとしてファイルを読み込む
        </button>
      ) : displayMode === 'image' ? (
        <button
          type="button"
          onClick={() => setIsMountImage(true)}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          画像としてファイルを開く
        </button>
      ) : (
        /* displayMode === 'video' */
        <button
          type="button"
          onClick={() => setIsMountVideo(true)}
          className="bg-blue-500 text-white px-2 py-1 rounded-xs hover:bg-blue-600 disabled:opacity-50"
        >
          動画としてファイルを開く
        </button>
      )}

      <div className="mt-2">
        {displayMode === 'text' && isIdle ? (
          <span>まだファイルは読み込まれていません</span>
        ) : isPending ? (
          <span>処理中...</span>
        ) : isPaused ? (
          <span>一時停止中...</span>
        ) : isSuccess ? (
          <>
            <span>ファイルが正常に読み込まれました</span>
            {textContent && (
              <div className="mt-2">
                <h4 className="text-sm font-bold">ファイル内容:</h4>
                <pre className="max-h-[200px] overflow-auto border p-2">
                  {textContent}
                </pre>
              </div>
            )}
          </>
        ) : isError ? (
          <span className="text-red-500">エラーが発生しました</span>
        ) : null}
        {displayMode === 'image' && isMountImg ? (
          <img src={'app:///' + filePath} alt="ファイルの内容" />
        ) : null}
        {displayMode === 'video' && isMountVideo ? (
          <>
            <video
              src={'app:///' + filePath}
              controls
              className="max-h-[400px] max-w-full object-contain border"
            />
            <span className="text-red-500 ">未対応</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
