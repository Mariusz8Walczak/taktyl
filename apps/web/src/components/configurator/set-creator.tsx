"use client";
// F-255 (ADR-0011): „Stworz wlasny set”. Trzy produkty (klawiatura, mysz, podkladka) na jednej scenie 3D, kazdy z wlasnymi
// kolorami i wykonczeniami. Rabat setu i ceny liczy API (`POST /v1/configurator/set-quote`, procent z ustawien sklepu);
// widok pokazuje tylko to, co zwroci serwer. Gotowe sety i kreator „Zbuduj set” zostaja bez zmian.
import type { ConfiguratorData, ConfiguratorSetQuote } from "@taktyl/contracts";
import { formatPLN, resolveConfiguration, type Configuration } from "@taktyl/domain";
import { useEffect, useId, useMemo, useState } from "react";
import {
  applyChoice,
  explicitChoices,
  placeOnDesk,
  toDomainData,
} from "../../lib/configurator/model";
import { PartsPanel } from "./parts-panel";
import { SceneView } from "./scene-view";
import type { StageItem } from "./stage";

type Model = ConfiguratorData["models"][number];
type Choices = Configuration["parts"];
type Slot = "k" | "m" | "p";

const SLOTS: { slot: Slot; title: string; prefix: string }[] = [
  { slot: "k", title: "Klawiatura", prefix: "k-" },
  { slot: "m", title: "Mysz", prefix: "m-" },
  { slot: "p", title: "Podkładka", prefix: "p-" },
];

interface SlotState {
  modelId: string;
  choices: Choices;
  print: string | null;
}

export interface SetCreatorProps {
  data: ConfiguratorData;
  /** Stan poczatkowy z adresu (`?k=&m=&p=`), rozwiazany na serwerze. */
  initial: Record<Slot, { modelId: string; config: Configuration }>;
}

function modelLabel(m: Model): string {
  const size = m.size ? ` ${m.size.toUpperCase()}` : "";
  const dims = m.size
    ? ` (${Math.round(m.dims_mm[0] ?? 0)} × ${Math.round(m.dims_mm[1] ?? 0)} mm)`
    : "";
  return `${m.name}${size}${dims}`;
}

export function SetCreator({ data, initial }: SetCreatorProps) {
  const uid = useId();
  const domainData = useMemo(() => toDomainData(data), [data]);
  const [state, setState] = useState<Record<Slot, SlotState>>(() => {
    const out = {} as Record<Slot, SlotState>;
    for (const { slot } of SLOTS) {
      const model = data.models.find((m) => m.id === initial[slot].modelId) as Model;
      out[slot] = {
        modelId: model.id,
        choices: explicitChoices(model, initial[slot].config.parts),
        print: initial[slot].config.print ?? null,
      };
    }
    return out;
  });
  const [quote, setQuote] = useState<ConfiguratorSetQuote | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  const models = useMemo(
    () =>
      Object.fromEntries(
        SLOTS.map(({ slot, prefix }) => [slot, data.models.filter((m) => m.id.startsWith(prefix))]),
      ) as Record<Slot, Model[]>,
    [data],
  );

  const resolved = useMemo(() => {
    const out = {} as Record<
      Slot,
      { model: Model; result: ReturnType<typeof resolveConfiguration> }
    >;
    for (const { slot } of SLOTS) {
      const s = state[slot];
      const model = data.models.find((m) => m.id === s.modelId) as Model;
      out[slot] = {
        model,
        result: resolveConfiguration(domainData, {
          model: model.id,
          parts: s.choices,
          print: s.print,
        }),
      };
    }
    return out;
  }, [data, domainData, state]);

  const items = useMemo<StageItem[]>(() => {
    const placed = placeOnDesk(
      resolved.p.model.dims_mm,
      resolved.k.model.dims_mm,
      resolved.m.model.dims_mm,
    );
    return [
      { key: "p", model: resolved.p.model, config: resolved.p.result.config, offset: placed.pad },
      {
        key: "k",
        model: resolved.k.model,
        config: resolved.k.result.config,
        offset: placed.keyboard,
      },
      { key: "m", model: resolved.m.model, config: resolved.m.result.config, offset: placed.mouse },
    ];
  }, [resolved]);

  // Wycena setu z API (opoznienie 300 ms, poprzednie zadanie anulowane) + kody w adresie.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/configurator/set-quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: SLOTS.map(({ slot }) => ({
              model: state[slot].modelId,
              parts: state[slot].choices,
              print: state[slot].print,
            })),
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const q = (await res.json()) as ConfiguratorSetQuote;
        setQuote(q);
        setQuoteError(false);
        const params = new URLSearchParams();
        q.items.forEach((item, i) => {
          const slot = SLOTS[i]?.slot;
          if (slot && item.sku) params.set(slot, item.sku);
        });
        window.history.replaceState(null, "", `?${params.toString()}`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuoteError(true);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [state]);

  function pickModel(slot: Slot, modelId: string) {
    setState((s) => ({ ...s, [slot]: { modelId, choices: {}, print: null } }));
  }

  return (
    <div className="konfigurator konfigurator--set">
      <SceneView title="Podgląd 3D: twój własny set na biurku" data={data} items={items} />

      <div className="konfigurator__panel">
        {SLOTS.map(({ slot, title }) => {
          const { model, result } = resolved[slot];
          return (
            <section key={slot} className="konfigurator__sekcja" aria-labelledby={`${uid}-${slot}`}>
              <h2 id={`${uid}-${slot}`} className="konfigurator__sekcja-tytul">
                {title}: <span>{modelLabel(model)}</span>
              </h2>
              <fieldset className="konfigurator__grupa">
                <legend>Model</legend>
                <div
                  className="konfigurator__modele"
                  role="radiogroup"
                  aria-label={`Model: ${title}`}
                >
                  {models[slot].map((m) => (
                    <label key={m.id} className="konfigurator__model">
                      <input
                        type="radio"
                        name={`${uid}-${slot}-model`}
                        checked={m.id === model.id}
                        onChange={() => pickModel(slot, m.id)}
                      />
                      <span>{modelLabel(m)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <details className="konfigurator__czesci">
                <summary>Dobierz kolory części</summary>
                <PartsPanel
                  data={data}
                  model={model}
                  choices={state[slot].choices}
                  resolved={result.config}
                  print={state[slot].print}
                  onChoose={(partId, patch) =>
                    setState((s) => ({
                      ...s,
                      [slot]: {
                        ...s[slot],
                        choices: applyChoice(
                          data,
                          model,
                          result.config,
                          s[slot].choices,
                          partId,
                          patch,
                        ),
                      },
                    }))
                  }
                  onPrint={(id) => setState((s) => ({ ...s, [slot]: { ...s[slot], print: id } }))}
                />
              </details>
              {result.adjustments.map((a) => (
                <p key={a.part} className="konfigurator__uwaga" role="status">
                  {title}: nadruk zamieniono na {data.colors[a.to]?.label ?? a.to}, bo kontrast z
                  klawiszem był za niski.
                </p>
              ))}
            </section>
          );
        })}

        <div className="konfigurator__podsumowanie" aria-live="polite">
          {quote ? (
            <>
              <dl className="konfigurator__ceny">
                {quote.items.map((item, i) => (
                  <div key={SLOTS[i]?.slot}>
                    <dt>{resolved[SLOTS[i]?.slot as Slot].model.name}</dt>
                    <dd>{formatPLN(item.total_gr)}</dd>
                  </div>
                ))}
                <div>
                  <dt>Suma</dt>
                  <dd>{formatPLN(quote.sum_gr)}</dd>
                </div>
                <div>
                  <dt>Rabat za komplet (−{quote.percent}%)</dt>
                  <dd>{quote.complete ? `−${formatPLN(quote.discount_gr)}` : formatPLN(0)}</dd>
                </div>
                <div className="konfigurator__razem">
                  <dt>Razem</dt>
                  <dd>{formatPLN(quote.total_gr)}</dd>
                </div>
              </dl>
              {!quote.ok ? (
                <p className="konfigurator__blad" role="alert">
                  Ten zestaw nie przejdzie wyceny. Sprawdź, czy wybrane wykończenia pasują do
                  modeli.
                </p>
              ) : null}
              <ul className="konfigurator__kody">
                {quote.items.map((item, i) =>
                  item.sku ? (
                    <li key={item.sku}>
                      <code>{item.sku}</code>
                    </li>
                  ) : (
                    <li key={i}>—</li>
                  ),
                )}
              </ul>
            </>
          ) : (
            <p className="konfigurator__laduje">
              {quoteError ? "Nie udało się wycenić. Spróbuj ponownie." : "Liczę cenę…"}
            </p>
          )}
          <p className="konfigurator__info">
            Każdy element wykonujemy na zamówienie, wysyłka w ok. 7 dni roboczych. Zamawianie
            własnych setów uruchomimy w kolejnym wydaniu; teraz możesz złożyć set, obejrzeć go na
            biurku i zachować link z kodami.
          </p>
          <p>
            <a className="przycisk-tekstowy" href="/zbuduj-set">
              Wolisz gotowy set? Zbuduj set
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
