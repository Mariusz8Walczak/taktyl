"use client";
// F-021 (docs/04 §6, docs/02 §3): zakres ceny - suwak z dwoma uchwytami i dwa pola liczbowe. Wlasny komponent bez
// bibliotek zewnetrznych: dwa natywne `input[type=range]` w jednym kontenerze (klawiatura i czytnik dzialaja natywnie),
// pola "od" i "do" w zlotych. Filtr jest zatwierdzany po zakonczeniu ruchu (puszczenie uchwytu, klawisz, opuszczenie
// pola, Enter), nie przy kazdym pikselu - jeden wpis w historii przegladarki na zmiane. Wzorzec: suwak ceny listingu
// `shop-filter-sidebar` (docs/08 §3; noUiSlider z szablonu zastapiony natywnymi polami, bez zewnetrznych skryptow).
import { Field } from "@taktyl/ui";
import { useId, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { parseDecimal } from "../../lib/catalog/filter-actions";

export interface PriceRangeProps {
  label: string;
  /** Granice katalogu w groszach. */
  minGr: number;
  maxGr: number;
  /** Aktywny zakres w groszach (null = brak ograniczenia po tej stronie). */
  value: { min: number | null; max: number | null } | undefined;
  /** Zatwierdzenie zakresu (grosze, wartosci wewnatrz granic). */
  onCommit: (minGr: number | null, maxGr: number | null) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function PriceRange({ label, minGr, maxGr, value, onCommit }: PriceRangeProps) {
  const id = useId();
  const lowBound = Math.floor(minGr / 100);
  const highBound = Math.ceil(maxGr / 100);
  const [lowText, setLowText] = useState(
    String(value?.min != null ? Math.round(value.min / 100) : lowBound),
  );
  const [highText, setHighText] = useState(
    String(value?.max != null ? Math.round(value.max / 100) : highBound),
  );

  const lowNum = clamp(parseDecimal(lowText) ?? lowBound, lowBound, highBound);
  const highNum = clamp(parseDecimal(highText) ?? highBound, lowBound, highBound);
  const lo = Math.min(lowNum, highNum);
  const hi = Math.max(lowNum, highNum);

  const span = Math.max(1, highBound - lowBound);
  const style = {
    "--od": ((lo - lowBound) / span) * 100,
    "--do": ((hi - lowBound) / span) * 100,
  } as CSSProperties;

  function commit() {
    setLowText(String(lo));
    setHighText(String(hi));
    onCommit(lo * 100, hi * 100);
  }
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div className="zakres">
      <div className="zakres__suwak" style={style}>
        <span className="zakres__tor" aria-hidden="true" />
        <input
          type="range"
          className="zakres__uchwyt"
          aria-label={`${label}: od`}
          min={lowBound}
          max={highBound}
          step={1}
          value={lo}
          onChange={(e) => setLowText(e.target.value)}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
        <input
          type="range"
          className="zakres__uchwyt"
          aria-label={`${label}: do`}
          min={lowBound}
          max={highBound}
          step={1}
          value={hi}
          onChange={(e) => setHighText(e.target.value)}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>
      <div className="zakres__pola">
        <Field
          id={`${id}-od`}
          label="Od (zł)"
          type="number"
          inputMode="numeric"
          min={lowBound}
          max={highBound}
          value={lowText}
          onChange={(e) => setLowText(e.target.value)}
          onBlur={commit}
          onKeyDown={onEnter}
        />
        <Field
          id={`${id}-do`}
          label="Do (zł)"
          type="number"
          inputMode="numeric"
          min={lowBound}
          max={highBound}
          value={highText}
          onChange={(e) => setHighText(e.target.value)}
          onBlur={commit}
          onKeyDown={onEnter}
        />
      </div>
    </div>
  );
}
