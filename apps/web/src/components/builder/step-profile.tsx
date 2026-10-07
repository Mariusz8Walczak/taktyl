"use client";
// F-101, F-111, F-100 (docs/03 §2 krok 0): "Do czego?" - 5 profili z rules.json, dlugosc dloni (12-25 cm, krok 0,5),
// "Pomin" (no_profile) i gotowe sety jako punkt startu. Wzorzec: kafle wyboru `product-swatch-image` (docs/08 §3).
import { formatCmFromMm, formatPLN } from "@taktyl/domain";
import { Alert, Button, ChoiceTile, Field } from "@taktyl/ui";
import { useState } from "react";
import { hasContent } from "../../lib/builder/state";
import {
  HAND_MAX_CM,
  HAND_MIN_CM,
  HAND_STEP_CM,
  STEP_LABEL,
  type StepId,
} from "../../lib/builder/types";
import { stepCounter } from "./parts";
import { headingId, type BuilderApi } from "./use-builder";

const STEP: StepId = "do-czego";

/** "Zostawimy 40 cm na ruch myszki i zaproponujemy przełącznik liniowy" - z rules.json i switches.json. */
function profileSentence(api: BuilderApi, id: string): string {
  const { model } = api;
  const p = model.rules.profiles[id];
  if (!p) return "";
  const sw = model.switches.find((s) => s.id === p.default_switch);
  const zone = `${formatCmFromMm(p.mouse_zone_mm)} cm`;
  return sw
    ? `Zostawimy ${zone} na ruch myszki i zaproponujemy przełącznik ${sw.type_label}.`
    : `Zostawimy ${zone} na ruch myszki.`;
}

function HandField({ api }: { api: BuilderApi }) {
  const [text, setText] = useState(api.state.handCm === null ? "" : String(api.state.handCm));
  const [error, setError] = useState<string | null>(null);
  return (
    <Field
      type="number"
      inputMode="decimal"
      name="dlon"
      label="Długość dłoni w cm (opcjonalnie)"
      hint="Od nadgarstka do czubka środkowego palca."
      min={HAND_MIN_CM}
      max={HAND_MAX_CM}
      step={HAND_STEP_CM}
      value={text}
      error={error}
      wrapperClassName="kreator__dlon"
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === "") {
          setError(null);
          api.setHand(null);
          return;
        }
        const n = Number(raw.replace(",", "."));
        if (Number.isFinite(n) && n >= HAND_MIN_CM && n <= HAND_MAX_CM) {
          setError(null);
          api.setHand(Math.round(n * 10) / 10);
        } else {
          setError(`Podaj długość dłoni od ${HAND_MIN_CM} do ${HAND_MAX_CM} cm.`);
          api.setHand(null);
        }
      }}
    />
  );
}

function Presets({ api }: { api: BuilderApi }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const { model, state } = api;
  const replacing = hasContent({ ...state, profile: null, handCm: null });
  if (model.presets.length === 0) return null;
  return (
    <section className="gotowe" aria-labelledby="gotowe-tytul">
      <h3 id="gotowe-tytul" className="gotowe__tytul">
        Albo zacznij od gotowego setu
      </h3>
      <ul className="lista gotowe__lista">
        {model.presets.map((p) => (
          <li key={p.id} className="gotowe__set">
            <p className="gotowe__nazwa">{p.name}</p>
            <p className="gotowe__opis">{p.note}</p>
            <p className="gotowe__cena">Razem {formatPLN(p.total_gr)}</p>
            {confirm === p.id ? (
              <Alert variant="info" className="gotowe__potwierdzenie">
                <p>Wczytanie setu „{p.name}” zastąpi Twój obecny wybór.</p>
                <div className="kreator__komunikat-akcje">
                  <Button
                    onClick={() => {
                      setConfirm(null);
                      api.loadPreset(p.id);
                    }}
                  >
                    Zastąp i wczytaj set
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Anuluj
                  </Button>
                </div>
              </Alert>
            ) : (
              <Button
                variant="secondary"
                aria-label={`Wczytaj set ${p.name}`}
                onClick={() => (replacing ? setConfirm(p.id) : api.loadPreset(p.id))}
              >
                Wczytaj set
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StepProfile({ api }: { api: BuilderApi }) {
  const { model, state } = api;
  return (
    <>
      <fieldset className="krok">
        <legend className="krok__legenda">
          <h2 id={headingId(STEP)} tabIndex={-1} className="krok__naglowek">
            {stepCounter(STEP)}: {STEP_LABEL[STEP]}
          </h2>
        </legend>
        <p className="krok__wstep">
          Wybierz, do czego jest set. Od tego zależy, ile miejsca zostawimy na ruch myszki i jaki
          przełącznik zaproponujemy.
        </p>
        <div className="kafle kafle--profile">
          {Object.entries(model.rules.profiles).map(([id, p]) => (
            <ChoiceTile
              key={id}
              name="profil"
              value={id}
              title={p.label}
              description={profileSentence(api, id)}
              checked={state.profile === id}
              onChange={() => api.setProfile(id)}
            />
          ))}
        </div>
        <HandField api={api} />
      </fieldset>
      <Presets api={api} />
      <div className="krok__akcje krok__akcje--profil">
        <Button variant="secondary" onClick={api.skipProfile}>
          Pomiń
        </Button>
      </div>
    </>
  );
}
