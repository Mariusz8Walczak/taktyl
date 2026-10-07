"use client";
// F-100...F-113 (docs/03): kreator setu "Zbuduj set" - wyspa kliencka. Wzorzec: zakladki/kroki szablonu + przyklejone
// podsumowanie (`checkout.html`), docs/08 §6. Uklad: komputer - kolumna kroku 60% i podsumowanie 40% przyklejone;
// telefon - podglad kompaktowy u gory, kafle kroku, pasek dolny z ceną i przyciskiem (padding-bottom rezerwuje miejsce).
import { Button, Field } from "@taktyl/ui";
import { useEffect, useMemo, useRef } from "react";
import { createModel, type BuilderData } from "../../lib/builder/catalog";
import { STEPS, STEP_LABEL, STEP_SLOT } from "../../lib/builder/types";
import { BuilderNotices, Kwota, StepsBar, stepCounter } from "./parts";
import { StepProducts } from "./step-products";
import { StepProfile } from "./step-profile";
import { Summary, addBlocker } from "./summary";
import { headingId, useBuilder, type BuilderApi } from "./use-builder";

function FallbackLink({ link }: { link: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector("input");
    input?.focus();
    input?.select();
  }, [link]);
  return (
    <div ref={ref}>
      <Field
        label="Link do setu"
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        wrapperClassName="kreator__link"
      />
    </div>
  );
}

/** Krok 4: pozycje, ceny i przycisk sa w kolumnie podsumowania; tu naglowek, link do setu i wskazowki. */
function StepSummary({ api }: { api: BuilderApi }) {
  return (
    <fieldset className="krok">
      <legend className="krok__legenda">
        <h2 id={headingId("podsumowanie")} tabIndex={-1} className="krok__naglowek">
          {stepCounter("podsumowanie")}: {STEP_LABEL.podsumowanie}
        </h2>
      </legend>
      <p className="krok__wstep">
        Sprawdź wyniki dopasowania i ceny. Rabat za set jest naliczany, gdy w secie są klawiatura,
        myszka i podkładka. Każdą pozycję możesz zmienić.
      </p>
      <div className="krok__akcje">
        <Button variant="secondary" onClick={() => void api.copyLink()}>
          Kopiuj link do setu
        </Button>
        {/* F-114 (P1): "Zapisz set" - tylko hak, bez przycisku do czasu konta demo (TAKTYL-56) */}
      </div>
      <p className="kreator__status" role="status">
        {api.message}
      </p>
      {api.fallbackLink ? <FallbackLink link={api.fallbackLink} /> : null}
    </fieldset>
  );
}

/** Pasek akcji: na komputerze "Dalej" pod krokiem, na telefonie przyklejony do dolu z cena (F-100, docs/03 §3). */
function ActionBar({ api }: { api: BuilderApi }) {
  const { state, analysis } = api;
  const i = STEPS.indexOf(state.step);
  const nextStep = STEPS[i + 1];
  const slot = STEP_SLOT[state.step];
  const chosen = slot ? analysis.entries[slot] !== null : true;
  const isLast = state.step === "podsumowanie";
  const blocker = addBlocker(api);
  return (
    <div
      className={`kreator__pasek${isLast ? " kreator__pasek--ostatni" : ""}`}
      data-testid="pasek-dolny"
    >
      <p className="kreator__pasek-cena">
        <span className="kreator__pasek-etykieta">Razem</span>
        <Kwota gr={analysis.price.total} />
      </p>
      {isLast ? (
        <Button
          loading={api.busy}
          disabled={blocker !== null}
          aria-describedby={blocker ? "powod-dodania" : undefined}
          onClick={() => void api.addToCart()}
        >
          Dodaj set do koszyka
        </Button>
      ) : (
        <>
          <Button
            disabled={!chosen}
            aria-describedby={chosen ? undefined : "powod-dalej"}
            onClick={api.next}
          >
            Dalej: {nextStep ? STEP_LABEL[nextStep].toLowerCase() : ""}
          </Button>
          {chosen ? null : (
            <p id="powod-dalej" className="kreator__powod kreator__powod--pasek">
              Wybierz model, żeby przejść dalej.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Builder({ data, initialSearch }: { data: BuilderData; initialSearch: string }) {
  const model = useMemo(() => createModel(data), [data]);
  const api = useBuilder(model, initialSearch);
  const { state } = api;
  return (
    <div className="kreator" data-krok={state.step}>
      <div className="kreator__naglowek">
        <StepsBar api={api} />
        <p className="kreator__licznik" aria-hidden="true">
          {stepCounter(state.step)}
        </p>
      </div>
      <BuilderNotices api={api} />
      <div className="kreator__uklad">
        <section className="kreator__krok" aria-label="Krok kreatora">
          {state.step === "do-czego" ? <StepProfile api={api} /> : null}
          {state.step === "klawiatura" ? <StepProducts api={api} slot="k" /> : null}
          {state.step === "myszka" ? <StepProducts api={api} slot="m" /> : null}
          {state.step === "podkladka" ? <StepProducts api={api} slot="p" /> : null}
          {state.step === "podsumowanie" ? <StepSummary api={api} /> : null}
          <ActionBar api={api} />
        </section>
        <Summary api={api} />
      </div>
    </div>
  );
}
