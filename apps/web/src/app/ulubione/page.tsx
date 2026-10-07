// F-132, F-045 (docs/05 §1): /ulubione. Katalog w wersji lekkiej czyta serwer, liste SKU (`taktyl.wishlist.v1`) wyspa.
import type { Metadata } from "next";
import { WishlistPage } from "../../components/wishlist/wishlist-page";
import { loadCatalogLite } from "../../lib/compare/load-lite";

export const metadata: Metadata = { title: "Ulubione" };

export default async function WishlistRoute() {
  const catalog = await loadCatalogLite();
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">Ulubione</h1>
      <p className="wstep">
        Produkty, do których chcesz wrócić. Lista jest zapisana w tej przeglądarce.
      </p>
      <WishlistPage catalog={catalog} />
    </div>
  );
}
