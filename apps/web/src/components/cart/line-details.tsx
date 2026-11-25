"use client";
// F-150, F-151, F-256 (audyt P1-4; wzorzec: miniatura i opis pozycji w `view-cart.html`, docs/08 §6): miniatura
// pozycji (render z manifestu albo probki kolorow konfiguracji wlasnej - colors.json -> swatch, wyjatek reguly 2),
// wariant po ludzku i rozwijana lista czesci konfiguracji. Bez opisu (blad sieci) zostaje SKU jak dotad.
import { ProductImage } from "@taktyl/ui";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import type { CartSkuDetails } from "../../lib/cart/details";

export function LineThumb({ details }: { details: CartSkuDetails | undefined }) {
  if (details?.image) {
    return (
      <div className="koszyk-poz__miniatura">
        <ProductImage
          entry={details.image}
          baseUrl={MEDIA_BASE_URL}
          productName={details.productName}
          colorName={details.colorName}
          sizes="4rem"
          decorative
        />
      </div>
    );
  }
  const swatches = [
    ...new Set((details?.parts ?? []).flatMap((p) => (p.swatch ? [p.swatch] : []))),
  ].slice(0, 3);
  return (
    <div className="koszyk-poz__miniatura koszyk-poz__miniatura--probki" aria-hidden="true">
      {swatches.map((s) => (
        <span key={s} className="koszyk-poz__probka" style={{ backgroundColor: s }} />
      ))}
    </div>
  );
}

export function LineVariant({
  sku,
  details,
}: {
  sku: string;
  details: CartSkuDetails | undefined;
}) {
  if (!details) return <span className="koszyk-poz__sku">SKU: {sku}</span>;
  return (
    <>
      <span className="koszyk-poz__wariant">{details.variant}</span>
      {details.parts && details.parts.length > 0 ? (
        <details className="koszyk-poz__konfiguracja">
          <summary>Twoja konfiguracja</summary>
          <ul className="lista koszyk-poz__czesci">
            {details.parts.map((p) => (
              <li key={p.label}>
                {p.swatch ? (
                  <span
                    className="koszyk-poz__probka"
                    style={{ backgroundColor: p.swatch }}
                    aria-hidden="true"
                  />
                ) : null}
                {p.label}: {p.value}
              </li>
            ))}
          </ul>
          <span className="koszyk-poz__sku">Kod zestawienia: {sku}</span>
        </details>
      ) : null}
    </>
  );
}
