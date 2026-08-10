import { DebouncedInput } from './debounced-input'

/**
 * グローバルフィルターコンポーネント
 * @param props.globalFilter グローバルフィルター値
 * @param props.onChangeGlobalFilter グローバルフィルター変更ハンドラ
 */
export function GlobalFilter(props: {
  globalFilter: string
  onChangeGlobalFilter: (value: string) => void
}) {
  'use no memo'

  const { globalFilter = '', onChangeGlobalFilter } = props

  const handleChange = (value: string | number | undefined) => {
    onChangeGlobalFilter(String(value))
  }

  return (
    <div>
      <DebouncedInput
        value={globalFilter}
        onChange={handleChange}
        className="w-full"
        placeholder="すべての列を検索..."
      />
    </div>
  )
}
