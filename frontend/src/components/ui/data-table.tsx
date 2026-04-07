"use client";

import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function DataTable<T extends object = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = "No hay datos disponibles",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-dark-700" role="status" aria-label="Cargando datos">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-dark-700 bg-dark-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-semibold text-dark-300"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-dark-700/50 bg-dark-800"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-dark-700" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dark-700 bg-dark-800 p-12 text-center">
        <p className="text-dark-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-dark-700">
      <table className="w-full" role="table">
        <thead>
          <tr className="border-b border-dark-700 bg-dark-900">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-left text-sm font-semibold text-dark-300"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-dark-700/50 bg-dark-800 transition-colors hover:bg-dark-700/50"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-sm text-dark-200"
                >
                  {col.render
                    ? col.render(item)
                    : ((item as Record<string, unknown>)[col.key] as ReactNode) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
