"use client";

interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  maxHeight?: string;
  emptyLabel?: string;
}

export default function DataTable({
  columns,
  rows,
  maxHeight = "50vh",
  emptyLabel = "No rows to display.",
}: DataTableProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div
      className="overflow-auto rounded-lg border border-slate-200"
      style={{ maxHeight }}
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map((col) => (
                <td
                  key={col}
                  className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700"
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
