"use client";
// F-021, F-029 (docs/04 §6; wzorzec: kolumna filtrow `shop-filter-sidebar` z docs/08 §3): facety z API z licznikami.
// multi i buckets - pola wyboru z liczba wynikow, bool - przelacznik, range - suwak z polami (PriceRange),
// number-match - pole "Twoja dlon (cm)". Wartosc z zerem wynikow jest nieaktywna (disabled z API), chyba ze wybrana.
// Zadnej logiki filtrowania tutaj: komponent pokazuje stan i zglasza zmiane (`onChange`), adres robi wyspa nadrzedna.
import type { FilterState } from "@taktyl/domain";
import { Field } from "@taktyl/ui";
import { useId, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { Facet } from "../../lib/catalog/listing-query";
import { parseDecimal } from "../../lib/catalog/filter-actions";
import { PriceRange } from "./price-range";

export type FilterChange =
  | { kind: "toggle"; facetId: string; value: string }
  | { kind: "bool"; facetId: string; on: boolean }
  | {
      kind: "range";
      facetId: string;
      minGr: number | null;
      maxGr: number | null;
      bounds: { min: number; max: number };
    }
  | { kind: "number"; facetId: string; value: number | null };

export interface FilterPanelProps {
  facets: readonly Facet[];
  state: FilterState;
  /** Kolor probki dla facetu koloru: id koloru -> swatch z colors.json. */
  swatches: Readonly<Record<string, string>>;
  onChange: (change: FilterChange) => void;
}

function NumberMatch({
  facet,
  value,
  onChange,
}: {
  facet: Extract<Facet, { type: "number-match" }>;
  value: number | undefined;
  onChange: (n: number | null) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value).replace(".", ","));
  const commit = () => onChange(parseDecimal(text));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };
  return (
    <Field
      label="Twoja dłoń (cm)"
      hint={`Pokażemy myszki, których zakres obejmuje tę wartość (${String(facet.min_cm).replace(".", ",")}–${String(facet.max_cm).replace(".", ",")} cm).`}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
    />
  );
}

export function FilterPanel({ facets, state, swatches, onChange }: FilterPanelProps) {
  const uid = useId();
  return (
    <div className="filtry">
      {facets.map((facet) => {
        const legend = <legend className="filtr__nazwa">{facet.label}</legend>;
        switch (facet.type) {
          case "multi":
          case "buckets": {
            const selected = Array.isArray(state[facet.id]) ? (state[facet.id] as string[]) : [];
            return (
              <fieldset key={facet.id} className="filtr">
                {legend}
                <ul className="lista filtr__lista">
                  {facet.values.map((v) => {
                    const checked = selected.includes(v.v);
                    const inactive = v.disabled && !checked;
                    const swatch = facet.id === "kolor" ? swatches[v.v] : undefined;
                    return (
                      <li key={v.v}>
                        <label className={inactive ? "filtr__opcja is-brak" : "filtr__opcja"}>
                          <input
                            type="checkbox"
                            className="filtr__pole"
                            id={`${uid}-${facet.id}-${v.v}`}
                            checked={checked}
                            disabled={inactive}
                            onChange={() =>
                              onChange({ kind: "toggle", facetId: facet.id, value: v.v })
                            }
                          />
                          {swatch ? (
                            <span
                              className="tk-probka__kolo"
                              style={{ "--tk-swatch": swatch } as CSSProperties}
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="filtr__etykieta">{v.label}</span>
                          <span className="filtr__licznik">({v.count})</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          }
          case "bool": {
            const on = state[facet.id] === true;
            const inactive = facet.disabled && !on;
            return (
              <fieldset key={facet.id} className="filtr">
                <legend className="tk-sr-only">{facet.label}</legend>
                <label className={inactive ? "filtr__opcja is-brak" : "filtr__opcja"}>
                  <input
                    type="checkbox"
                    role="switch"
                    className="filtr__pole"
                    checked={on}
                    disabled={inactive}
                    onChange={(e) =>
                      onChange({ kind: "bool", facetId: facet.id, on: e.target.checked })
                    }
                  />
                  <span className="filtr__etykieta">{facet.label}</span>
                  <span className="filtr__licznik">({facet.count})</span>
                </label>
              </fieldset>
            );
          }
          case "range": {
            const v = state[facet.id];
            const range = v && typeof v === "object" && !Array.isArray(v) ? v : undefined;
            return (
              <fieldset key={facet.id} className="filtr">
                {legend}
                <PriceRange
                  label={facet.label}
                  minGr={facet.min_gr}
                  maxGr={facet.max_gr}
                  value={range}
                  onCommit={(minGr, maxGr) =>
                    onChange({
                      kind: "range",
                      facetId: facet.id,
                      minGr,
                      maxGr,
                      bounds: { min: facet.min_gr, max: facet.max_gr },
                    })
                  }
                />
              </fieldset>
            );
          }
          case "number-match": {
            const v = state[facet.id];
            const num = typeof v === "number" ? v : undefined;
            return (
              <fieldset key={facet.id} className="filtr">
                <legend className="tk-sr-only">{facet.label}</legend>
                <NumberMatch
                  key={String(num ?? "")}
                  facet={facet}
                  value={num}
                  onChange={(n) => onChange({ kind: "number", facetId: facet.id, value: n })}
                />
              </fieldset>
            );
          }
        }
      })}
    </div>
  );
}
