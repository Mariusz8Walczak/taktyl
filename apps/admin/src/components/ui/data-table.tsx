"use client";
// B-100, B-200 (docs/15 §7.1): tabela TanStack Table z sortowaniem po stronie serwera. Naglowki kolumn to przyciski
// (aria-sort), tabela ma naglowki th scope, przewija sie poziomo na waskim ekranie (okno z fokusem klawiatury).
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo } from "react";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Klucz sortowania w API (np. "name"); brak = kolumna niesortowalna. */
    sortKey?: string;
    numeric?: boolean;
    /** Przyklejona kolumna nazwy (telefon). */
    sticky?: boolean;
  }
}

export interface DataTableProps<T> {
  caption: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Sortowanie w formacie API: "name" albo "-name". */
  sort?: string;
  onSortChange?: (sort: string) => void;
  /** Wiersz klikalny przez pseudoelement jednego odnosnika w komorce. */
  linkRows?: boolean;
  getRowId?: (row: T) => string;
}

function toSorting(sort: string | undefined): SortingState {
  if (!sort) return [];
  return [{ id: sort.replace(/^-/, ""), desc: sort.startsWith("-") }];
}

export function DataTable<T>({
  caption,
  columns,
  data,
  sort,
  onSortChange,
  linkRows,
  getRowId,
}: DataTableProps<T>) {
  const sorting = useMemo(() => toSorting(sort), [sort]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  return (
    <div className="adm-tabela-okno" role="region" aria-label={caption} tabIndex={0}>
      <table className="adm-tabela">
        <caption className="tk-sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const key = meta?.sortKey;
                const active = key && sorting[0]?.id === key ? sorting[0] : null;
                const ariaSort = active
                  ? active.desc
                    ? "descending"
                    : "ascending"
                  : key
                    ? "none"
                    : undefined;
                const cls = [
                  meta?.numeric ? "adm-liczba" : "",
                  meta?.sticky ? "adm-kolumna-nazwy" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th key={header.id} scope="col" aria-sort={ariaSort} className={cls || undefined}>
                    {key && onSortChange ? (
                      <button
                        type="button"
                        className="adm-sortuj"
                        onClick={() => onSortChange(active && !active.desc ? `-${key}` : key)}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden="true">{active ? (active.desc ? "↓" : "↑") : ""}</span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className={linkRows ? "adm-wiersz-link" : undefined}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                const cls = [
                  meta?.numeric ? "adm-liczba" : "",
                  meta?.sticky ? "adm-kolumna-nazwy" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return meta?.sticky ? (
                  <th key={cell.id} scope="row" className={cls}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </th>
                ) : (
                  <td key={cell.id} className={cls || undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
