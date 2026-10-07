// F-040, F-041, F-044, A-09 (wzorzec: karta produktu `product-style-0X` z docs/08 §3, jeden styl w calym serwisie).
// Komponent serwerowy: cala karta klikalna przez JEDEN odnosnik na nazwie (pseudoelement ::after), zdjecie 1:1 przez
// ProductImage z manifestu, 3 parametry kluczowe z atrybutow, cena "od X zl" z Omnibusem przy promocji, plakietki,
// probki kolorow z nazwa. Drugie ujecie (A-09) tylko gdy manifest ma gotowe zdjecie i tylko dla pointer:fine (CSS).
// HAK na F-042/F-043 (TAKTYL-59): "Szybko dodaj" wejdzie do `.karta__zdjecie` jako element `position: relative`
// (powyzej pseudoelementu odnosnika), dostepny bez najechania (docs/11 pulapka 13). Tu go jeszcze nie ma.
import { formatPLN } from "@taktyl/domain";
import { Badge, ProductImage } from "@taktyl/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { toManifestEntry, MEDIA_BASE_URL } from "../../lib/catalog/images";
import type { CardView } from "../../lib/catalog/card-view";
import { buildItem, type TrackLineSource } from "../../lib/track-items";

export interface ProductCardProps {
  view: CardView;
  /** Zrodlo `items[]` dla select_item / view_item_list (docs/10 §3). */
  track: TrackLineSource;
  /** Pierwsze karty: zdjecie z fetchpriority=high (docs/11 pulapka 16). */
  priority?: boolean;
}

const SIZES = "(min-width: 992px) 25vw, 50vw";

export function ProductCard({ view, track, priority = false }: ProductCardProps) {
  const promo = view.omnibusGr !== null;
  const vt = { "--vt": `karta-${view.id}` } as CSSProperties; // A-14: unikalna nazwa z ID produktu (pulapka 23)
  return (
    <li
      className="karta"
      style={vt}
      data-track-item={JSON.stringify(buildItem(track))}
      data-product-id={view.id}
    >
      <div className="karta__zdjecie">
        {view.image ? (
          <ProductImage
            entry={toManifestEntry(view.image)}
            baseUrl={MEDIA_BASE_URL}
            productName={view.name}
            colorName={view.colorName}
            sizes={SIZES}
            priority={priority}
            className="karta__obraz"
          />
        ) : null}
        {view.secondImage ? (
          <ProductImage
            entry={toManifestEntry(view.secondImage)}
            baseUrl={MEDIA_BASE_URL}
            productName={view.name}
            colorName={view.colorName}
            sizes={SIZES}
            className="karta__obraz karta__obraz--drugie"
          />
        ) : null}
        {view.badges.length > 0 ? (
          <ul className="karta__plakietki lista" aria-label="Oznaczenia">
            {view.badges.map((b) => (
              <li key={b.variant}>
                <Badge variant={b.variant}>{b.text}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="karta__tresc">
        <h3 className="karta__nazwa">
          <Link href={view.href} className="karta__link">
            {view.name}
          </Link>
        </h3>
        <dl className="karta__param">
          {view.params.map((p) => (
            <div key={p.label} className="karta__param-wiersz">
              <dt>{p.label}</dt>
              <dd>{p.value}</dd>
            </div>
          ))}
        </dl>
        <p className="karta__cena">
          <span className="karta__od">od</span>{" "}
          <span className={promo ? "karta__kwota karta__kwota--promocja" : "karta__kwota"}>
            {formatPLN(view.priceGr)}
          </span>
          {promo && view.omnibusGr !== null ? (
            <>
              {" "}
              <del className="karta__przekreslona">{formatPLN(view.omnibusGr)}</del>
            </>
          ) : null}
        </p>
        {view.omnibusText ? <p className="karta__omnibus">{view.omnibusText}</p> : null}
        <ul className="karta__probki lista" aria-label="Dostępne kolory">
          {view.colors.map((c) => (
            <li key={c.id} className="karta__probka">
              <span
                className="tk-probka__kolo"
                style={{ "--tk-swatch": c.swatch } as CSSProperties}
                aria-hidden="true"
              />
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
