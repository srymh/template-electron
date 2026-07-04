export function ParameterDisplay({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <table className="w-full border-collapse border border-border text-xs not-italic">
      <thead>
        <tr>
          <th className="border border-border px-1 text-left">Parameter</th>
          <th className="border border-border px-1 text-left">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-border px-1 text-left">{row.label}</td>
            <td className="border border-border px-1 text-left">
              <pre>{row.value}</pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
