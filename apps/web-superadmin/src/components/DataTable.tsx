import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  keyFor,
  emptyMessage = 'Sin resultados.',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ash">
      <table className="w-full min-w-[640px] border-collapse text-body">
        <thead>
          <tr className="border-b border-ash bg-paper-mist text-left">
            {columns.map((column) => (
              <th
                key={column.header}
                className={`px-12 py-8 text-caption font-medium uppercase tracking-wide text-fog ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-12 py-24 text-center text-body text-fog"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={keyFor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'border-b border-ash last:border-0',
                  onRowClick ? 'cursor-pointer hover:bg-paper-mist/60' : '',
                ].join(' ')}
              >
                {columns.map((column) => (
                  <td key={column.header} className={`px-12 py-10 text-charcoal ${column.className ?? ''}`}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
