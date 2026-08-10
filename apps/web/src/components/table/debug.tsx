import type { Table } from '@tanstack/react-table'

export function DebugInfo<T>(props: {
  table: Table<T>
  rerender?: () => void
  refreshData?: () => void
}) {
  'use no memo'

  const { table, rerender, refreshData } = props

  return (
    <>
      <div className="mt-4 text-gray-400">{table.getPrePaginationRowModel().rows.length} Rows</div>
      <div className="mt-4 flex gap-2">
        {rerender && (
          <button
            onClick={() => rerender()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Force Rerender
          </button>
        )}
        {refreshData && (
          <button
            onClick={() => refreshData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        )}
      </div>
      <pre className="mt-4 p-4 bg-gray-800 rounded-lg text-gray-300 overflow-auto">
        {JSON.stringify(table.getState(), null, 2)}
      </pre>
    </>
  )
}
