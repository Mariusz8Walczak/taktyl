"use client";
// B-304, B-305 (docs/15 par. 9.1): lista stron informacyjnych/prawnych albo artykulow poradnika - tytul, status, data zmiany.
import type { AdminContent } from "@taktyl/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { CONTENT_STATUS_LABEL, GUIDE_COUNT, PAGE_COUNT } from "../../lib/content-labels";
import { formatCount, formatDateTime } from "../../lib/format";
import { useContent } from "../../lib/queries";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";

export function ContentList({ type }: { type: "page" | "guide" }) {
  const query = useContent(type);
  const base = type === "page" ? "/tresci/strony" : "/tresci/poradnik";
  const columns = useMemo<ColumnDef<AdminContent, unknown>[]>(
    () =>
      [
        {
          id: "title",
          header: "Tytuł",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: AdminContent } }) => (
            <Link className="tk-link" href={`${base}/${row.original.slug}`}>
              {row.original.title}
            </Link>
          ),
        },
        {
          id: "slug",
          header: "Adres",
          cell: ({ row }: { row: { original: AdminContent } }) => row.original.slug,
        },
        {
          id: "status",
          header: "Status",
          cell: ({ row }: { row: { original: AdminContent } }) =>
            CONTENT_STATUS_LABEL[row.original.status],
        },
        {
          id: "updated",
          header: "Zmieniono",
          cell: ({ row }: { row: { original: AdminContent } }) =>
            formatDateTime(row.original.updated_at),
        },
      ] as unknown as ColumnDef<AdminContent, unknown>[],
    [base],
  );
  const title = type === "page" ? "Strony informacyjne i prawne" : "Poradniki";
  return (
    <div className="adm-strona">
      <QueryBoundary
        query={query}
        errorText={`Nie udało się pobrać listy: ${title.toLowerCase()}.`}
      >
        {(data) => (
          <>
            <PageHeader
              title={title}
              count={formatCount(data.items.length, type === "page" ? PAGE_COUNT : GUIDE_COUNT)}
            />
            <nav aria-label="Okruszki">
              <Link className="tk-link" href="/tresci">
                Wróć do treści
              </Link>
            </nav>
            {data.items.length === 0 ? (
              <p>Nie ma jeszcze treści w tej sekcji.</p>
            ) : (
              <DataTable
                caption={title}
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
