// F-130, F-131 (docs/05 §1): /porownaj. Katalog w wersji lekkiej czyta serwer (API, znaczniki jak karta produktu),
// wybor produktow (`taktyl.compare.v1`) zyje w przegladarce i jest rozstrzygany w wyspie.
import type { Metadata } from "next";
import { ComparePage } from "../../components/compare/compare-page";
import { loadCatalogLite } from "../../lib/compare/load-lite";

export const metadata: Metadata = { title: "Porównaj produkty" };

export default async function CompareRoute() {
  const catalog = await loadCatalogLite();
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">Porównaj produkty</h1>
      <p className="wstep">
        Zestaw obok siebie do czterech produktów jednej kategorii: cenę i wszystkie parametry.
      </p>
      <ComparePage catalog={catalog} />
    </div>
  );
}
