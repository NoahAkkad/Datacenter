export function DataTable({ columns, data, className = '' }) {
  return (
    <div className={`table-wrap ${className}`.trim()}>
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} className={column.headerClassName}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.length ? data.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => <td key={column.key} className={column.cellClassName}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="table-empty">No records to display.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
