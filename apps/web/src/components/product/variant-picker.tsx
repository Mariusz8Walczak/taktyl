"use client";
// F-062, F-063 (wzorce: `product-color-swatch` i `product-swatch-image`, docs/08 §3): wybor wariantu - kolor (probka
// z nazwa), przelacznik (kafel z typem i sila), rozmiar podkladki (kafel z wymiarami w cm). Kolejnosc: kolor, potem
// przelacznik albo rozmiar (docs/05 §4 pkt 7). Wartosc bez zadnego kupowalnego wariantu jest nieaktywna ("Brak");
// wartosc, ktorej kombinacja z obecnym wyborem nie jest na stanie, jest oznaczona "Brak", ale da sie ja wybrac -
// wtedy karta pokazuje "Brak w tym kolorze" i blokuje "Dodaj do koszyka" z wyjasnieniem (S7).
import { formatWithUnit } from "@taktyl/domain";
import { ChoiceTile, Swatch } from "@taktyl/ui";
import { padSizeDescription } from "../../lib/catalog/attributes";
import type { ReactNode } from "react";
import { dimValues, optionStatus, type Dim } from "../../lib/catalog/variants";
import { useProduct } from "./product-context";

/** Opis kafla; przy kombinacji bez stanu dopisuje widoczne "Brak" (kolor nie jest jedynym nosnikiem). */
function tileDescription(text: string | undefined, brak: boolean): ReactNode {
  if (!brak) return text;
  return (
    <>
      {text ? (
        <>
          {text}
          <br />
        </>
      ) : null}
      <span className="wariant__brak">Brak</span>
    </>
  );
}

export function VariantPicker() {
  const { product, selection, colors, switches, select, colorLabel } = useProduct();
  const { variants } = product;
  const colorIds = dimValues(variants, "color");
  const switchIds = dimValues(variants, "switch");
  const sizeIds = dimValues(variants, "size");
  const status = (dim: Dim, value: string) => optionStatus(variants, selection, dim, value);

  return (
    <div className="warianty">
      {colorIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">
            Kolor: <strong>{colorLabel}</strong>
          </legend>
          <div className="wariant__probki">
            {colorIds.map((id) => {
              const c = colors.find((x) => x.id === id);
              const st = status("color", id);
              return (
                <Swatch
                  key={id}
                  name={`kolor-${product.id}`}
                  value={id}
                  label={c?.label ?? id}
                  swatch={c?.swatch ?? ""}
                  checked={selection.color === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak" : undefined}
                  onChange={() => select("color", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {switchIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">Przełącznik</legend>
          <div className="wariant__kafle">
            {switchIds.map((id) => {
              const sw = switches.find((x) => x.id === id);
              const st = status("switch", id);
              return (
                <ChoiceTile
                  key={id}
                  name={`przelacznik-${product.id}`}
                  value={id}
                  title={sw?.name ?? id}
                  description={tileDescription(
                    sw ? `${sw.type_label}, ${formatWithUnit(sw.force_g, "g")}` : undefined,
                    st === "brak",
                  )}
                  checked={selection.switch === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => select("switch", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizeIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">Rozmiar</legend>
          <div className="wariant__kafle">
            {sizeIds.map((id) => {
              const size = product.padSizes?.[id];
              const st = status("size", id);
              return (
                <ChoiceTile
                  key={id}
                  name={`rozmiar-${product.id}`}
                  value={id}
                  title={size?.label ?? id.toUpperCase()}
                  description={tileDescription(
                    size ? padSizeDescription(size.w, size.d) : undefined,
                    st === "brak",
                  )}
                  checked={selection.size === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => select("size", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
