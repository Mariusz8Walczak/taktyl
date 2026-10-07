// F-069 (docs/05 §4 pkt 12; wzorzec: `product-frequently-bought-together`, docs/08 §3): statyczny widok bloku "Dokoncz
// set" renderowany na serwerze - trzy elementy, cena setu z rabatem, "Otworz w kreatorze". Dziala bez JS i bez
// doladowania paczki; interaktywna wersja (`complete-set-block.tsx`) podmienia go, gdy blok zbliza sie do widoku.
// Uklad i klasy identyczne jak w wersji interaktywnej (CLS 0 przy podmianie).
import { formatPLN } from "@taktyl/domain";
import { Field, ProductImage } from "@taktyl/ui";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import { colorLabel, packshotEntry, variantText } from "../../lib/builder/catalog";
import {
  createBlockModel,
  openInBuilderHref,
  type CompleteSetProps,
} from "../../lib/builder/complete-view";
import { analyze } from "../../lib/builder/fit";
import { EMPTY_STATE, SLOTS } from "../../lib/builder/types";
import { formatPLNShort } from "../../lib/format";

export function CompleteSetStatic(props: CompleteSetProps) {
  const model = createBlockModel(props);
  const a = analyze(model, {
    ...EMPTY_STATE,
    profile: props.profile,
    k: props.skus.k,
    m: props.skus.m,
    p: props.skus.p,
  });
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
                {slot === props.anchor ? (
                  <p className="dokoncz__ten">Ten produkt, wariant wybierasz powyżej</p>
                ) : (
                  <Field as="select" label={`Wariant: ${bp.name}`} defaultValue={bv.sku} disabled>
                    <option value={bv.sku}>{variantText(model, bp, bv)}</option>
                  </Field>
                )}
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
            <button type="button" className="tk-btn tk-btn--glowny" disabled>
              Dodaj set do koszyka
            </button>
            <a
              className="tk-btn tk-btn--poboczny dokoncz__kreator"
              href={openInBuilderHref(props.profile, props.skus)}
            >
              Otwórz w kreatorze
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
