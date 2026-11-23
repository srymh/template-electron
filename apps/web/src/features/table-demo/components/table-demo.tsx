import { useState } from 'react'

import { NativeSelect, NativeSelectOption } from '@repo/ui/components/native-select'

import { DataTable, allCapabilities, rowSelectionColumnId } from '@/components/data-table'
import type {
  DataTableOptions,
  DataTableViewProps,
  TableCapabilities,
  TableCapability,
} from '@/components/data-table'

import { createDemoRows } from '../data/demo-rows'
import type { DemoRow } from '../data/demo-rows'
import { demoColumns } from './demo-columns'

// 生成データは画面の表示中は同じものを使い、再読み込みしても同じ内容になる
const demoRows = createDemoRows()

/** 検証ケース。表へ渡す設定と、確認する内容の説明を持つ。 */
type DemoScenario = {
  id: string
  label: string
  description: string
  /** 能力をこの画面で切り替えるか。`true` なら全能力を有効にした状態から切り替える。 */
  toggleCapabilities?: boolean
  options: Omit<DataTableOptions<DemoRow>, 'columns'>
  view?: DataTableViewProps<DemoRow>
}

const scenarios: DemoScenario[] = [
  {
    id: 'all',
    label: '全能力',
    description:
      '300行の生成データで、すべての能力を有効にした表。設定パネル・操作列・列ごとのクリアを確認する。',
    options: { data: demoRows, capabilities: allCapabilities },
  },
  {
    id: 'initial-state',
    label: '初期状態あり',
    description:
      '列幅・列表示（固定操作列を非表示）・列固定・行選択・行固定・列フィルター（種類=炎）を初期状態に持つ表。リセットの違いを確認する。',
    options: {
      data: demoRows,
      capabilities: allCapabilities,
      initialState: {
        columnVisibility: { optional: false },
        columnSizing: { name: 200, [rowSelectionColumnId]: 40 },
        columnPinning: { start: ['name'], end: ['note'] },
        rowSelection: { 'row-001': true },
        rowPinning: { top: ['row-003'], bottom: [] },
        columnFilters: [{ id: 'kind', value: '炎' }],
      },
      initialLayout: { showColumnFilters: true, showRowPinningColumn: false },
    },
  },
  {
    id: 'toggle',
    label: '能力の切り替え',
    description:
      '能力を画面上で切り替える表。無効にした能力の状態が解除され、再び有効にしても復元しないことを確認する。',
    toggleCapabilities: true,
    options: { data: demoRows },
  },
  {
    id: 'display',
    label: '表示のみ',
    description: '能力をすべて外し、設定パネルも出さない表示だけの表。',
    options: { data: demoRows.slice(0, 20) },
    view: { settings: false },
  },
  {
    id: 'empty',
    label: '0件',
    description: 'データが0件の表。「0件」の表示を確認する。',
    options: { data: [], capabilities: allCapabilities },
  },
  {
    id: 'no-match',
    label: '絞り込み0件',
    description: '一覧検索の初期値で該当が0件になる表。「該当なし」の表示を確認する。',
    options: {
      data: demoRows,
      capabilities: allCapabilities,
      initialState: { globalFilter: '該当しない検索語' },
    },
  },
]

/**
 * 共通テーブルの検証画面。生成データだけを使い、DB・認証・業務 API なしで表示する。
 *
 * @remarks
 * 上部で検証ケースを選び、選んだケースの表を残りの高さいっぱいに表示する。ケースを切り替えると
 * 表を作り直し、初期状態から確認できる。
 */
export function TableDemo() {
  const [scenarioId, setScenarioId] = useState(scenarios[0]!.id)
  const scenario = scenarios.find(({ id }) => id === scenarioId) ?? scenarios[0]!

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 検証ケースの選択と説明 */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label="検証ケース"
          value={scenario.id}
          onChange={(event) => setScenarioId(event.target.value)}
        >
          {scenarios.map(({ id, label }) => (
            <NativeSelectOption key={id} value={id}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-muted-foreground text-xs">{scenario.description}</p>
      </div>

      {scenario.toggleCapabilities ? (
        <CapabilityToggleTable key={scenario.id} scenario={scenario} />
      ) : (
        <DataTable
          key={scenario.id}
          label={scenario.label}
          columns={demoColumns}
          getRowId={(row) => row.id}
          {...scenario.options}
          {...scenario.view}
        />
      )}
    </div>
  )
}

/**
 * 能力を画面上の checkbox で切り替えながら表示する検証用の表。
 *
 * @remarks
 * 表は作り直さず、`capabilities` だけを変える。無効にした能力の状態は共通テーブルが既定値に戻す。
 */
function CapabilityToggleTable({ scenario }: { scenario: DemoScenario }) {
  const [capabilities, setCapabilities] = useState<TableCapabilities>(allCapabilities)

  return (
    <>
      {/* 能力の切り替え */}
      <fieldset className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-xs">
        <legend className="sr-only">能力</legend>
        {(Object.keys(capabilities) as TableCapability[]).map((capability) => (
          <label key={capability} className="flex items-center gap-1">
            <input
              type="checkbox"
              className="accent-primary"
              checked={capabilities[capability]}
              onChange={(event) =>
                setCapabilities((prev) => ({ ...prev, [capability]: event.target.checked }))
              }
            />
            {capability}
          </label>
        ))}
      </fieldset>
      <DataTable
        label={scenario.label}
        columns={demoColumns}
        getRowId={(row) => row.id}
        {...scenario.options}
        capabilities={capabilities}
        {...scenario.view}
      />
    </>
  )
}
