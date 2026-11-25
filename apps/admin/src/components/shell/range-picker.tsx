"use client";
// B-624 (docs/25 par. 2): zakres dat (dzis / 7 / 30 / 90 dni / wlasny) i porownanie z poprzednim okresem w pasku gornym.
// Przyciski z aria-pressed (grupa), daty wlasnego zakresu w polach type="date"; stan w adresie (useRange).
import { useId, useState } from "react";
import { RANGE_PRESETS, useRange, warsawToday } from "../../lib/range";

export function RangePicker() {
  const r = useRange();
  const id = useId();
  const [custom, setCustom] = useState(r.preset === "wlasny");
  const [from, setFrom] = useState(r.from);
  const [to, setTo] = useState(r.to);
  const today = warsawToday();
  const valid = from !== "" && to !== "" && from <= to && to <= today;

  return (
    <div className="adm-zakres">
      <div role="group" aria-label="Zakres dat" className="adm-zakres__grupa">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="adm-zakres__opcja"
            aria-pressed={!custom && r.preset === p.id}
            onClick={() => {
              setCustom(false);
              r.setPreset(p.id);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="adm-zakres__opcja"
          aria-pressed={custom}
          aria-expanded={custom}
          aria-controls={`${id}-wlasny`}
          onClick={() => setCustom((c) => !c)}
        >
          Własny
        </button>
      </div>
      {custom ? (
        <form
          id={`${id}-wlasny`}
          className="adm-zakres__wlasny"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) r.setCustom(from, to);
          }}
        >
          <label htmlFor={`${id}-od`}>Od</label>
          <input
            id={`${id}-od`}
            type="date"
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
          />
          <label htmlFor={`${id}-do`}>Do</label>
          <input
            id={`${id}-do`}
            type="date"
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
          <button type="submit" className="adm-zakres__opcja" disabled={!valid}>
            Pokaż
          </button>
        </form>
      ) : null}
      <label className="adm-zakres__porownanie">
        <input
          type="checkbox"
          checked={r.compare}
          onChange={(e) => r.setCompare(e.target.checked)}
        />
        Porównaj<span className="tk-sr-only"> z poprzednim okresem</span>
      </label>
    </div>
  );
}
