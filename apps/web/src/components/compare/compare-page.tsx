"use client";
// F-130, F-131 (wzorzec: tabela porownania `compare` / specyfikacja `product-detail`, docs/08 §6): /porownaj. Tabela
// <table> z <th scope="row"> w wierszach i <th scope="col"> w kolumnach: zdjecie (ProductImage), nazwa, cena, wszystkie
// atrybuty z docs/04 §4. "Pokaz tylko roznice", usuwanie produktu i "Wyczysc". Na telefonie przewijanie poziome z
// przyklejona kolumna nazw (sticky). Produkty z danych serwera (API), wybor z `taktyl.compare.v1`.
import { formatPLN } from "@taktyl/domain";
import { Button, ProductImage, VisuallyHidden } from "@taktyl/ui";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { hydratedSnapshot } from "../../lib/account/persisted-store";
import { toManifestEntry, MEDIA_BASE_URL } from "../../lib/catalog/images";
import { buildCompareRows } from "../../lib/compare/diff";
import type { LiteProduct } from "../../lib/compare/lite";
import { CATEGORY_PLURAL, COMPARE_MAX, compare, useCompareState } from "../../lib/compare/store";

export function ComparePage({ catalog }: { catalog: readonly LiteProduct[] }) {
  const { ids, category } = useCompareState();
  const hydrated = useSyncExternalStore(
    hydratedSnapshot.subscribe,
    hydratedSnapshot.client,
    hydratedSnapshot.server,
  );
  const [onlyDiff, setOnlyDiff] = useState(false);

  if (!hydrated) {
    return (
      <p className="porownaj__stan" role="status">
        Wczytuję porównanie…
      </p>
    );
  }

  const products = ids.flatMap((id) => catalog.find((p) => p.id === id) ?? []);
  if (products.length === 0) {
    return (
      <div className="pusty-stan">
        <p className="pusty-stan__tekst">
          Nie masz jeszcze nic w porównaniu. Dodaj do {COMPARE_MAX} produktów jednej kategorii
          przyciskiem „Porównaj” na liście albo na karcie produktu.
        </p>
        <div className="pusty-stan__akcje">
          <Link href="/klawiatury" className="tk-btn tk-btn--glowny">
            Zobacz klawiatury
          </Link>
          <Link href="/myszki" className="tk-btn tk-btn--poboczny">
            Zobacz myszki
          </Link>
          <Link href="/podkladki" className="tk-btn tk-btn--poboczny">
            Zobacz podkładki
          </Link>
        </div>
      </div>
    );
  }

  const all = buildCompareRows(products);
  const rows = onlyDiff ? all.filter((r) => r.differs) : all;
  const noDiff = products.length > 1 && all.every((r) => !r.differs);

  return (
    <div className="porownaj">
      <div className="porownaj__narzedzia">
        <label className="porownaj__przelacznik">
          <input
            type="checkbox"
            checked={onlyDiff}
            onChange={(e) => setOnlyDiff(e.currentTarget.checked)}
          />
          <span>Pokaż tylko różnice</span>
        </label>
        <Button variant="secondary" onClick={() => compare.clear()}>
          Wyczyść
        </Button>
      </div>
      <p className="porownaj__licznik" role="status">
        Porównujesz {products.length} z {COMPARE_MAX}: {CATEGORY_PLURAL[category ?? ""] ?? category}
        .{products.length === 1 ? " Dodaj kolejny produkt, żeby zobaczyć różnice." : ""}
        {onlyDiff ? ` Pokazano ${rows.length} z ${all.length} cech.` : ""}
      </p>

      <div
        className="porownaj__przewijanie"
        role="region"
        aria-label="Tabela porównania"
        tabIndex={0}
      >
        <table className="porownaj__tabela">
          <caption className="porownaj__opis-tabeli">
            Porównanie produktów: zdjęcie, cena i parametry
          </caption>
          <thead>
            <tr>
              <th scope="col" className="porownaj__narozne">
                Cecha
              </th>
              {products.map((p) => (
                <th scope="col" key={p.id} className="porownaj__produkt">
                  <div className="porownaj__zdjecie">
                    {p.image ? (
                      <ProductImage
                        entry={toManifestEntry(p.image)}
                        baseUrl={MEDIA_BASE_URL}
                        productName={p.name}
                        colorName={p.colorName}
                        sizes="12rem"
                      />
                    ) : null}
                  </div>
                  <Link href={p.href} className="porownaj__nazwa">
                    {p.name}
                  </Link>
                  <span className="porownaj__cena">od {formatPLN(p.fromGr)}</span>
                  <Button
                    variant="secondary"
                    className="porownaj__usun"
                    onClick={() => compare.remove(p.id)}
                  >
                    Usuń z porównania<VisuallyHidden>: {p.name}</VisuallyHidden>
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.differs ? "is-roznica" : undefined}>
                <th scope="row">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={products[i]?.id}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noDiff && onlyDiff ? (
        <p className="porownaj__stan">Wybrane produkty mają identyczne parametry.</p>
      ) : null}
    </div>
  );
}
