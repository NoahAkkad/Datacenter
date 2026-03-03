export function DataTable({ columns, data }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>{columns.map((column) => <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((row, index) => (
            <tr className="hover:bg-slate-50" key={row.id || index}>
              {columns.map((column) => <td className="px-4 py-3 text-sm text-slate-700" key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
