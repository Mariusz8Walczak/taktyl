// F-111, F-242 (docs/05 §2 pkt 6; wzorzec: lookbook / karty kolekcji z `home-setup-gear.html`, docs/08 §6): cztery
// karty gotowych setow z API (ceny liczy API z domeny). Trzy elementy (zdjecie z manifestu albo placeholder), nazwa,
// `note`, "Razem ... · oszczedzasz ..." i "Otworz w kreatorze". Pomiar: view_item_list i select_item (list-tracker).
import { applyNbsp } from "@taktyl/domain";
import { ProductImage, VisuallyHidden } from "@taktyl/ui";
import Link from "next/link";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import { LIST_PRESETS, type PresetCard } from "../../lib/home/view";
import type { TrackItem } from "../../lib/track-events";
import { ListTracker } from "./list-tracker";

export function PresetCards({ cards, percent }: { cards: readonly PresetCard[]; percent: number }) {
  const items: TrackItem[] = cards.flatMap((c) => c.trackItems);
  return (
    <section id="gotowe-sety" className="blok blok--sety" aria-labelledby="sety-tytul">
      <div className="kontener">
        <h2 id="sety-tytul" className="blok__tytul">
          Gotowe sety
        </h2>
        <p className="blok__wstep">
          {applyNbsp(
            `Zestawy dobrane do profilu, z rabatem ${percent}% za komplet. Otwórz w kreatorze i zmień, co chcesz.`,
          )}
        </p>
        <ListTracker listId={LIST_PRESETS.id} listName={LIST_PRESETS.name} items={items}>
          <ul className="lista sety">
            {cards.map((c) => (
              <li key={c.id} className="set" data-track-items={JSON.stringify(c.trackItems)}>
                <ul className="lista set__elementy" aria-label={`Elementy setu ${c.name}`}>
                  {c.items.map((it) => (
                    <li key={it.sku} className="set__element">
                      <div className="set__zdjecie">
                        <ProductImage
                          entry={it.entry}
                          baseUrl={MEDIA_BASE_URL}
                          productName={it.productName}
                          colorName={it.colorName}
                          sizes="(min-width: 992px) 8vw, 25vw"
                          decorative
                        />
                      </div>
                      <span className="set__element-nazwa">{it.productName}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="set__nazwa">{applyNbsp(c.name)}</h3>
                <p className="set__opis">{applyNbsp(c.note)}</p>
                <p className="set__razem">{c.totalText}</p>
                <Link href={c.href} className="tk-btn tk-btn--poboczny set__akcja">
                  Otwórz w kreatorze
                  <VisuallyHidden>{`: ${c.name}`}</VisuallyHidden>
                </Link>
              </li>
            ))}
          </ul>
        </ListTracker>
      </div>
    </section>
  );
}
