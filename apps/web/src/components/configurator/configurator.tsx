"use client";
// F-250..F-254 (ADR-0011): konfigurator kolorow. Wybory klienta -> reguly z @taktyl/domain (natychmiast, ta sama logika
// co w API) -> scena 3D. Cena i SKU zawsze z `POST /v1/configurator/quote` (serwer); widok nie liczy kwot.
// Dostepnosc: kazdy wybor to przycisk radio z nazwa koloru, scena jest dekoracja (aria-hidden), stan oglasza region live.
import type { ConfiguratorData, ConfiguratorQuote } from "@taktyl/contracts";
import { formatPLN, resolveConfiguration, type Configuration } from "@taktyl/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyChoice, explicitChoices, toDomainData } from "../../lib/configurator/model";
import { PartsPanel } from "./parts-panel";
import { SceneView } from "./scene-view";
import type { StageHandle, StageItem } from "./stage";

type Model = ConfiguratorData["models"][number];
type Choices = Configuration["parts"];

interface Props {
  data: ConfiguratorData;
  model: Model;
  productName: string;
  productHref: string;
  /** Wybory z adresu (`?sku=`) rozwiazane po stronie serwera; puste = domyslne. */
  initial: Configuration;
}

export function Configurator({ data, model, productName, productHref, initial }: Props) {
  const domainData = useMemo(() => toDomainData(data), [data]);
  // Tylko wybory odbiegajace od domyslnych: reszta (spod, pokretlo, przyciski) podaza za czescia nadrzedna.
  const [choices, setChoices] = useState<Choices>(() => explicitChoices(model, initial.parts));
  const [print, setPrint] = useState<string | null>(initial.print ?? null);
  const [quote, setQuote] = useState<ConfiguratorQuote | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  const stage = useRef<StageHandle>(null);

  const resolved = useMemo(
    () => resolveConfiguration(domainData, { model: model.id, parts: choices, print }),
    [domainData, model.id, choices, print],
  );
  const items = useMemo<StageItem[]>(
    () => [{ key: "p", model, config: resolved.config, offset: [0, 0, 0] }],
    [model, resolved.config],
  );

  // Cena i SKU z API (opoznienie 250 ms, poprzednie zadanie anulowane).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/configurator/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: model.id, parts: choices, print }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const q = (await res.json()) as ConfiguratorQuote;
        setQuote(q);
        setQuoteError(false);
        if (q.sku) window.history.replaceState(null, "", `?sku=${encodeURIComponent(q.sku)}`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuoteError(true);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [model.id, choices, print]);

  const total = quote?.ok ? quote.total_gr : null;
  const adjustments = resolved.adjustments.map((a) => {
    const label = model.parts.find((p) => p.id === a.part)?.etykieta ?? a.part;
    return `${label}: ${data.colors[a.from]?.label ?? a.from} zamieniono na ${data.colors[a.to]?.label ?? a.to}, bo kontrast z klawiszem był za niski.`;
  });

  return (
    <div className="konfigurator">
      <SceneView title={`Podgląd 3D: ${productName}`} data={data} items={items} handleRef={stage} />

      <div className="konfigurator__panel">
        <PartsPanel
          data={data}
          model={model}
          choices={choices}
          resolved={resolved.config}
          print={print}
          onChoose={(partId, patch) =>
            setChoices((c) => applyChoice(data, model, resolved.config, c, partId, patch))
          }
          onPrint={setPrint}
        />

        <div className="konfigurator__podsumowanie" aria-live="polite">
          {adjustments.map((a) => (
            <p key={a} className="konfigurator__uwaga" role="status">
              {a}
            </p>
          ))}
          {resolved.issues.map((i) => (
            <p key={`${i.code}-${i.part ?? ""}`} className="konfigurator__blad" role="alert">
              {i.message}
            </p>
          ))}
          {quote ? (
            <dl className="konfigurator__ceny">
              <div>
                <dt>{productName}</dt>
                <dd>{formatPLN(quote.base_price_gr)}</dd>
              </div>
              <div>
                <dt>Dopłata za wykończenie</dt>
                <dd>{formatPLN(quote.surcharge_gr)}</dd>
              </div>
              <div className="konfigurator__razem">
                <dt>Razem</dt>
                <dd>{total === null ? "—" : formatPLN(total)}</dd>
              </div>
            </dl>
          ) : (
            <p className="konfigurator__laduje">
              {quoteError ? "Nie udało się wycenić. Spróbuj ponownie." : "Liczę cenę…"}
            </p>
          )}
          {quote?.sku ? (
            <p className="konfigurator__sku">
              Kod zestawienia: <code>{quote.sku}</code>
            </p>
          ) : null}
          <p className="konfigurator__info">
            Wykonanie na zamówienie, wysyłka w ok. 7 dni roboczych. Zamawianie własnych zestawień
            uruchomimy w kolejnym wydaniu; teraz możesz je obejrzeć i zachować link z kodem.
          </p>
          <p>
            <a className="przycisk-tekstowy" href={productHref}>
              Wróć do produktu
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
