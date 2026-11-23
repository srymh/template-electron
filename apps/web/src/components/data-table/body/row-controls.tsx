import type { ChangeEvent } from 'react'

import { PinIcon, PinOffIcon, SquareCheckBigIcon, SquareIcon, SquareMinusIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'

import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'

/**
 * factoryのコンテキストへ、RowSelectCheckboxを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createRowControls<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useCellContext, useTableContext } = contexts

  /**
   * `<table.AppCell>` の中で、その行の選択を切り替えるチェックボックス。
   *
   * @remarks
   * row の参照だけでは選択状態の変更を検知できないため、選択状態を購読し、
   * チェックボックスに直接反映する。
   */
  function RowSelectCheckbox() {
    const { row } = useCellContext()
    const table = useTableContext()
    const { idPrefix } = getTableMeta(table)

    return (
      <table.Subscribe
        source={table.atoms.rowSelection}
        selector={() => ({ checked: row.getIsSelected(), indeterminate: row.getIsSomeSelected() })}
      >
        {({ checked, indeterminate }) => (
          <SelectCheckbox
            // 同じ文書の他のテーブルと checkbox の id が重ならないよう接頭辞を付ける
            id={`${idPrefix}-select-${row.id}`}
            label={`行 ${row.id} を選択`}
            checked={checked}
            indeterminate={indeterminate}
            onChange={row.getToggleSelectedHandler()}
          />
        )}
      </table.Subscribe>
    )
  }

  /**
   * `<table.AppHeader>` の中で、すべての行の選択を切り替えるチェックボックス。
   *
   * @remarks
   * table の参照だけでは選択状態の変更を検知できないため、選択状態を購読し、
   * チェックボックスに直接反映する。
   */
  function SelectAllRowsCheckbox() {
    const table = useTableContext()
    const { idPrefix } = getTableMeta(table)

    return (
      <table.Subscribe
        source={table.atoms.rowSelection}
        selector={() => ({
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
        })}
      >
        {({ checked, indeterminate }) => (
          <SelectCheckbox
            id={`${idPrefix}-select-all`}
            label="すべての行を選択"
            checked={checked}
            indeterminate={indeterminate}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        )}
      </table.Subscribe>
    )
  }

  /**
   * 行選択のチェックボックス。
   *
   * @remarks
   * 見た目はアイコンで表し、操作・名前・状態は視覚的に隠した checkbox が担当する。
   * 行ごとに描画するため、Radix の Checkbox ではなく軽い native の checkbox を使う。
   * `id` は同じ文書内で一意にする。`indeterminate` は `checked` が `false` の場合だけ反映する。
   *
   * 状態ごとのアイコン（未選択・選択・中間）は3つとも常に描画し、表示するものだけを
   * checkbox の状態（`:checked`・`:indeterminate`）に従って CSS で切り替える。
   * ノードを挿入・削除すると、アプリ全体の `:has()` を使う規則により文書全体のスタイル再計算が起き、
   * 行数の多い表では選択の切り替えが遅くなるため、状態の変更でアイコンの要素を差し替えない。
   */
  function SelectCheckbox({
    id,
    label,
    checked,
    indeterminate,
    onChange,
  }: {
    id: string
    label: string
    checked: boolean
    indeterminate: boolean
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
  }) {
    return (
      <div className="has-focus-visible:outline-ring relative mx-auto size-3.5 has-focus-visible:outline-2">
        <input
          type="checkbox"
          id={id}
          aria-label={label}
          className="peer sr-only"
          checked={checked}
          // indeterminate は HTML 属性ではなく DOM プロパティでしか設定できない
          ref={(node) => {
            if (node) node.indeterminate = !checked && indeterminate
          }}
          onChange={onChange}
        />
        {/* input の状態に従って、1つのアイコンだけを表示する。選択を中間より優先する */}
        <label
          htmlFor={id}
          className={cn(
            'text-muted-foreground peer-checked:text-primary peer-indeterminate:text-primary cursor-pointer',
            '[&>svg]:hidden',
            'peer-[:not(:checked):not(:indeterminate)]:[&>[data-icon=unchecked]]:block',
            'peer-checked:[&>[data-icon=checked]]:block',
            'peer-[:indeterminate:not(:checked)]:[&>[data-icon=indeterminate]]:block',
          )}
        >
          <SquareIcon aria-hidden data-icon="unchecked" className="size-3.5" />
          <SquareCheckBigIcon aria-hidden data-icon="checked" className="size-3.5" />
          <SquareMinusIcon aria-hidden data-icon="indeterminate" className="size-3.5" />
        </label>
      </div>
    )
  }

  /**
   * `<table.AppCell>` の中で、その行を上端・下端へ固定する2つのボタン。
   *
   * @remarks
   * 同じ側に固定済みの行でボタンを押すと、固定を解除する。
   * row の参照だけでは固定状態の変更を検知できないため、状態を購読する。
   */
  function RowPinButtons() {
    const { row } = useCellContext()
    const table = useTableContext()

    return (
      <table.Subscribe selector={() => row.getIsPinned()}>
        {(isPinned) => (
          <div className="flex items-center justify-center gap-0.5">
            {(['top', 'bottom'] as const).map((position) => {
              const isPinnedHere = isPinned === position
              const Icon = isPinnedHere ? PinOffIcon : PinIcon
              return (
                <Button
                  key={position}
                  size="icon-xs"
                  variant={isPinnedHere ? 'secondary' : 'ghost'}
                  aria-label={
                    isPinnedHere
                      ? `行 ${row.id} の固定を解除`
                      : `行 ${row.id} を${position === 'top' ? '上端' : '下端'}に固定`
                  }
                  onClick={() => row.pin(isPinnedHere ? false : position)}
                >
                  <Icon className={position === 'top' ? 'rotate-180' : undefined} />
                </Button>
              )
            })}
          </div>
        )}
      </table.Subscribe>
    )
  }

  return { RowSelectCheckbox, SelectAllRowsCheckbox, RowPinButtons }
}
