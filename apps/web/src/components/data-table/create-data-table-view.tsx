import type { HTMLAttributes, ReactNode } from 'react'

import type { Row, RowData } from '@tanstack/react-table'

import { usePinnedRowOffsets } from './body/use-pinned-row-offsets'
import { getDisplayRows } from './display-order'
import type { ComponentRowData, DataTableFeatures } from './features'
import type { DataTableInstance } from './use-data-table-instance'

/** {@link DataTableView} の、テーブル以外の表示に関する props。 */
export type DataTableViewProps<
  TData extends RowData,
  TMeta extends object = Record<never, never>,
> = {
  /** `table` 要素の名前。 */
  label?: string
  /** 操作行で、標準の操作の右に並べる利用側の操作。 */
  toolbar?: ReactNode
  /** 行ごとに `tr` へ渡す属性。`className` は既定のクラスに追加する。 */
  getRowProps?: (row: Row<DataTableFeatures<TMeta>, TData>) => HTMLAttributes<HTMLTableRowElement>
  /**
   * テーブルの設定パネル（リセット・テーブル幅・高さ・列の固定ボタン・グループ化した列）を開くボタンを出すか。
   * 既定は `true`。
   */
  settings?: boolean
}

/**
 * {@link useDataTable} で作ったテーブルを、操作行・見出し・本文を持つ一覧として描画する。
 *
 * @remarks
 * `createTableHook` の `useAppTable` で作ったテーブルを `<table.AppTable>` でコンテキストに置き、
 * 登録した部品（`table.Frame`・`header.Cell`・`cell.Cell` など）を組み合わせて描画する。
 * 能力に応じて次を切り替える。
 * - 操作行: 一覧検索、列フィルターの表示切り替えと解除、列メニュー、件数、ページ送り、設定パネル
 * - 見出し: ソート、グループ化、列の固定、列幅の変更、列のドラッグ並べ替え、候補付きの列フィルター
 * - 本文: 行選択、行の固定、グループの展開、セル選択
 * - 下部: 選択セルの表示とコピー
 *
 * セル選択の範囲は、行の固定によらず、ページ分割前の表示順（ソート・フィルター・展開の結果）で決まる。
 * 固定行を含む範囲は、画面上で連続しない場合がある。
 * @returns factoryのmeta型に結び付けた、行データの型を保つ描画部品
 */
export function createDataTableView<TMeta extends object>() {
  /** factoryの機能型を持つテーブルを、共通の枠・見出し・本文で表示する。 */
  function DataTableView<TData extends RowData>({
    table: typedTable,
    label,
    toolbar,
    getRowProps,
    settings = true,
  }: { table: DataTableInstance<TData, TMeta> } & DataTableViewProps<TData, TMeta>) {
    // 登録した部品は行データの型を知らないため、部品へ渡すテーブルは行データを緩めて扱う。
    // 行データの型は props（table・getRowProps）の境界で保つ。
    const table = typedTable as unknown as DataTableInstance<ComponentRowData, TMeta>
    const { pinnedRowOffsets, tableHeadRef, getPinnedRowRef } = usePinnedRowOffsets(table)

    // 固定行を含め、実際に描画する順に行を並べる
    const rows = getDisplayRows(table)

    return (
      <table.AppTable>
        <table.Frame label={label} toolbar={toolbar} settings={settings}>
          {/* 見出し */}
          <table.Head ref={tableHeadRef}>
            {(h, { region, index }) => (
              <table.AppHeader header={h}>
                {(header) => (
                  <header.Cell region={region} index={index}>
                    <header.FlexRender />
                  </header.Cell>
                )}
              </table.AppHeader>
            )}
          </table.Head>

          {/* 本文 */}
          <tbody>
            {rows.map((row) => (
              <table.BodyRow
                key={row.id}
                row={row}
                pinnedRowOffsets={pinnedRowOffsets}
                getPinnedRowRef={getPinnedRowRef}
                rowProps={getRowProps?.(row as Row<DataTableFeatures<TMeta>, TData>)}
              >
                {(c, state) => (
                  <table.AppCell cell={c}>
                    {(cell) => (
                      <cell.Cell state={state}>
                        <cell.FlexRender />
                      </cell.Cell>
                    )}
                  </table.AppCell>
                )}
              </table.BodyRow>
            ))}
          </tbody>
        </table.Frame>
      </table.AppTable>
    )
  }

  return DataTableView
}
