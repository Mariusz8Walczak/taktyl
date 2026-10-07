"use client";
// F-107, F-101, F-100 (docs/03 §2, §6, §9): male elementy kreatora - kwota (hak A-04), pasek krokow (hak A-07),
// komunikaty nad krokami. Wzorzec: zakladki/kroki szablonu (docs/08 §6), przestylowane tokenami.
import type { CSSProperties } from "react";
import { formatPLN } from "@taktyl/domain";
import { Alert, Button, VisuallyHidden } from "@taktyl/ui";
import { cx } from "../../lib/builder/cx";
import { toSearchParams } from "../../lib/builder/state";
import {
  SLOT_STEP,
  SLOTS,
  STEPS,
  STEP_LABEL,
  type SlotKey,
  type StepId,
} from "../../lib/builder/types";
import type { BuilderApi } from "./use-builder";

/** F-107, A-04 (hak): kwota z cyframi tabelarycznymi; czytnik ekranu dostaje tylko wartosc koncowa (ukryty region live). */
export function Kwota({ gr, className }: { gr: number; className?: string }) {
  const text = formatPLN(gr);
  return (
    <span className={cx("kwota", className)} data-kwota="">
      <span className="kwota__wartosc" aria-hidden="true">
        {text}
      </span>
      <VisuallyHidden>
        <span data-kwota-live="" aria-live="polite">
          {text}
        </span>
      </VisuallyHidden>
    </span>
  );
}

/** Numer kroku "z 4" (krok 0 jest opcjonalny i nie jest liczony). */
export function stepCounter(step: StepId): string {
  const i = STEPS.indexOf(step);
  return i === 0 ? "Do czego?" : `Krok ${i} z ${STEPS.length - 1}`;
}

function doneText(api: BuilderApi, step: StepId): string | null {
  const { model, state } = api;
  if (step === "do-czego") {
    return state.profile ? (model.rules.profiles[state.profile]?.label ?? null) : null;
  }
  if (step === "podsumowanie") return null;
  const slot = SLOTS.find((s) => SLOT_STEP[s] === step) as SlotKey;
  const sku = state[slot];
  const found = sku === null ? undefined : model.bySku.get(sku);
  return found ? found.product.name : null;
}

/** F-100, A-07: pasek krokow `<ol>` z odnosnikami; biezacy `aria-current="step"`, ukonczony z tekstem "wybrano: ...". */
export function StepsBar({ api }: { api: BuilderApi }) {
  const { state } = api;
  const current = STEPS.indexOf(state.step);
  return (
    <nav aria-label="Kroki kreatora" className="kroki">
      <div className="kroki__tor" aria-hidden="true">
        {/* A-07: wypelnienie scaleX od lewej; ruch dodaje TAKTYL-36 na tej klasie */}
        <div
          className="kroki__wypelnienie"
          style={{ "--postep": current / (STEPS.length - 1) } as CSSProperties}
        />
      </div>
      <ol className="lista kroki__lista">
        {STEPS.map((step, i) => {
          const done = doneText(api, step);
          const isCurrent = step === state.step;
          const href = `/zbuduj-set?${toSearchParams({ ...state, step }).toString()}`;
          return (
            <li
              key={step}
              className={cx("kroki__krok", isCurrent && "is-biezacy", done && "is-gotowy")}
            >
              <a
                href={href}
                aria-current={isCurrent ? "step" : undefined}
                className="kroki__odnosnik"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  api.goStep(step);
                }}
              >
                <span className="kroki__numer">{i}</span>
                <span className="kroki__nazwa">{STEP_LABEL[step]}</span>
                {done ? <span className="kroki__wybrano">wybrano: {done}</span> : null}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** F-111, F-108 (docs/03 §1): komunikaty w tresci strony - niedokonczony set, pominiete SKU, status. */
export function BuilderNotices({ api }: { api: BuilderApi }) {
  const { pending, notices } = api;
  return (
    <div className="kreator__komunikaty">
      {pending ? (
        <Alert variant="info" className="kreator__komunikat">
          <p className="kreator__komunikat-tekst">Masz niedokończony set z {pending.dateLabel}.</p>
          <div className="kreator__komunikat-akcje">
            <Button variant="secondary" onClick={api.loadPending}>
              Wczytaj go
            </Button>
            <Button variant="secondary" onClick={api.dismissPending}>
              Zostaw obecny
            </Button>
          </div>
        </Alert>
      ) : null}
      {notices.map((n) => (
        <Alert key={n} variant="uwaga" className="kreator__komunikat">
          {n}
        </Alert>
      ))}
    </div>
  );
}
