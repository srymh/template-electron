import { useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'

import type { GroupingColumnMode } from '@tanstack/react-table'
import {
  ArrowDownToLineIcon,
  ArrowLeftToLineIcon,
  ArrowUpToLineIcon,
  EqualIcon,
  EyeOffIcon,
  FoldVerticalIcon,
  GroupIcon,
  LockIcon,
  MoveHorizontalIcon,
  PanelRightCloseIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  RulerIcon,
  SquareCheckIcon,
  TriangleAlertIcon,
  UnfoldVerticalIcon,
} from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'

import type { TableCapability } from '../capabilities'
import type { DataTableContexts } from '../contexts'
import { getTableMeta } from '../features'
import type {
  ComponentRowData,
  DataTableCoreTable,
  TableHeightLength,
  TableHeightStrategy,
} from '../features'
import { SegmentedControl, SettingsSection, ToggleChip } from './settings-controls'
import type { SegmentedOption } from './settings-controls'

/**
 * factoryのコンテキストへ、SettingsPanelを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createSettingsPanel<TMeta extends object>(contexts: DataTableContexts<TMeta>) {
  const { useTableContext } = contexts

  // 各機能の状態を戻す操作と、その操作を出す能力。初期状態（initialState）ではなく、
  // 既定値（ソートなし・フィルターなし・固定なしなど、何も制御しない状態）へ戻す
  const resetActions: Array<{
    label: string
    capability: TableCapability
    reset: (table: DataTableCoreTable<ComponentRowData, TMeta>) => void
  }> = [
    { label: '並び替え', capability: 'sorting', reset: (t) => t.resetSorting(true) },
    {
      label: '列フィルター',
      capability: 'columnFiltering',
      reset: (t) => t.clearColumnFilters(),
    },
    {
      label: '一覧検索',
      capability: 'globalFiltering',
      reset: (t) => t.clearGlobalFilter(),
    },
    { label: 'グループ化', capability: 'grouping', reset: (t) => t.resetGrouping(true) },
    { label: '展開', capability: 'grouping', reset: (t) => t.resetExpanded(true) },
    { label: 'ページ', capability: 'pagination', reset: (t) => t.resetPagination(true) },
    { label: '列順', capability: 'columnOrdering', reset: (t) => t.resetColumnOrder(true) },
    {
      label: '列の表示',
      capability: 'columnVisibility',
      reset: (t) => t.resetColumnVisibility(true),
    },
    { label: '列の固定', capability: 'columnPinning', reset: (t) => t.resetColumnPinning(true) },
    { label: '列幅', capability: 'columnResizing', reset: (t) => t.resetColumnSizing(true) },
    { label: '行の固定', capability: 'rowPinning', reset: (t) => t.resetRowPinning(true) },
    { label: '行選択', capability: 'rowSelection', reset: (t) => t.resetRowSelection(true) },
    { label: 'セル選択', capability: 'cellSelection', reset: (t) => t.resetCellSelection(true) },
  ]

  // 高さの決め方の選択肢。区画に収まる短い名前とアイコンで示し、完全な名前は支援技術とツールチップに渡す
  const heightStrategyOptions: Array<SegmentedOption<TableHeightStrategy>> = [
    {
      value: 'content',
      label: '内容',
      icon: <FoldVerticalIcon />,
      accessibleName: '内容に合わせる',
    },
    {
      value: 'fill',
      label: '埋める',
      icon: <UnfoldVerticalIcon />,
      accessibleName: '残りの高さを埋める',
    },
    { value: 'fixed', label: '指定', icon: <RulerIcon />, accessibleName: '高さを指定する' },
    {
      value: 'max',
      label: '上限',
      icon: <ArrowDownToLineIcon />,
      accessibleName: '高さの上限を指定する',
    },
  ]

  // グループ化した列の扱いの選択肢
  const groupedColumnModeOptions: Array<SegmentedOption<GroupingColumnMode>> = [
    {
      value: 'reorder',
      label: '先頭へ',
      icon: <ArrowLeftToLineIcon />,
      accessibleName: '先頭へ移す',
    },
    { value: 'remove', label: '隠す', icon: <EyeOffIcon /> },
    { value: false, label: 'そのまま', icon: <EqualIcon /> },
  ]

  // 指定できる高さ・上限の下限（CSS px）。操作行を除いた見出しと数行が収まる高さ
  const minHeight = 120

  /**
   * テーブル枠の右側に重ね、その表の設定を操作するパネル。
   *
   * @remarks
   * 開閉と表内の操作抑止は Frame が所有する。アプリ全体のモーダルではないため、
   * aria-modal やグローバルなフォーカストラップは使わない。他の表や画面へ移動できる。
   * 開くと閉じるボタンへフォーカスを移し、閉じると設定ボタンへ戻す。
   *
   * 操作するのは、見出しの固定ボタン（`columnPinning`）・グループ化ボタン（`grouping`）の表示、操作列の可視性、
   * グループ化した列の扱い（`grouping`）、テーブル幅、高さ、リセット。リセットの操作は、有効な能力の分だけ表示する。
   * 常に表示する説明文は置かず、状態に応じた表示で伝える。固定中の列の数と解除は見出しのボタンの項目に、
   * 固定列が重なりうる幅の組み合わせは幅の項目の警告ボタン（{@link WidthSettings}）で示す。
   * 表示設定は `meta.layout` を読み、`meta.onChangeLayout`・`meta.onResetLayout` で更新する。
   */
  function SettingsPanel({
    id,
    onClose,
    triggerRef,
  }: {
    id: string
    onClose: () => void
    triggerRef: RefObject<HTMLButtonElement | null>
  }) {
    const table = useTableContext()
    const { capabilities, layout, onChangeLayout, onResetLayout, idPrefix } = getTableMeta(table)
    const enabledResetActions = resetActions.filter(({ capability }) => capabilities[capability])
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    // フォーカスの移動はこの表の開閉時だけ行い、表外への移動は妨げない。
    useEffect(() => {
      const trigger = triggerRef.current
      closeButtonRef.current?.focus()
      return () => {
        // inert が解除された commit の後に戻す。DOM 更新前はフォーカスできない。
        if (trigger?.isConnected) trigger.focus()
      }
    }, [triggerRef])

    // 有効な機能を、初期状態ではなく何も制御しない既定値へ戻し、表示設定を初期値へ戻す
    const handleResetAll = () => {
      for (const { reset } of enabledResetActions) reset(table)
      onResetLayout()
    }

    return (
      <div
        id={id}
        role="dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }}
        className="bg-popover/95 text-popover-foreground absolute inset-y-0 right-0 z-70 flex w-80 max-w-full flex-col overflow-hidden border-l text-xs shadow-md backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 id={`${id}-title`} className="font-medium">
            テーブルの設定
          </h2>
          <Button
            ref={closeButtonRef}
            size="icon-xs"
            variant="ghost"
            aria-label="設定を閉じる"
            onClick={onClose}
          >
            <PanelRightCloseIcon />
          </Button>
        </div>
        <p id={`${id}-description`} className="sr-only">
          この表の状態のリセットと表示設定を変更します。
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3">
          {/* 見出しに出す操作ボタン。固定中の列は、ボタンを隠していても見出しの行に出す */}
          {(capabilities.columnPinning || capabilities.grouping) && (
            <SettingsSection
              title="見出しのボタン"
              action={capabilities.columnPinning && <PinnedColumnsBadge />}
            >
              <div className="flex flex-wrap gap-1.5">
                {capabilities.columnPinning && (
                  <ToggleChip
                    icon={<PinIcon />}
                    label="固定"
                    accessibleName="見出しに固定ボタンを表示する"
                    checked={layout.showColumnPinningButtons}
                    onCheckedChange={(checked) =>
                      onChangeLayout({ showColumnPinningButtons: checked })
                    }
                  />
                )}
                {capabilities.grouping && (
                  <ToggleChip
                    icon={<GroupIcon />}
                    label="グループ化"
                    accessibleName="見出しにグループ化ボタンを表示する"
                    checked={layout.showColumnGroupingButtons}
                    onCheckedChange={(checked) =>
                      onChangeLayout({ showColumnGroupingButtons: checked })
                    }
                  />
                )}
              </div>
            </SettingsSection>
          )}

          {/* 操作列の可視性は、通常列の表示メニューとは独立して切り替える */}
          {(capabilities.rowSelection || capabilities.rowPinning) && (
            <SettingsSection title="操作列">
              <div className="flex flex-wrap gap-1.5">
                {capabilities.rowSelection && (
                  <ToggleChip
                    icon={<SquareCheckIcon />}
                    label="行選択"
                    accessibleName="行選択列を表示する"
                    checked={layout.showRowSelectionColumn}
                    onCheckedChange={(checked) =>
                      onChangeLayout({ showRowSelectionColumn: checked })
                    }
                  />
                )}
                {capabilities.rowPinning && (
                  <ToggleChip
                    icon={<ArrowUpToLineIcon />}
                    label="行固定"
                    accessibleName="上下への行固定操作列を表示する"
                    checked={layout.showRowPinningColumn}
                    onCheckedChange={(checked) => onChangeLayout({ showRowPinningColumn: checked })}
                  />
                )}
              </div>
            </SettingsSection>
          )}

          {/* グループ化した列の扱い */}
          {capabilities.grouping && (
            <SettingsSection title="グループ化した列">
              <SegmentedControl
                name={`${idPrefix}-grouped-column-mode`}
                options={groupedColumnModeOptions}
                value={layout.groupedColumnMode}
                onValueChange={(groupedColumnMode) => onChangeLayout({ groupedColumnMode })}
              />
            </SettingsSection>
          )}

          <WidthSettings />

          {/* 高さ。指定・上限のときだけ、区画の下に入力欄を出す */}
          <SettingsSection title="高さ">
            <SegmentedControl
              name={`${idPrefix}-height-strategy`}
              options={heightStrategyOptions}
              value={layout.heightStrategy}
              onValueChange={(heightStrategy) => onChangeLayout({ heightStrategy })}
            />
            {(layout.heightStrategy === 'fixed' || layout.heightStrategy === 'max') && (
              <HeightInput
                label={layout.heightStrategy === 'fixed' ? '高さ（px）' : '高さの上限（px）'}
                value={layout.height}
                onChangeValue={(height) => onChangeLayout({ height })}
              />
            )}
          </SettingsSection>

          {/* リセット。表の状態と表示設定を区切って並べ、すべての取り消しは見出しの行に置く */}
          <div className="mt-auto border-t pt-3">
            <SettingsSection
              title="リセット"
              action={
                <Button size="sm" variant="outline" onClick={handleResetAll}>
                  <RotateCcwIcon />
                  すべて
                </Button>
              }
            >
              <div className="flex flex-wrap gap-1">
                {enabledResetActions.map(({ label, reset }) => (
                  <Button key={label} size="sm" variant="secondary" onClick={() => reset(table)}>
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 border-t border-dashed pt-1.5">
                <Button size="sm" variant="secondary" onClick={onResetLayout}>
                  表示設定
                </Button>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    )
  }

  /**
   * 固定中の列の数を示し、押すとすべての列の固定を解除するバッジ。
   *
   * @remarks
   * 見出しの固定ボタンを隠しても固定は残るため、固定中の列がある間はボタンの表示と関係なく出す。
   * 固定中の列がなければ何も描画しない。
   */
  function PinnedColumnsBadge() {
    const table = useTableContext()

    return (
      <table.Subscribe selector={(state) => countPinnedColumns(state.columnPinning)}>
        {(pinnedCount) =>
          pinnedCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`固定中の${pinnedCount}列の固定を解除`}
              title="列の固定を解除"
              onClick={() => table.resetColumnPinning(true)}
            >
              <PinOffIcon />
              {pinnedCount}
            </Button>
          )
        }
      </table.Subscribe>
    )
  }

  /**
   * テーブル幅の設定項目。枠の幅に広げるかと、列幅を固定するかを切り替える。
   *
   * @remarks
   * 固定列の位置は列幅の状態から求めるため、枠の幅に広げるか列幅の固定をやめると、
   * 実際の列幅とずれて固定列が重なる場合がある。固定中の列があってその組み合わせのときだけ、
   * 見出しの行に警告ボタンを出す。押すと、原因の設定と対処の操作を項目の中に開く。
   * 対処すると押したボタンが消えるため、対処した設定（列の固定の解除なら最初の設定）へフォーカスを移す。
   */
  function WidthSettings() {
    const table = useTableContext()
    const { capabilities, layout, onChangeLayout } = getTableMeta(table)
    const [isWarningOpen, setIsWarningOpen] = useState(false)
    const fullWidthInputRef = useRef<HTMLInputElement>(null)
    const tableFixedInputRef = useRef<HTMLInputElement>(null)
    const warningDetailsId = useId()
    const isOverlapProneWidth =
      capabilities.columnPinning && (layout.fullWidth || !layout.tableFixed)

    // 警告の対処を適用し、対処した設定へフォーカスを移す
    const resolveOverlap = (apply: () => void, focusTarget: RefObject<HTMLInputElement | null>) => {
      apply()
      focusTarget.current?.focus()
    }

    return (
      <table.Subscribe selector={(state) => countPinnedColumns(state.columnPinning)}>
        {(pinnedCount) => {
          const showsWarning = isOverlapProneWidth && pinnedCount > 0
          const isWarningExpanded = showsWarning && isWarningOpen

          return (
            <SettingsSection
              title="幅"
              action={
                showsWarning && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="固定列が重なる場合があります"
                    aria-expanded={isWarningExpanded}
                    aria-controls={isWarningExpanded ? warningDetailsId : undefined}
                    title="固定列が重なる場合があります"
                    className="text-amber-600 dark:text-amber-400"
                    onClick={() => setIsWarningOpen(!isWarningOpen)}
                  >
                    <TriangleAlertIcon />
                  </Button>
                )
              }
            >
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip
                  icon={<MoveHorizontalIcon />}
                  label="枠の幅に広げる"
                  inputRef={fullWidthInputRef}
                  checked={layout.fullWidth}
                  onCheckedChange={(checked) => onChangeLayout({ fullWidth: checked })}
                />
                <ToggleChip
                  icon={<LockIcon />}
                  label="列幅を固定"
                  accessibleName="列幅を固定する"
                  inputRef={tableFixedInputRef}
                  checked={layout.tableFixed}
                  onCheckedChange={(checked) => onChangeLayout({ tableFixed: checked })}
                />
              </div>

              {/* 警告の詳細: 原因の設定ごとに戻す操作を並べ、最後に列の固定の解除を置く */}
              {isWarningExpanded && (
                <div
                  id={warningDetailsId}
                  className="flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2"
                >
                  <p>
                    固定列の位置は列幅の状態から求めるため、次の設定では実際の列幅とずれて
                    固定列が重なる場合があります。
                  </p>
                  <ul className="flex flex-col gap-1">
                    {layout.fullWidth && (
                      <li className="flex items-center justify-between gap-2">
                        「枠の幅に広げる」がオン
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="「枠の幅に広げる」をオフにする"
                          onClick={() =>
                            resolveOverlap(
                              () => onChangeLayout({ fullWidth: false }),
                              fullWidthInputRef,
                            )
                          }
                        >
                          オフにする
                        </Button>
                      </li>
                    )}
                    {!layout.tableFixed && (
                      <li className="flex items-center justify-between gap-2">
                        「列幅を固定」がオフ
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="「列幅を固定」をオンにする"
                          onClick={() =>
                            resolveOverlap(
                              () => onChangeLayout({ tableFixed: true }),
                              tableFixedInputRef,
                            )
                          }
                        >
                          オンにする
                        </Button>
                      </li>
                    )}
                  </ul>
                  <div className="flex items-center justify-between gap-2 border-t border-amber-500/30 pt-1.5">
                    または、列の固定を解除する
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        resolveOverlap(() => table.resetColumnPinning(true), fullWidthInputRef)
                      }
                    >
                      <PinOffIcon />
                      解除する
                    </Button>
                  </div>
                </div>
              )}
            </SettingsSection>
          )
        }}
      </table.Subscribe>
    )
  }

  /** 先頭側・末尾側に固定している列の数。 */
  function countPinnedColumns(columnPinning: { start?: string[]; end?: string[] }) {
    return (columnPinning.start?.length ?? 0) + (columnPinning.end?.length ?? 0)
  }

  /**
   * 高さを指定・上限にする場合の、スクロール領域の高さ（CSS px）の入力欄。
   *
   * @remarks
   * 入力途中の文字列を保持し、{@link minHeight} 以上の有限の数値になったときだけ反映する。
   * 確定（blur・Enter）時に反映できない文字列なら、現在の値の表示に戻す。
   * 外から値が変わった場合（表示設定のリセットなど）は、入力欄をその値に置き換える。
   * 利用側が CSS の長さ（`'55vh'` など）で指定した値は、入力欄を空にして案内に示し、px で入力し直すまで使う。
   */
  function HeightInput({
    label,
    value,
    onChangeValue,
  }: {
    label: string
    value: TableHeightLength
    onChangeValue: (value: number) => void
  }) {
    const toText = (height: TableHeightLength) => (typeof height === 'number' ? String(height) : '')
    const [draft, setDraft] = useState({ value, text: toText(value) })

    // 外から値が変わったら、入力途中の文字列を置き換える
    if (draft.value !== value) setDraft({ value, text: toText(value) })

    const parse = (text: string) => {
      const parsed = Number(text)
      return text.trim() !== '' && Number.isFinite(parsed) && parsed >= minHeight
        ? parsed
        : undefined
    }

    return (
      // 「指定」の区画の真下に揃えて置き、単位は入力欄の後ろに添える
      <div className="flex items-center justify-end gap-1">
        <Input
          type="number"
          aria-label={label}
          min={minHeight}
          step={40}
          value={draft.text}
          placeholder={typeof value === 'string' ? value : undefined}
          onChange={(event) => {
            const parsed = parse(event.target.value)
            setDraft({ value: parsed ?? value, text: event.target.value })
            if (parsed !== undefined && parsed !== value) onChangeValue(parsed)
          }}
          onBlur={() => {
            if (parse(draft.text) === undefined) setDraft({ value, text: toText(value) })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && parse(draft.text) === undefined) {
              setDraft({ value, text: toText(value) })
            }
          }}
          className="h-6 w-20 px-1.5 text-right text-[11px] md:text-[11px]"
        />
        <span aria-hidden className="text-muted-foreground">
          px
        </span>
      </div>
    )
  }

  return { SettingsPanel }
}
