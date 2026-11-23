import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  FilterXIcon,
  ListFilterIcon,
  SearchIcon,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Input } from '@repo/ui/components/input'
import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'

import { getColumnLabel } from '../column-label'
import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'
import { useDraftCommit } from '../filter/use-draft-commit'

/**
 * factoryのコンテキストへ、GlobalFilterを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createToolbarControls<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts

  /** 一覧検索の入力を反映するまでの待機時間（ms）。 */
  const globalFilterDebounceMs = 200

  // 隠せる列がこれより少ない表では、列メニューを出さない
  const minHideableColumnsForMenu = 3

  /**
   * `<table.AppTable>` の中で、一覧検索（あいまい検索）の入力欄を描画する。
   *
   * @remarks
   * 入力は下書きにして {@link globalFilterDebounceMs} 待ってから反映し、入力欄には下書きを表示する。
   * 空白だけの入力は解除として扱う。アンマウント時は待機中の入力を捨てる。
   */
  function GlobalFilter() {
    const table = useTableContext()
    const writeSearch = useDraftCommit({
      write: (updater) => table.setGlobalFilterDraft(updater),
      commit: () =>
        table.commitGlobalFilterDraft((text) =>
          typeof text === 'string' && text.trim() !== '' ? text : '',
        ),
      discard: () => table.discardGlobalFilterDraft(),
      wait: globalFilterDebounceMs,
      onUnmount: 'discard',
    })

    return (
      <div className="relative w-56 max-w-full">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
        />
        {/* 一覧検索の確定値と下書きから、入力欄に表示する値を購読する */}
        <table.Subscribe selector={() => table.getGlobalFilterInputValue()}>
          {(inputValue) => (
            <Input
              aria-label="一覧を検索"
              className="h-7 pl-7"
              placeholder="検索"
              value={typeof inputValue === 'string' ? inputValue : ''}
              onChange={(event) => writeSearch(event.target.value)}
            />
          )}
        </table.Subscribe>
      </div>
    )
  }

  /**
   * `<table.AppTable>` の中で、見出しの列フィルターの表示を切り替えるボタン。
   * 表示の有無は `meta.layout.showColumnFilters` が持つ。
   */
  function ColumnFilterToggle() {
    const table = useTableContext()
    const { layout, onChangeLayout } = getTableMeta(table)

    return (
      <Button
        size="icon"
        variant={layout.showColumnFilters ? 'secondary' : 'ghost'}
        aria-label="列フィルター"
        aria-pressed={layout.showColumnFilters}
        title="列フィルター"
        onClick={() => onChangeLayout({ showColumnFilters: !layout.showColumnFilters })}
      >
        <ListFilterIcon />
      </Button>
    )
  }

  /**
   * `<table.AppTable>` の中で、一覧検索と列フィルターをまとめて解除するボタン。
   * どちらかで絞り込んでいる間だけ表示する。
   */
  function ClearFiltersButton() {
    const table = useTableContext()

    return (
      <table.Subscribe
        selector={(state) =>
          (typeof state.globalFilter === 'string' && state.globalFilter !== '') ||
          state.columnFilters.length > 0
        }
      >
        {(isFiltered) =>
          isFiltered && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="絞り込みを解除"
              title="絞り込みを解除"
              onClick={() => table.clearFilters()}
            >
              <FilterXIcon />
            </Button>
          )
        }
      </table.Subscribe>
    )
  }

  /**
   * `<table.AppTable>` の中で、列の表示・非表示を切り替えるメニュー。
   *
   * @remarks
   * 行選択・行固定の操作列はテーブル設定で扱い、このメニューには含めない。
   * 隠している列があれば、ボタンに件数を添える。隠せる列が少ない表では表示しない。
   * column の参照だけでは表示状態の変更を検知できないため、表示状態を購読する。
   */
  function ColumnVisibilityMenu() {
    const table = useTableContext()

    return (
      <table.Subscribe
        source={table.atoms.columnVisibility}
        selector={() =>
          table
            .getAllLeafColumns()
            .filter((column) => column.getCanHide())
            .map((column) => ({
              id: column.id,
              label: getColumnLabel(column),
              isVisible: column.getIsVisible(),
            }))
        }
      >
        {(columns) => {
          if (columns.length < minHideableColumnsForMenu) return null
          const hiddenCount = columns.filter((column) => !column.isVisible).length
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size={hiddenCount ? 'sm' : 'icon'}
                    variant="ghost"
                    aria-label="表示する列"
                    title="表示する列"
                  />
                }
              >
                <Columns3Icon />
                {hiddenCount > 0 && (
                  <span className="text-[10px] tabular-nums">-{hiddenCount}</span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.isVisible}
                    closeOnClick={false}
                    onCheckedChange={(checked) =>
                      table.getColumn(column.id)?.toggleVisibility(checked)
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }}
      </table.Subscribe>
    )
  }

  /** `<table.AppTable>` の中で、絞り込み後の件数と全件数を示す。絞り込んでいない間は全件数だけを示す。 */
  function RowCount() {
    const table = useTableContext()

    return (
      <table.Subscribe
        selector={() => ({
          total: table.getCoreRowModel().rows.length,
          filtered: table.getFilteredRowModel().rows.length,
        })}
      >
        {({ total, filtered }) => (
          <span className="text-muted-foreground text-[11px] whitespace-nowrap tabular-nums">
            {filtered === total ? total : `${filtered} / ${total}`} 件
          </span>
        )}
      </table.Subscribe>
    )
  }

  /**
   * `<table.AppTable>` の中で、ページ送りと1ページの件数の選択を描画する。
   *
   * @remarks
   * 件数の選択肢は `meta.pageSizeOptions` に初期状態の件数を加えたもので、`Infinity` は「すべて」と表示する。
   * 最小の選択件数で1ページに収まる場合は操作を省く。ページ数は他の機能の状態でも
   * 変わるため、テーブルの状態を購読して読み直す。
   */
  function PaginationControls() {
    const table = useTableContext()
    const { pageSizeOptions } = getTableMeta(table)
    // 独自の初期件数も選び直せるよう、選択肢に含める
    const options = [...new Set([table.initialState.pagination.pageSize, ...pageSizeOptions])].sort(
      (a, b) => a - b,
    )

    return (
      <table.Subscribe
        selector={() => ({
          ...table.atoms.pagination.get(),
          pageCount: table.getPageCount(),
          rowCount: table.getPrePaginatedRowModel().rows.length,
          canPreviousPage: table.getCanPreviousPage(),
          canNextPage: table.getCanNextPage(),
        })}
      >
        {({ pageIndex, pageSize, pageCount, rowCount, canPreviousPage, canNextPage }) =>
          pageCount <= 1 && rowCount <= options[0]! ? null : (
            <div className="flex items-center gap-0.5">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="最初のページ"
                disabled={!canPreviousPage}
                onClick={() => table.firstPage()}
              >
                <ChevronsLeftIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="前のページ"
                disabled={!canPreviousPage}
                onClick={() => table.previousPage()}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-[11px] tabular-nums">
                {pageIndex + 1}/{pageCount}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="次のページ"
                disabled={!canNextPage}
                onClick={() => table.nextPage()}
              >
                <ChevronRightIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="最後のページ"
                disabled={!canNextPage}
                onClick={() => table.lastPage()}
              >
                <ChevronsRightIcon />
              </Button>
              <NativeSelect
                size="sm"
                aria-label="1ページの件数"
                value={pageSize}
                // option の値は文字列 "Infinity" になり、Number() で Infinity に戻る
                onChange={(event) => table.setPageSize(Number(event.target.value))}
              >
                {options.map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size === Infinity ? 'すべて' : size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )
        }
      </table.Subscribe>
    )
  }

  return {
    GlobalFilter,
    ColumnFilterToggle,
    ClearFiltersButton,
    ColumnVisibilityMenu,
    RowCount,
    PaginationControls,
  }
}
