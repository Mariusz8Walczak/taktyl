"use client";
// F-250, F-251, F-255 (ADR-0011): panel wyboru czesci jednego modelu (wzor wierzchu podkladki, kolory i wykonczenia).
// Uzywany w konfiguratorze produktu i w „Stworz wlasny set”. Kazdy wybor to przycisk radio z nazwa koloru (a11y).
import type { ConfiguratorData } from "@taktyl/contracts";
import type { Configuration } from "@taktyl/domain";
import { useId } from "react";
import {
  allowedFinishes,
  configurableParts,
  paletteColors,
  printsForModel,
  supportsPrints,
} from "../../lib/configurator/model";

type Model = ConfiguratorData["models"][number];
type Choices = Configuration["parts"];

interface Props {
  data: ConfiguratorData;
  model: Model;
  /** Wybory uzytkownika (tylko jawne). */
  choices: Choices;
  /** Konfiguracja po rozwiazaniu regul (pelna). */
  resolved: Configuration;
  print: string | null;
  /** Przelacznik klawiatury (id); `null` dla myszek i podkladek. */
  switchId: string | null;
  onSwitch: (id: string) => void;
  onChoose: (partId: string, patch: Partial<{ color: string; finish: string | null }>) => void;
  onPrint: (id: string | null) => void;
}

export function PartsPanel({
  data,
  model,
  choices,
  resolved,
  print,
  switchId,
  onSwitch,
  onChoose,
  onPrint,
}: Props) {
  const uid = useId();
  const parts = configurableParts(model);
  const printable = supportsPrints(data, model);
  const prints = printable ? printsForModel(data, model) : [];

  const keyboard = model.id.startsWith("k-");
  return (
    <>
      {keyboard ? (
        <fieldset className="konfigurator__grupa">
          <legend>Przełącznik</legend>
          <div className="konfigurator__modele" role="radiogroup" aria-label="Przełącznik">
            {Object.entries(data.switches).map(([id, sw]) => (
              <label key={id} className="konfigurator__model">
                <input
                  type="radio"
                  name={`${uid}-przelacznik`}
                  checked={switchId === id}
                  onChange={() => onSwitch(id)}
                />
                <span>{sw.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {printable ? (
        <fieldset className="konfigurator__grupa">
          <legend>Wzór wierzchu</legend>
          <div
            className="konfigurator__wzory"
            role="radiogroup"
            aria-label="Wzór wierzchu podkładki"
          >
            <label className="konfigurator__wzor">
              <input
                type="radio"
                name={`${uid}-wzor`}
                checked={print === null}
                onChange={() => onPrint(null)}
              />
              <span className="konfigurator__wzor-nazwa">Bez wzoru (kolor)</span>
            </label>
            {prints.map((p) => (
              <label key={p.id} className="konfigurator__wzor">
                <input
                  type="radio"
                  name={`${uid}-wzor`}
                  checked={print === p.id}
                  onChange={() => onPrint(p.id)}
                />
                <img
                  src={`/3d/${p.miniatura}`}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  className="konfigurator__wzor-obraz"
                />
                <span className="konfigurator__wzor-nazwa">{p.nazwa}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {parts.map((part) => {
        if (part.id === "wierzch" && print) return null;
        const palette = part.paleta ? data.palettes[part.paleta] : undefined;
        const colors = part.paleta ? paletteColors(data, part.paleta) : [];
        const finishes = allowedFinishes(data, model, part);
        const current = resolved.parts[part.id];
        const autoAllowed = palette?.auto === "kontrast";
        const isAuto = choices[part.id]?.color === "auto";
        const currentLabel = isAuto
          ? "Auto (kontrast)"
          : (data.colors[current?.color ?? ""]?.label ?? "");
        return (
          <fieldset key={part.id} className="konfigurator__grupa">
            <legend>
              {part.etykieta}: <strong>{currentLabel}</strong>
            </legend>
            <div className="konfigurator__probki" role="radiogroup" aria-label={part.etykieta}>
              {autoAllowed ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isAuto}
                  className="konfigurator__auto"
                  onClick={() => onChoose(part.id, { color: "auto", finish: null })}
                >
                  Auto
                </button>
              ) : null}
              {colors.map((key) => {
                const c = data.colors[key];
                if (!c) return null;
                const on = !isAuto && current?.color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c.label}
                    title={c.label}
                    className="konfigurator__probka"
                    style={{ backgroundColor: c.swatch }}
                    onClick={() => onChoose(part.id, { color: key })}
                  />
                );
              })}
            </div>
            {finishes.length > 1 ? (
              <label className="konfigurator__wykonczenie">
                <span>Wykończenie</span>
                <select
                  value={current?.finish ?? ""}
                  onChange={(e) => onChoose(part.id, { finish: e.target.value })}
                >
                  {finishes.map((f) => (
                    <option key={f} value={f}>
                      {data.finishes[f]?.label ?? f}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>
        );
      })}
    </>
  );
}
