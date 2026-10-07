// F-040, F-242 (docs/05 §2 pkt 7; wzorzec: siatka produktow z `home-setup-gear.html`, jeden styl karty w serwisie,
// docs/08 §6): osiem polecanych produktow - po 3 klawiatury i myszki oraz 2 podkladki, sortowanie "Polecane".
// Karty to istniejacy `ProductCard`; lista pomiaru to `polecane` (docs/10 §3).
import { getColors, getListing, getProduct, getSwitches } from "../../lib/api";
import { buildCardView, cardTrackSource } from "../../lib/catalog/card-view";
import { FEATURED_PER_CATEGORY, LIST_FEATURED } from "../../lib/home/view";
import { buildItem } from "../../lib/track-items";
import { ProductCard } from "../listing/product-card";
import { ListTracker } from "./list-tracker";
import "../../styles/listing.css";

type FeaturedCategory = keyof typeof FEATURED_PER_CATEGORY;
const CATEGORIES = Object.keys(FEATURED_PER_CATEGORY) as FeaturedCategory[];

export async function Featured() {
  const [colors, switches, lists] = await Promise.all([
    getColors(),
    getSwitches(),
    Promise.all(
      CATEGORIES.map((category) =>
        getListing({
          category,
          filters: {},
          sort: "polecane",
          limit: FEATURED_PER_CATEGORY[category],
        }),
      ),
    ),
  ]);
  const cards = lists.flatMap((l, i) =>
    l.items.slice(0, FEATURED_PER_CATEGORY[CATEGORIES[i] as FeaturedCategory]),
  );
  const products = await Promise.all(cards.map((c) => getProduct(c.slug, c.category)));
  const ctx = { colors, switches };
  const views = cards.flatMap((card, i) => {
    const product = products[i];
    return product ? [buildCardView(card, product, ctx)] : [];
  });
  const sources = views.map((v, index) => ({
    ...cardTrackSource(v, LIST_FEATURED.name, index),
    listId: LIST_FEATURED.id,
  }));
  return (
    <section className="blok blok--polecane" aria-labelledby="polecane-tytul">
      <div className="kontener">
        <h2 id="polecane-tytul" className="blok__tytul">
          Polecane
        </h2>
        <ListTracker
          listId={LIST_FEATURED.id}
          listName={LIST_FEATURED.name}
          items={sources.map((s) => buildItem(s))}
        >
          <ul className="lista siatka" data-kolumny="4">
            {views.map((v, i) => (
              <ProductCard key={v.id} view={v} track={sources[i] as (typeof sources)[number]} />
            ))}
          </ul>
        </ListTracker>
      </div>
    </section>
  );
}
