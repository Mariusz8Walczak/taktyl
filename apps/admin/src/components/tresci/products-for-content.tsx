"use client";
// B-300 (docs/15 par. 9): lista produktow jako punkt wejscia do edycji opisu.
import type { adminProductRowSchema } from "@taktyl/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import type { z } from "zod";
import { CATEGORY_LABEL, formatCount, PRODUCT_COUNT } from "../../lib/format";
import { useProducts } from "../../lib/queries";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";

type Row = z.infer<typeof adminProductRowSchema>;

export function ProductsForDescriptions() {
  const query = useProducts({ page: 1, per_page: 100, sort: "name" });
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      [
        {
          id: "name",
          header: "Produkt",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: Row } }) => (
            <Link className="tk-link" href={`/tresci/opisy/${row.original.id}`}>
              {row.original.name}
            </Link>
          ),
        },
        {
          id: "category",
          header: "Kategoria",
          cell: ({ row }: { row: { original: Row } }) => CATEGORY_LABEL[row.original.category],
        },
        {
          id: "status",
          header: "Status produktu",
          cell: ({ row }: { row: { original: Row } }) =>
            row.original.status === "active" ? "Aktywny" : "Ukryty",
        },
      ] as unknown as ColumnDef<Row, unknown>[],
    [],
  );
  return (
    <div className="adm-strona">
      <QueryBoundary query={query} errorText="Nie udało się pobrać produktów.">
        {(data) => (
          <>
            <PageHeader title="Opisy produktów" count={formatCount(data.total, PRODUCT_COUNT)} />
            <nav aria-label="Okruszki">
              <Link className="tk-link" href="/tresci">
                Wróć do treści
              </Link>
            </nav>
            {data.items.length === 0 ? (
              <p>Nie ma jeszcze produktów.</p>
            ) : (
              <DataTable
                caption="Produkty i ich opisy"
                columns={columns}
                data={data.items}
                getRowId={(r) => r.id}
              />
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
