"use client";
// B-200, B-201, B-208 (docs/15 par. 8.1): lista zamowien - numer, data, status, dostawa, platnosc, wartosc, liczba pozycji,
// zamaskowany e-mail kontaktowy. Filtry w adresie: zetony statusow, metoda dostawy, zakres dat, numer. Paginacja serwerowa.
import {
  orderStatusSchema,
  shippingMethodIdSchema,
  type adminOrderRowSchema,
} from "@taktyl/contracts";
import { Alert, Button, Field, FilterChip } from "@taktyl/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import {
  formatCount,
  formatDateTime,
  formatPLN,
  ORDER_COUNT,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  SHIPPING_LABEL,
  SITE_URL,
} from "../../lib/format";
import { useOrders, type OrderListParams } from "../../lib/queries";
import { useUrlState } from "../../lib/use-url-state";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-state";

type Row = z.infer<typeof adminOrderRowSchema>;
const PER_PAGE = 25;

export function OrdersList() {
  const url = useUrlState();
  const [number, setNumber] = useState(url.get("number"));

  useEffect(() => {
    const t = setTimeout(() => {
      if (number !== url.get("number"))
        url.set({ number: number.trim().toUpperCase() || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [number]);

  const status = orderStatusSchema.safeParse(url.get("status"));
  const shipping = shippingMethodIdSchema.safeParse(url.get("shipping_method"));
  const params: OrderListParams = {
    page: Number(url.get("page")) || 1,
    per_page: PER_PAGE,
    sort: url.get("sort") || "-created_at",
    ...(status.success ? { status: status.data } : {}),
    ...(shipping.success ? { shipping_method: shipping.data } : {}),
    ...(url.get("from") ? { from: url.get("from") } : {}),
    ...(url.get("to") ? { to: url.get("to") } : {}),
    ...(url.get("number") ? { number: url.get("number") } : {}),
  };
  const query = useOrders(params);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      [
        {
          id: "number",
          header: "Numer",
          meta: { sortKey: "number", sticky: true },
          cell: ({ row }: { row: { original: Row } }) => (
            <Link className="tk-link" href={`/zamowienia/${row.original.number}`}>
              {row.original.number}
            </Link>
          ),
        },
        {
          id: "created_at",
          header: "Data",
          meta: { sortKey: "created_at" },
          cell: ({ row }: { row: { original: Row } }) => formatDateTime(row.original.created_at),
        },
        {
          id: "status",
          header: "Status",
          meta: { sortKey: "status" },
          cell: ({ row }: { row: { original: Row } }) => ORDER_STATUS_LABEL[row.original.status],
        },
        {
          id: "shipping",
          header: "Dostawa",
          cell: ({ row }: { row: { original: Row } }) =>
            SHIPPING_LABEL[row.original.shipping_method],
        },
        {
          id: "payment",
          header: "Płatność",
          cell: ({ row }: { row: { original: Row } }) => PAYMENT_LABEL[row.original.payment_type],
        },
        {
          id: "total_gr",
          header: "Wartość",
          meta: { sortKey: "total_gr", numeric: true },
          cell: ({ row }: { row: { original: Row } }) => (
            <span className="adm-liczba">{formatPLN(row.original.total_gr)}</span>
          ),
        },
        {
          id: "items",
          header: "Pozycje",
          meta: { numeric: true },
          cell: ({ row }: { row: { original: Row } }) => row.original.items_count,
        },
        {
          id: "contact",
          header: "Kontakt",
          cell: ({ row }: { row: { original: Row } }) =>
            row.original.contact_email || "Dane usunięte",
        },
      ] as unknown as ColumnDef<Row, unknown>[],
    [],
  );

  const clearAll = () => {
    setNumber("");
    url.clear();
  };

  return (
    <div className="adm-strona">
      <PageHeader
        title="Zamówienia"
        count={query.data ? formatCount(query.data.total, ORDER_COUNT) : undefined}
      />
      <div className="adm-narzedzia" role="search" aria-label="Filtry listy zamówień">
        <Field
          label="Numer zamówienia"
          hint="Np. TK-261007-AB12."
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <Field
          as="select"
          label="Metoda dostawy"
          value={url.get("shipping_method")}
          onChange={(e) => url.set({ shipping_method: e.target.value })}
        >
          <option value="">Wszystkie</option>
          {shippingMethodIdSchema.options.map((m) => (
            <option key={m} value={m}>
              {SHIPPING_LABEL[m]}
            </option>
          ))}
        </Field>
        <Field
          label="Od dnia"
          type="date"
          value={url.get("from")}
          onChange={(e) => url.set({ from: e.target.value })}
        />
        <Field
          label="Do dnia"
          type="date"
          value={url.get("to")}
          onChange={(e) => url.set({ to: e.target.value })}
        />
      </div>
      <div className="adm-zetony" role="group" aria-label="Status zamówienia">
        {orderStatusSchema.options.map((s) => (
          <FilterChip
            key={s}
            active={status.success && status.data === s}
            onClick={() => url.set({ status: status.success && status.data === s ? undefined : s })}
          >
            {ORDER_STATUS_LABEL[s]}
          </FilterChip>
        ))}
      </div>
      <QueryBoundary query={query} errorText="Nie udało się pobrać zamówień.">
        {(data) =>
          data.items.length === 0 ? (
            <div className="adm-stos">
              {url.hasAny ? (
                <>
                  <Alert variant="info">Nic tu nie pasuje do filtrów.</Alert>
                  <div>
                    <Button variant="secondary" onClick={clearAll}>
                      Wyczyść filtry
                    </Button>
                  </div>
                </>
              ) : (
                <Alert variant="info">
                  Nie ma jeszcze zamówień. Złóż pierwsze w sklepie demonstracyjnym.{" "}
                  <a className="tk-link" href={SITE_URL} target="_blank" rel="noreferrer">
                    Otwórz sklep
                  </a>
                </Alert>
              )}
            </div>
          ) : (
            <>
              <DataTable
                caption="Lista zamówień"
                columns={columns}
                data={data.items}
                sort={params.sort}
                onSortChange={(sort) => url.set({ sort })}
                linkRows
                getRowId={(r) => r.number}
              />
              <Pagination
                page={data.page}
                perPage={data.per_page}
                total={data.total}
                onPage={(page) => url.set({ page: String(page) }, true)}
              />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
