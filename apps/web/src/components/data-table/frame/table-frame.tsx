import { useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { SearchXIcon, Settings2Icon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'

import { createCellSelectionStatus } from '../cell-selection/cell-selection-status'
import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'
import type { TableLayout } from '../features'
import { createSettingsPanel } from './settings-panel'
import { createToolbarControls } from './toolbar-controls'

/**
 * factoryのコンテキストへ、Frameを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createFrame<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts
  const { CellSelectionStatus } = createCellSelectionStatus(contexts)
  const { SettingsPanel } = createSettingsPanel(contexts)
  const {
    GlobalFilter,
    ColumnFilterToggle,
    ClearFiltersButton,
    ColumnVisibilityMenu,
    RowCount,
    PaginationControls,
  } = createToolbarControls(contexts)

  // 本文の余白にだけ、テーマの境界色で斜線を描画する。
  const contentPatternClassName =
    'bg-[repeating-linear-gradient(135deg,var(--border),var(--border)_1px,transparent_1px,transparent_5px)]'

  /**
   * {@link Frame} の props。
   *
   * @remarks
   * `children`（`thead`・`tbody`）以外は `DataTableView` が渡し、意味は `DataTableViewProps` の
   * 同名の項目と同じ。`settings` は `DataTableView` が既定値を補ってから渡す。
   */
  type FrameProps = {
    children: ReactNode
    label?: string
    toolbar?: ReactNode
    settings: boolean
  }

  /**
   * `<table.AppTable>` の中で、操作行・スクロール領域・下部の状態表示・設定パネルを持つテーブル枠を描画する。
   *
   * @remarks
   * - 操作行: 一覧検索（`globalFiltering`）、列フィルターの表示切り替えと解除（`columnFiltering`）、
   *   列メニュー（`columnVisibility`）、利用側の `toolbar`、件数、ページ送り（`pagination`）、
   *   設定パネル。いずれもなければ操作行を描画しない。
   * - スクロール領域: 見出しを上端に固定した `table`。行がなければ、データが0件か
   *   絞り込みで該当がないかを区別して示す。
   * - 下部: 選択セルの表示とコピー（`cellSelection`）。
   *
   * 操作行・本文・1段のフッターを一つの外枠に収める。設定パネルは枠内に重ね、
   * 本文の余白にだけ斜線を描画する。
   * この表だけを操作不可にする。表外の操作とフォーカス移動は妨げない。
   * 列幅の合計を購読し、`fullWidth` でない場合のテーブル幅に使う。
   * 枠とスクロール領域の高さは、表示設定の高さの決め方（{@link getHeightSizing}）で決める。
   */
  function Frame({ children, label, toolbar, settings }: FrameProps) {
    const table = useTableContext()
    const { capabilities, layout } = getTableMeta(table)
    const heightSizing = getHeightSizing(layout)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const isPanelOpen = settings && isSettingsOpen
    const panelId = useId()
    const settingsTriggerRef = useRef<HTMLButtonElement>(null)

    const hasStandardControls =
      capabilities.globalFiltering ||
      capabilities.columnFiltering ||
      capabilities.columnVisibility ||
      capabilities.pagination
    const hasToolbar = hasStandardControls || Boolean(toolbar) || settings

    return (
      <div
        className={cn(
          'bg-background relative isolate flex min-w-0 flex-col overflow-hidden rounded-md border',
          heightSizing.fillsParent && 'min-h-0 flex-1',
        )}
      >
        {/* パネルが開いている間は、この表のヘッダー・本文・フッターだけを操作対象から外す */}
        <div
          inert={isPanelOpen}
          aria-hidden={isPanelOpen || undefined}
          className={cn('flex min-h-0 min-w-0 flex-col', heightSizing.fillsParent && 'flex-1')}
        >
          {/* 操作行: 検索・絞り込み・列・利用側の操作・件数・ページ送り・設定 */}
          {hasToolbar && (
            <div className="bg-muted/40 flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1">
              {capabilities.globalFiltering && <GlobalFilter />}
              {capabilities.columnFiltering && (
                <>
                  <ColumnFilterToggle />
                  <ClearFiltersButton />
                </>
              )}
              {capabilities.columnVisibility && <ColumnVisibilityMenu />}
              {toolbar}
              <div className="ml-auto flex items-center gap-1">
                {hasStandardControls && <RowCount />}
                {capabilities.pagination && <PaginationControls />}
                {settings && (
                  <Button
                    ref={settingsTriggerRef}
                    size="icon"
                    variant="ghost"
                    aria-label="テーブルの設定"
                    aria-expanded={isPanelOpen}
                    aria-controls={isPanelOpen ? panelId : undefined}
                    title="テーブルの設定"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings2Icon />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 一覧本体 */}
          <div
            className={cn(
              'bg-background min-w-0 overflow-auto overscroll-none',
              contentPatternClassName,
              heightSizing.fillsParent && 'min-h-24 flex-1',
            )}
            style={heightSizing.style}
          >
            <table.Subscribe selector={() => table.getTotalSize()}>
              {(totalSize) => (
                <table
                  aria-label={label}
                  // 継承される CSS 変数にすると、幅の変更のたびに表の全子孫のスタイルを再計算するため、
                  // 幅は table 自身の width に直接書く
                  style={layout.fullWidth ? undefined : { width: totalSize }}
                  className={cn(
                    'bg-background text-foreground border-separate border-spacing-0 text-xs',
                    layout.tableFixed && 'table-fixed',
                    layout.fullWidth && 'w-full',
                  )}
                >
                  {children}
                </table>
              )}
            </table.Subscribe>
            <EmptyRows />
          </div>

          {/* 下部: 選択セルの表示とコピー */}
          {capabilities.cellSelection && (
            <div
              role="group"
              aria-label="セル選択の状態"
              className="bg-muted/40 shrink-0 overflow-hidden border-t"
            >
              <CellSelectionStatus />
            </div>
          )}
        </div>

        {/* パネルと透明な操作抑止領域は、共通の外枠の内側だけに重ねる */}
        {isPanelOpen && (
          <>
            <div
              aria-hidden
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 z-60"
            />
            <SettingsPanel
              id={panelId}
              onClose={() => setIsSettingsOpen(false)}
              triggerRef={settingsTriggerRef}
            />
          </>
        )}
      </div>
    )
  }

  /**
   * 表示設定の高さの決め方から、枠とスクロール領域の高さの指定を決める。
   *
   * @param layout - テーブルの表示設定
   * @returns 枠が親の残りの高さを埋めるか、スクロール領域のスタイル
   */
  function getHeightSizing(layout: TableLayout): { fillsParent: boolean; style?: CSSProperties } {
    // 数値は CSS px、文字列は CSS の長さとしてそのまま使う
    const height = typeof layout.height === 'number' ? `${layout.height}px` : layout.height
    switch (layout.heightStrategy) {
      case 'content':
        return { fillsParent: false }
      case 'fill':
        return { fillsParent: true }
      case 'fixed':
        return { fillsParent: false, style: { height } }
      case 'max':
        return { fillsParent: false, style: { maxHeight: height } }
    }
  }

  /**
   * 表示する行がないときの表示。データが0件のときと、絞り込みで該当がないときを区別して示す。
   */
  function EmptyRows() {
    const table = useTableContext()

    return (
      <table.Subscribe
        selector={() => ({
          isEmpty: table.getRowModel().rows.length === 0 && table.getTopRows().length === 0,
          hasData: table.getCoreRowModel().rows.length > 0,
        })}
      >
        {({ isEmpty, hasData }) =>
          isEmpty && (
            <div className="text-muted-foreground flex h-14 items-center justify-center gap-1.5 text-xs">
              <SearchXIcon aria-hidden className="size-4 opacity-60" />
              {hasData ? '該当なし' : '0件'}
            </div>
          )
        }
      </table.Subscribe>
    )
  }

  return { Frame }
}
