"use client";
// B-102, B-103, B-112 (docs/15 par. 7.2): ekran /produkty/{id} - zakladki Dane i Warianty i ceny (Radix Tabs), prawa kolumna
// z odnosnikiem "Podglad w sklepie" i lista znacznikow odswiezanych po zapisie. Opis, Opinie, Zdjecia: kolejne zadania.
import * as Tabs from "@radix-ui/react-tabs";
import type { AdminProductDetail } from "@taktyl/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CATEGORY_LABEL, shopProductUrl } from "../../lib/format";
import { useProduct } from "../../lib/queries";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { ProductDataForm } from "./product-data-form";
import { VariantsTab } from "./variants-tab";

function Editor({ product }: { product: AdminProductDetail }) {
  const initial = useSearchParams().get("zakladka") === "warianty" ? "warianty" : "dane";
  const [tab, setTab] = useState(initial);
  const url = shopProductUrl(product.category, product.slug);
  return (
    <div className="adm-strona">
      <PageHeader title={product.name}>
        <p className="adm-licznik">
          {CATEGORY_LABEL[product.category]}, status:{" "}
          {product.status === "active" ? "aktywny" : "ukryty"}
        </p>
      </PageHeader>
      <nav aria-label="Okruszki">
        <Link className="tk-link" href="/produkty">
          Wróć do listy produktów
        </Link>
      </nav>
      <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List className="adm-zakladki__lista" aria-label="Sekcje produktu">
            <Tabs.Trigger className="adm-zakladki__wyzwalacz" value="dane">
              Dane
            </Tabs.Trigger>
            <Tabs.Trigger className="adm-zakladki__wyzwalacz" value="warianty">
              Warianty i ceny
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="adm-zakladki__tresc" value="dane">
            <ProductDataForm product={product} />
          </Tabs.Content>
          <Tabs.Content className="adm-zakladki__tresc" value="warianty">
            <VariantsTab product={product} />
          </Tabs.Content>
        </Tabs.Root>
        <aside className="adm-karta adm-stos" aria-labelledby="sklep">
          <h2 id="sklep">W sklepie</h2>
          <a className="tk-link" href={url} target="_blank" rel="noreferrer">
            Podgląd w sklepie
          </a>
          <p className="adm-powod">Zmiana pojawi się w sklepie w ciągu kilku sekund.</p>
          <h3>Odświeżane po zapisie</h3>
          <ul className="adm-lista adm-tekst-xs">
            <li>
              <code>product:{product.slug}</code>
            </li>
            <li>
              <code>category:{product.category}</code>
            </li>
            <li>
              <code>catalog</code>
            </li>
            <li>
              <code>presets</code> (przy cenie, stanie i statusie)
            </li>
          </ul>
          <Link className="tk-link" href={`/produkty/${product.id}/ceny`}>
            Historia cen wariantów
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function ProductEditor({ id }: { id: string }) {
  const query = useProduct(id);
  return (
    <QueryBoundary
      query={query}
      errorText="Nie udało się pobrać produktu."
      notFoundText="Nie ma takiego produktu."
    >
      {(product) => <Editor product={product} />}
    </QueryBoundary>
  );
}
