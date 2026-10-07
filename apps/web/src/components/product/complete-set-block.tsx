"use client";
// F-069, F-110 (docs/05 §4 pkt 12, docs/03 §1): blok "Dokoncz set" na karcie produktu - sekcja ciemna (.sekcja--mod),
// trzy elementy w rzedzie z wariantem do zmiany, cena setu z rabatem, "Otworz w kreatorze" (entry pdp_complete) i
// "Dodaj set do koszyka". Wzorzec: `product-frequently-bought-together.html` (docs/08 §3). Produkt z karty bierze
// wariant z wyboru powyzej (useProduct), pozostale dwa wybiera klient. Ceny i rabat z @taktyl/domain (priceSet).
import { formatPLN } from "@taktyl/domain";
import { Button, Field, ProductImage, useToast } from "@taktyl/ui";
import { useMemo, useState } from "react";
import { addSet } from "../../lib/cart-adapter";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import { colorLabel, packshotEntry, variantText } from "../../lib/builder/catalog";
import {
  createBlockModel,
  openInBuilderHref,
  type CompleteSetProps,
} from "../../lib/builder/complete-view";
import { trackSetAdded } from "../../lib/builder/events";
import { analyze } from "../../lib/builder/fit";
import { EMPTY_STATE, SLOTS, type SlotKey } from "../../lib/builder/types";
import { formatPLNShort } from "../../lib/format";
import { useProduct } from "./product-context";

export function CompleteSetBlock(props: CompleteSetProps) {
  const { variant: anchorVariant } = useProduct();
  const { toast } = useToast();
  const [chosen, setChosen] = useState<Record<SlotKey, string>>(props.skus);
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => createBlockModel(props), [props]);
  const skus: Record<SlotKey, string> = { ...chosen, [props.anchor]: anchorVariant.sku };
  const a = analyze(model, {
    ...EMPTY_STATE,
    profile: props.profile,
    k: skus.k,
    m: skus.m,
    p: skus.p,
  });
  const { k, m, p } = a.entries;
  if (!k || !m || !p) return null;

  const blocked = a.soldOut.length > 0;

  async function add() {
    if (busy || !k || !m || !p || blocked) return;
    setBusy(true);
    try {
      const res = await addSet({
        skus: [skus.k, skus.m, skus.p],
        profile: props.profile,
        presetId: null,
        name: "Twój set",
      });
      if (!res.ok) {
        toast({ message: "Nie udało się dodać setu do koszyka. Spróbuj ponownie." });
        return;
      }
      toast({ message: "Dodano set do koszyka" });
      trackSetAdded({
        model,
        entries: [k, m, p],
        discountGr: a.price.discount,
        profile: props.profile,
        presetId: null,
        warnings: a.report.warnings,
        listId: "dokoncz-set",
        listName: "Dokończ set",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="dokoncz-set"
      aria-labelledby="dokoncz-set-tytul"
      className="sekcja--mod dokoncz"
      data-testid="dokoncz-set"
    >
      <div className="dokoncz__wnetrze">
        <h2 id="dokoncz-set-tytul" className="dokoncz__tytul">
          Dokończ set
        </h2>
        <p className="dokoncz__wstep">
          Dobraliśmy pozostałe elementy do profilu „
          {props.rules.profiles[props.profile]?.label ?? props.profile}”. Za komplet klawiatury,
          myszki i podkładki dajemy rabat {props.setDiscount.percent}%.
        </p>
        <ul className="lista dokoncz__lista">
          {SLOTS.map((slot) => {
            const e = a.entries[slot];
            const bp = props.products.find((x) => x.id === e?.product.id);
            const bv = bp?.variants.find((v) => v.sku === e?.variant.sku);
            if (!e || !bp || !bv) return null;
            const isAnchor = slot === props.anchor;
            return (
              <li key={slot} className="dokoncz__pozycja">
                <div className="dokoncz__zdjecie">
                  <ProductImage
                    entry={packshotEntry(bp, bv)}
                    baseUrl={MEDIA_BASE_URL}
                    productName={bp.name}
                    colorName={colorLabel(model, bv.color)}
                    decorative
                    sizes="(min-width: 992px) 20vw, 60vw"
                  />
                </div>
                <p className="dokoncz__nazwa">{bp.name}</p>
                <p className="dokoncz__wariant">{variantText(model, bp, bv)}</p>
                <p className="dokoncz__cena">{formatPLNShort(e.variant.price)}</p>
                {isAnchor ? (
                  <p className="dokoncz__ten">Ten produkt, wariant wybierasz powyżej</p>
                ) : (
                  <Field
                    as="select"
                    label={`Wariant: ${bp.name}`}
                    value={bv.sku}
                    onChange={(ev) => setChosen((c) => ({ ...c, [slot]: ev.target.value }))}
                  >
                    {bp.variants.map((v) => (
                      <option
                        key={v.sku}
                        value={v.sku}
                        disabled={v.stock <= 0 || v.status !== "active"}
                      >
                        {variantText(model, bp, v)} · {formatPLNShort(v.price_gr)}
                        {v.stock <= 0 || v.status !== "active" ? " · Brak" : ""}
                      </option>
                    ))}
                  </Field>
                )}
                {a.soldOut.includes(slot) ? (
                  <p className="dokoncz__brak">Brak — wybierz inny wariant</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="dokoncz__podsumowanie">
          <dl className="dokoncz__ceny">
            <div className="dokoncz__wiersz">
              <dt>Suma</dt>
              <dd>{formatPLN(a.price.sum)}</dd>
            </div>
            <div className="dokoncz__wiersz dokoncz__wiersz--rabat">
              <dt>Rabat za set</dt>
              <dd>{`−${formatPLN(a.price.discount)}`}</dd>
            </div>
            <div className="dokoncz__wiersz dokoncz__wiersz--razem">
              <dt>Razem</dt>
              <dd>{formatPLN(a.price.total)}</dd>
            </div>
          </dl>
          <p className="dokoncz__dopasowanie">Dopasowanie: {a.report.headline}</p>
          <div className="dokoncz__akcje">
            <Button
              loading={busy}
              disabled={blocked}
              aria-describedby={blocked ? "dokoncz-powod" : undefined}
              onClick={() => void add()}
            >
              Dodaj set do koszyka
            </Button>
            <a
              className="tk-btn tk-btn--poboczny dokoncz__kreator"
              href={openInBuilderHref(props.profile, skus)}
            >
              Otwórz w kreatorze
            </a>
          </div>
          {blocked ? (
            <p id="dokoncz-powod" className="dokoncz__powod">
              Wybrany wariant jest niedostępny. Wybierz inny wariant, żeby dodać set do koszyka.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
