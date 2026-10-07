"use client";
// B-100, B-101, B-110 (docs/15 par. 7.1): lista produktow - filtry w adresie (kategoria, status, szukaj z normalizacja "l"),
// kolumny z cena od i stanem laczym, plakietki, status tekstem, archiwizacja z "Cofnij". Skrot "/" ustawia fokus w polu szukaj.
import { categoryIdSchema, type adminProductRowSchema } from "@taktyl/contracts";
import { Alert, Badge, Button, Field, FilterChip, useToast } from "@taktyl/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import { catalogApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { CATEGORY_LABEL, formatCount, formatPLN, PRODUCT_COUNT } from "../../lib/format";
import { keys, useProducts, type ProductListParams } from "../../lib/queries";
import { useUrlState } from "../../lib/use-url-state";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-state";

type Row = z.infer<typeof adminProductRowSchema>;
const PER_PAGE = 25;
const SEARCH_ID = "szukaj-produkty";

export function ProductsList() {
  const url = useUrlState();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "catalog.write");
  const [q, setQ] = useState(url.get("q"));

  // B-101: wyszukiwanie z opoznieniem, wynik w adresie.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== url.get("q")) url.set({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // docs/15 par. 2: "/" ustawia fokus w polu szukaj; nie dziala w polach tekstowych (docs/11 pulapka 14).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, select, [contenteditable]") !== null) return;
      e.preventDefault();
      document.getElementById(SEARCH_ID)?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const category = url.get("category");
  const status = url.get("status");
  const params: ProductListParams = {
    page: Number(url.get("page")) || 1,
    per_page: PER_PAGE,
    sort: url.get("sort") || "-updated_at",
    ...(categoryIdSchema.safeParse(category).success ? { category: category as "klawiatury" } : {}),
    ...(status === "active" || status === "archived" ? { status } : {}),
    ...(url.get("promo") === "1" ? { promo: "1" as const } : {}),
    ...(url.get("low_stock") === "1" ? { low_stock: "1" as const } : {}),
    ...(url.get("q") ? { q: url.get("q") } : {}),
  };
  const query = useProducts(params);

  const toast = useToast();
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: ({ row, to }: { row: Row; to: "active" | "archived" }) =>
      catalogApi.patch(row.id, row.version, { status: to }),
    onSuccess: (detail, { row, to }) => {
      qc.setQueryData(keys.product(row.id), detail);
      void qc.invalidateQueries({ queryKey: keys.productsAll });
      toast.toast({
        message:
          to === "archived"
            ? `Zarchiwizowano: ${row.name}. Sklep odświeży stronę w kilka sekund.`
            : `Przywrócono: ${row.name}. Sklep odświeży stronę w kilka sekund.`,
        actionLabel: "Cofnij",
        onAction: () =>
          archive.mutate({
            row: { ...row, version: detail.version },
            to: to === "archived" ? "active" : "archived",
          }),
      });
    },
    onError: (e) => toast.toast({ message: describeError(e, "ten produkt").text }),
  });

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () =>
      [
        {
          id: "name",
          header: "Nazwa",
          meta: { sortKey: "name", sticky: true },
          cell: ({ row }: { row: { original: Row } }) => (
            <Link className="tk-link" href={`/produkty/${row.original.id}`}>
              {row.original.name}
            </Link>
          ),
        },
        {
          id: "category",
          header: "Kategoria",
          meta: { sortKey: "category" },
          cell: ({ row }: { row: { original: Row } }) => CATEGORY_LABEL[row.original.category],
        },
        {
          id: "variant_count",
          header: "Warianty",
          meta: { sortKey: "variant_count", numeric: true },
          cell: ({ row }: { row: { original: Row } }) => row.original.variant_count,
        },
        {
          id: "from_price_gr",
          header: "Cena od",
          meta: { sortKey: "from_price_gr", numeric: true },
          cell: ({ row }: { row: { original: Row } }) => (
            <span className="adm-liczba">{formatPLN(row.original.from_price_gr)}</span>
          ),
        },
        {
          id: "total_stock",
          header: "Stan łącznie",
          meta: { sortKey: "total_stock", numeric: true },
          cell: ({ row }: { row: { original: Row } }) =>
            row.original.total_stock.toLocaleString("pl-PL"),
        },
        {
          id: "badges",
          header: "Plakietki",
          cell: ({ row }: { row: { original: Row } }) => {
            const r = row.original;
            return (
              <span className="adm-wiersz">
                {r.badges.map((b) => (
                  <Badge key={b} variant={b} />
                ))}
                {r.on_sale ? <Badge variant="promocja" /> : null}
                {r.total_stock === 0 ? <Badge variant="brak" /> : null}
              </span>
            );
          },
        },
        {
          id: "status",
          header: "Status",
          meta: { sortKey: "status" },
          cell: ({ row }: { row: { original: Row } }) =>
            row.original.status === "active" ? "Aktywny" : "Ukryty",
        },
        {
          id: "akcje",
          header: "Akcje",
          cell: ({ row }: { row: { original: Row } }) => {
            const r = row.original;
            return (
              <Button
                variant="secondary"
                className="adm-nad-linkiem"
                disabled={!allowed}
                loading={archive.isPending && archive.variables?.row.id === r.id}
                onClick={() =>
                  archive.mutate({ row: r, to: r.status === "active" ? "archived" : "active" })
                }
              >
                {r.status === "active" ? "Archiwizuj" : "Przywróć"}
              </Button>
            );
          },
        },
      ] as unknown as ColumnDef<Row, unknown>[],
    [allowed, archive],
  );

  const clearAll = () => {
    setQ("");
    url.clear();
  };

  return (
    <div className="adm-strona">
      <PageHeader
        title="Produkty"
        count={query.data ? formatCount(query.data.total, PRODUCT_COUNT) : undefined}
      >
        {allowed ? (
          <Link href="/produkty/nowy" className="tk-btn tk-btn--glowny">
            Dodaj produkt
          </Link>
        ) : null}
      </PageHeader>
      {!allowed ? <p className="adm-powod">{reason}</p> : null}
      <div className="adm-narzedzia" role="search" aria-label="Filtry listy produktów">
        <Field
          id={SEARCH_ID}
          label="Szukaj po nazwie lub SKU"
          hint="Klawisz / ustawia fokus w tym polu."
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Field
          as="select"
          label="Kategoria"
          value={category}
          onChange={(e) => url.set({ category: e.target.value })}
        >
          <option value="">Wszystkie</option>
          {categoryIdSchema.options.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Field>
        <Field
          as="select"
          label="Status"
          value={status}
          onChange={(e) => url.set({ status: e.target.value })}
        >
          <option value="">Wszystkie</option>
          <option value="active">Aktywne</option>
          <option value="archived">Ukryte</option>
        </Field>
      </div>
      <div className="adm-zetony">
        <FilterChip
          active={url.get("promo") === "1"}
          onClick={() => url.set({ promo: url.get("promo") === "1" ? undefined : "1" })}
        >
          W promocji
        </FilterChip>
        <FilterChip
          active={url.get("low_stock") === "1"}
          onClick={() => url.set({ low_stock: url.get("low_stock") === "1" ? undefined : "1" })}
        >
          Niski stan (0 do 3 szt.)
        </FilterChip>
      </div>
      <QueryBoundary query={query} errorText="Nie udało się pobrać produktów.">
        {(data) =>
          data.items.length === 0 ? (
            <div className="adm-stos">
              <Alert variant="info">Nic tu nie pasuje do filtrów.</Alert>
              <div>
                <Button variant="secondary" onClick={clearAll}>
                  Wyczyść filtry
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DataTable
                caption="Lista produktów"
                columns={columns}
                data={data.items}
                sort={params.sort}
                onSortChange={(sort) => url.set({ sort })}
                linkRows
                getRowId={(r) => r.id}
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
