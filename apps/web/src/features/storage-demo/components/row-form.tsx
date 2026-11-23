import { useId, useState } from 'react'

import { KeyRoundIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'

import { formColumns, isNumeric, parseInput, toInputValue } from '../utils/table-values'
import type { TableColumn, TableDefinition, TableRow } from '../utils/table-values'

/** フォームの用途。追加では主キーも入力し、更新では主キーを固定して変更した列だけを送る。 */
export type RowFormMode = { type: 'create' } | { type: 'update'; row: TableRow }

/**
 * 一行分の入力フォーム。テーブル定義から入力欄を作り、選択肢のある列は選択欄にする。
 * 呼び出し側は対象の行が変わるたびに `key` を変えて入力を初期化する。
 */
export function RowForm({
  definition,
  mode,
  initialInputs,
  isSaving,
  onSubmit,
  onCancel,
}: {
  definition: TableDefinition
  mode: RowFormMode
  /** 入力欄の初期値。列名と入力欄の文字列の組。 */
  initialInputs: Readonly<Record<string, string>>
  isSaving: boolean
  /** 入力を列の型に合わせた行。更新では変更した列だけを含む。 */
  onSubmit: (row: TableRow) => void
  onCancel: () => void
}) {
  const [inputs, setInputs] = useState(initialInputs)
  const columns = formColumns(definition)

  // 追加では全列を、更新では初期値から変わった編集可能な列だけを送る。
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const submitted = columns.filter((column) =>
      mode.type === 'create'
        ? true
        : column.editable && inputs[column.name] !== initialInputs[column.name],
    )
    onSubmit(
      Object.fromEntries(
        submitted.map((column) => [column.name, parseInput(column, inputs[column.name] ?? '')]),
      ),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border p-3">
      <h3 className="text-sm font-semibold">
        {mode.type === 'create' ? '行を追加' : '行を更新'}（{definition.displayName}）
      </h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {columns.map((column) => (
          <ColumnInput
            key={column.name}
            column={column}
            value={inputs[column.name] ?? ''}
            // 更新では主キーで対象を指定するため、主キーは書き換えさせない。
            disabled={mode.type === 'update' && !column.editable}
            onChange={(value) => setInputs((current) => ({ ...current, [column.name]: value }))}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {mode.type === 'create' ? '追加' : '更新'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}

/**
 * 一列分の入力欄。許可値・参照先の候補がある列は選択欄、数値列は数値入力にする。
 * 主キーは鍵のアイコン、NOT NULL の列は必須の印で示す。
 */
function ColumnInput({
  column,
  value,
  disabled,
  onChange,
}: {
  column: TableColumn
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const inputId = useId()

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="font-mono">
        {column.primaryKeyOrder !== null && <KeyRoundIcon aria-hidden className="size-3" />}
        {column.name}
        {column.notNull && <span aria-hidden>*</span>}
        <span className="text-muted-foreground text-xs font-normal">{column.dataType}</span>
      </Label>
      {column.allowedValueOptions ? (
        <NativeSelect
          id={inputId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {column.allowedValueOptions.map((option) => (
            <NativeSelectOption key={toInputValue(option.value)} value={toInputValue(option.value)}>
              {option.label ?? toInputValue(option.value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={inputId}
          type={isNumeric(column.dataType) ? 'number' : 'text'}
          value={value}
          // sqlite-table-editor は追加時に主キーの指定を求めるため、主キーも必須にする。
          required={column.notNull || column.primaryKeyOrder !== null}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
    </div>
  )
}
