"use client";
// F-021 (docs/04 §6, docs/02 §3): zakres ceny - suwak z dwoma uchwytami i dwa pola liczbowe. Wlasny komponent bez
// bibliotek zewnetrznych: dwa natywne `input[type=range]` w jednym kontenerze (klawiatura i czytnik dzialaja natywnie),
// pola "od" i "do" w zlotych. Filtr jest zatwierdzany po zakonczeniu ruchu (puszczenie uchwytu, klawisz, opuszczenie
// pola, Enter), nie przy kazdym pikselu - jeden wpis w historii przegladarki na zmiane. Wzorzec: suwak ceny listingu
// `shop-filter-sidebar` (docs/08 §3; noUiSlider z szablonu zastapiony natywnymi polami, bez zewnetrznych skryptow).
import { Field } from "@taktyl/ui";
import { useEffect, useId, useRef, useState } from "react";
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
  const fromValue = (gr: number | null | undefined, fallback: number) =>
    String(gr != null ? Math.round(gr / 100) : fallback);
  // TAKTYL-81: lokalny stan pol jest zrodlem prawdy, dopoki uzytkownik edytuje; adres go nie nadpisuje i komponent
  // nie jest przemontowywany po zatwierdzeniu (wczesniej `key` z adresu gubil wpisane "Do" i fokus).
  const [texts, setTexts] = useState({
    low: fromValue(value?.min, lowBound),
    high: fromValue(value?.max, highBound),
  });
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const editing = useRef(false);
  const lowText = texts.low;
  const highText = texts.high;
  const setLowText = (low: string) => {
    editing.current = true;
    setTexts((t) => ({ ...t, low }));
  };
  const setHighText = (high: string) => {
    editing.current = true;
    setTexts((t) => ({ ...t, high }));
  };

  // Zmiana zakresu z zewnatrz (czyszczenie filtra, wstecz w historii) odswieza pola, gdy nikt ich nie edytuje.
  const extMin = value?.min ?? null;
  const extMax = value?.max ?? null;
  useEffect(() => {
    if (editing.current) return;
    const next = { low: fromValue(extMin, lowBound), high: fromValue(extMax, highBound) };
    setTexts((t) => (t.low === next.low && t.high === next.high ? t : next));
  }, [extMin, extMax, lowBound, highBound]);

  const normalize = (t: { low: string; high: string }) => {
    const l = clamp(parseDecimal(t.low) ?? lowBound, lowBound, highBound);
    const h = clamp(parseDecimal(t.high) ?? highBound, lowBound, highBound);
    return { lo: Math.min(l, h), hi: Math.max(l, h) };
  };
  const { lo, hi } = normalize(texts);

  const span = Math.max(1, highBound - lowBound);
  const style = {
    "--od": ((lo - lowBound) / span) * 100,
    "--do": ((hi - lowBound) / span) * 100,
  } as CSSProperties;

  // Zatwierdza caly zakres z NAJNOWSZYCH wartosci obu pol (ref), nie z domkniecia sprzed ostatniego wpisu.
  function commit() {
    const { lo: l, hi: h } = normalize(textsRef.current);
    editing.current = false;
    setTexts({ low: String(l), high: String(h) });
    onCommit(l * 100, h * 100);
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
