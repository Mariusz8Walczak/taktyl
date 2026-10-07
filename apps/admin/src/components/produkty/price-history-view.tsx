"use client";
// B-105 (docs/15 par. 7.3): /produkty/{id}/ceny - wybor wariantu, tabela historii (Data, Cena, Zmienil), blok "Cena przy
// obnizce": aktualna cena, najnizsza z 30 dni (wyliczona, tylko do odczytu), plakietka, zdanie dla klienta. Nic nie edytujemy.
import type { AdminProductDetail } from "@taktyl/contracts";
import { promotionPercent } from "@taktyl/domain";
import { Alert, Field } from "@taktyl/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { formatDateTime, formatPLN } from "../../lib/format";
import { usePriceHistory, useProduct } from "../../lib/queries";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { Skeleton } from "../ui/skeleton";

interface Entry {
  price_gr: number;
  valid_from: string;
  valid_to: string | null;
  changed_by: string | null;
  reason: string | null;
}

function Prices({ product }: { product: AdminProductDetail }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("sku");
  const sku =
    product.variants.find((v) => v.sku === requested)?.sku ?? product.variants[0]?.sku ?? null;
  const variant = product.variants.find((v) => v.sku === sku);
  const history = usePriceHistory(sku);

  const columns = useMemo<ColumnDef<Entry, unknown>[]>(
    () =>
      [
        {
          id: "at",
          header: "Data",
          cell: ({ row }: { row: { original: Entry } }) => formatDateTime(row.original.valid_from),
        },
        {
          id: "price",
          header: "Cena",
          meta: { numeric: true },
          cell: ({ row }: { row: { original: Entry } }) => (
            <span className="adm-liczba">{formatPLN(row.original.price_gr)}</span>
          ),
        },
        {
          id: "by",
          header: "Zmienił",
          cell: ({ row }: { row: { original: Entry } }) => row.original.changed_by ?? "seed",
        },
        {
          id: "reason",
          header: "Powód",
          cell: ({ row }: { row: { original: Entry } }) => row.original.reason ?? "",
        },
      ] as unknown as ColumnDef<Entry, unknown>[],
    [],
  );

  if (!variant || !sku) return <Alert variant="info">Ten produkt nie ma jeszcze wariantów.</Alert>;
  const lowest = history.data?.lowest_30d_gr ?? null;
  const percent = promotionPercent(lowest, variant.price_gr);

  return (
    <div className="adm-strona">
      <PageHeader title={`Historia cen: ${product.name}`} />
      <nav aria-label="Okruszki">
        <Link className="tk-link" href={`/produkty/${product.id}?zakladka=warianty`}>
          Wróć do edycji produktu
        </Link>
      </nav>
      <Field
        as="select"
        label="Wariant"
        value={sku}
        onChange={(e) =>
          router.replace(`/produkty/${product.id}/ceny?sku=${encodeURIComponent(e.target.value)}`, {
            scroll: false,
          })
        }
      >
        {product.variants.map((v) => (
          <option key={v.sku} value={v.sku}>
            {v.sku}
          </option>
        ))}
      </Field>
      {history.isPending ? (
        <Skeleton label="Wczytywanie historii cen" />
      ) : history.isError ? (
        <Alert variant="blad">Nie udało się pobrać historii cen.</Alert>
      ) : history.data.entries.length === 0 ? (
        <Alert variant="info">Ten wariant nie ma jeszcze historii cen.</Alert>
      ) : (
        <DataTable
          caption={`Historia cen wariantu ${sku}`}
          columns={columns}
          data={[...history.data.entries].reverse()}
        />
      )}
      <section className="adm-karta" aria-labelledby="omnibus">
        <h2 id="omnibus">Cena przy obniżce</h2>
        <dl className="adm-dl">
          <dt>Aktualna cena</dt>
          <dd className="adm-tylko-odczyt">{formatPLN(variant.price_gr)}</dd>
          <dt>Najniższa z 30 dni</dt>
          <dd className="adm-tylko-odczyt">
            {lowest === null ? "Brak (wariant nie jest w promocji)" : formatPLN(lowest)}
          </dd>
          <dt>Plakietka</dt>
          <dd className="adm-tylko-odczyt">{percent === null ? "Brak" : `−${percent}%`}</dd>
          <dt>Zdanie dla klienta</dt>
          <dd className="adm-tylko-odczyt">
            {lowest === null
              ? "Nie jest pokazywane."
              : `„Najniższa cena z 30 dni przed obniżką: ${formatPLN(lowest)}”`}
          </dd>
        </dl>
        <p className="adm-powod">
          Liczone z historii cen z ostatnich 30 dni. Nie wpisujesz tego ręcznie.
        </p>
      </section>
    </div>
  );
}

export function PriceHistoryView({ id }: { id: string }) {
  const query = useProduct(id);
  return (
    <QueryBoundary
      query={query}
      errorText="Nie udało się pobrać produktu."
      notFoundText="Nie ma takiego produktu."
    >
      {(product) => <Prices product={product} />}
    </QueryBoundary>
  );
}
