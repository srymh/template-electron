import { useId, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { ShieldCheckIcon, Trash2Icon, UploadIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import type {
  StorageDemoObject,
  StorageDemoObjectVerification,
} from '@your-app-name/api/storage-demo'

import { createDataTableFactory } from '@/components/data-table'

import { useStorageDemoObjectMutations, useStorageDemoObjects } from '../api/storage-demo'
import { formatByteSize } from '../utils/table-values'

/** 一覧のセルから使う、処理中の状態・検証結果・行の操作。 */
type ObjectListMeta = {
  isBusy: boolean
  verifications: Readonly<Record<string, StorageDemoObjectVerification>>
  onPreview: (object: StorageDemoObject) => void
  onVerify: (key: string) => void
  onRemove: (key: string) => void
}

const objectTable = createDataTableFactory<ObjectListMeta>()
const column = objectTable.createDataTableColumnHelper<StorageDemoObject>()
const objectColumns = column.columns([
  column.accessor('key', { header: 'キー', filterFn: 'includesString' }),
  column.accessor('fileName', { header: 'ファイル名' }),
  column.accessor('mediaType', { header: 'MIME type', size: 140 }),
  column.accessor('byteSize', {
    header: 'サイズ',
    size: 100,
    cell: ({ getValue }) => formatByteSize(getValue()),
  }),
  column.display({
    id: 'verification',
    header: '検証',
    size: 130,
    cell: ({ row, table }) => {
      const status = objectTable.getMeta(table).verifications[row.original.key]
      return status ? <VerificationBadge status={status} /> : null
    },
  }),
  column.display({
    id: 'actions',
    header: '操作',
    size: 200,
    meta: { label: '操作' },
    cell: ({ row, table }) => (
      <ObjectRowActions object={row.original} meta={objectTable.getMeta(table)} />
    ),
  }),
])

const objectCapabilities = { globalFiltering: true, sorting: true, pagination: true }

/**
 * オブジェクトストアのデモ区画。ファイルを任意のキーで保存し、一覧・プレビュー・検証・削除を行う。
 * 本文は CAS に、キーと metadata は SQLite の index に保存され、プレビューは `app-asset://` で配信される。
 */
export function ObjectStoreSection() {
  const objects = useStorageDemoObjects()
  const { put, verify, remove } = useStorageDemoObjectMutations()
  const [preview, setPreview] = useState<StorageDemoObject | null>(null)
  const [verifications, setVerifications] = useState<Record<string, StorageDemoObjectVerification>>(
    {},
  )

  // 行の操作。削除したオブジェクトはプレビューと検証結果からも外す。
  const meta: ObjectListMeta = {
    isBusy: verify.isPending || remove.isPending,
    verifications,
    onPreview: setPreview,
    onVerify: (key) =>
      verify.mutate(key, {
        onSuccess: (status) => setVerifications((current) => ({ ...current, [key]: status })),
      }),
    onRemove: (key) =>
      remove.mutate(key, {
        onSuccess: () => {
          setPreview((current) => (current?.key === key ? null : current))
          setVerifications(({ [key]: _removed, ...rest }) => rest)
        },
      }),
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        ファイルを任意のキーで保存します。本文は内容のハッシュで重複を除いて保存され、 キーと
        metadata は SQLite の index に記録されます。
      </p>

      <ObjectUploadForm
        isSaving={put.isPending}
        onSubmit={(input, onDone) => put.mutate(input, { onSuccess: onDone })}
      />
      {put.isError && <ErrorMessage>保存できませんでした: {put.error.message}</ErrorMessage>}
      {remove.isError && <ErrorMessage>削除できませんでした: {remove.error.message}</ErrorMessage>}

      {/* 保存済みオブジェクトの一覧 */}
      {objects.isPending ? (
        <p className="text-sm">読み込み中...</p>
      ) : objects.isError ? (
        <ErrorMessage>一覧を取得できませんでした: {objects.error.message}</ErrorMessage>
      ) : (
        <objectTable.DataTable
          data={objects.data}
          columns={objectColumns}
          getRowId={(object) => object.key}
          capabilities={objectCapabilities}
          meta={meta}
          label="保存済みオブジェクト"
          initialLayout={{ heightStrategy: 'content' }}
        />
      )}

      {preview && <ObjectPreview object={preview} onClose={() => setPreview(null)} />}
    </section>
  )
}

/**
 * 保存するファイルとキーの入力欄。ファイルを選ぶとファイル名をキーの初期値にする。
 * 保存に成功したら入力欄を空に戻す。
 */
function ObjectUploadForm({
  isSaving,
  onSubmit,
}: {
  isSaving: boolean
  onSubmit: (
    input: { key: string; content: Uint8Array; mediaType: string | null; fileName: string },
    onDone: () => void,
  ) => void
}) {
  const fileInputId = useId()
  const keyInputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [key, setKey] = useState('')
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file || key === '') return

    const content = new Uint8Array(await file.arrayBuffer())
    onSubmit({ key, content, mediaType: file.type || null, fileName: file.name }, () => {
      // ファイル入力は値を書き換えられないため、要素を作り直して空にする。
      setFile(null)
      setKey('')
      setFormKey((current) => current + 1)
    })
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fileInputId}>ファイル</Label>
        <Input
          id={fileInputId}
          type="file"
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null
            setFile(selected)
            if (selected) setKey(`uploads/${selected.name}`)
          }}
        />
      </div>
      <div className="flex min-w-64 flex-1 flex-col gap-1">
        <Label htmlFor={keyInputId}>キー</Label>
        <Input
          id={keyInputId}
          value={key}
          placeholder="例: uploads/sample.png"
          onChange={(event) => setKey(event.currentTarget.value)}
        />
      </div>
      <Button type="submit" disabled={!file || key === '' || isSaving}>
        <UploadIcon />
        保存
      </Button>
    </form>
  )
}

/** 一行分の操作ボタン。処理中は検証と削除を押せないようにする。 */
function ObjectRowActions({ object, meta }: { object: StorageDemoObject; meta: ObjectListMeta }) {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={() => meta.onPreview(object)}>
        表示
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={meta.isBusy}
        onClick={() => meta.onVerify(object.key)}
        aria-label={`${object.key} を検証`}
      >
        <ShieldCheckIcon />
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={meta.isBusy}
        onClick={() => meta.onRemove(object.key)}
        aria-label={`${object.key} を削除`}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}

const verificationLabels: Record<StorageDemoObjectVerification, string> = {
  valid: '正常',
  'missing-key': 'キーなし',
  'missing-content': '本文なし',
  'corrupt-content': '破損',
}

/** 検証結果の表示。正常以外は警告の色で示す。 */
function VerificationBadge({ status }: { status: StorageDemoObjectVerification }) {
  return (
    <span
      className={status === 'valid' ? 'text-green-700 dark:text-green-400' : 'text-destructive'}
    >
      {verificationLabels[status]}
    </span>
  )
}

/**
 * 選んだオブジェクトの本文の表示。画像・音声・動画は要素で、テキストは取得した本文を表示する。
 * URL は取得時の revision に固定されており、更新・削除後は配信されない。
 */
function ObjectPreview({ object, onClose }: { object: StorageDemoObject; onClose: () => void }) {
  const mediaType = object.mediaType ?? ''

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-sm">{object.url}</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </div>
      {mediaType.startsWith('image/') ? (
        <img
          src={object.url}
          alt={object.fileName ?? object.key}
          className="max-h-80 object-contain"
        />
      ) : mediaType.startsWith('audio/') ? (
        <audio src={object.url} controls />
      ) : mediaType.startsWith('video/') ? (
        <video src={object.url} controls className="max-h-80" />
      ) : mediaType.startsWith('text/') || mediaType === 'application/json' ? (
        <TextPreview url={object.url} />
      ) : (
        <p className="text-muted-foreground text-sm">この形式はプレビューできません。</p>
      )}
    </div>
  )
}

/** テキストの本文を `app-asset://` から取得して表示する。 */
function TextPreview({ url }: { url: string }) {
  const text = useQuery({
    queryKey: ['storage-demo', 'object-text', url],
    queryFn: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.text()
    },
  })

  if (text.isPending) return <p className="text-sm">読み込み中...</p>
  if (text.isError)
    return <ErrorMessage>本文を取得できませんでした: {text.error.message}</ErrorMessage>
  return (
    <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
      {text.data}
    </pre>
  )
}

/** 取得・操作の失敗を示す文。 */
function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-sm">
      {children}
    </p>
  )
}
