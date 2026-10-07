// F-020 (docs/05 §2 pkt 4; wzorzec: sekcja kategorii z `home-setup-gear.html`, docs/08 §6): trzy kafle kategorii -
// zdjecie z manifestu (albo placeholder), nazwa, "6 modeli · od 299,00 zl" liczone z API, jeden odnosnik na kafel.
import { applyNbsp } from "@taktyl/domain";
import { ProductImage } from "@taktyl/ui";
import Link from "next/link";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import type { CategoryTile } from "../../lib/home/view";

export function CategoryTiles({ tiles }: { tiles: readonly CategoryTile[] }) {
  return (
    <section className="blok blok--kategorie" aria-labelledby="kategorie-tytul">
      <div className="kontener">
        <h2 id="kategorie-tytul" className="blok__tytul">
          Kategorie
        </h2>
        <ul className="lista kafle">
          {tiles.map((t) => (
            <li key={t.id} className="kafel">
              <div className="kafel__zdjecie">
                {t.image ? (
                  <ProductImage
                    entry={t.image.entry}
                    baseUrl={MEDIA_BASE_URL}
                    productName={t.image.productName}
                    colorName={t.image.colorName}
                    sizes="(min-width: 992px) 33vw, 100vw"
                    decorative
                  />
                ) : null}
              </div>
              <h3 className="kafel__nazwa">
                <Link href={t.href} className="kafel__link">
                  {applyNbsp(t.name)}
                </Link>
              </h3>
              <p className="kafel__opis">{t.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
