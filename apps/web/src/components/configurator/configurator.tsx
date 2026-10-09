"use client";
// F-250..F-254 (ADR-0011): konfigurator kolorow. Wybory klienta -> reguly z @taktyl/domain (natychmiast, ta sama logika
// co w API) -> scena 3D. Cena i SKU zawsze z `POST /v1/configurator/quote` (serwer); widok nie liczy kwot.
// Dostepnosc: kazdy wybor to przycisk radio z nazwa koloru, scena jest dekoracja (aria-hidden), stan oglasza region live.
import type { ConfiguratorData, ConfiguratorQuote } from "@taktyl/contracts";
import { formatPLN, resolveConfiguration, type Configuration } from "@taktyl/domain";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  allowedFinishes,
  configurableParts,
  paletteColors,
  printsForModel,
  supportsPrints,
  toDomainData,
} from "../../lib/configurator/model";
import type { StageHandle } from "./stage";

const Stage = dynamic(() => import("./stage"), { ssr: false });

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

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function explicitChoices(model: Model, parts: Choices): Choices {
  const out: Choices = {};
  for (const [id, c] of Object.entries(parts)) {
    const def = model.parts.find((p) => p.id === id)?.domyslnie;
    if (!def || def.kolor !== c.color || def.wykonczenie !== c.finish) out[id] = c;
  }
  return out;
}

export function Configurator({ data, model, productName, productHref, initial }: Props) {
  const domainData = useMemo(() => toDomainData(data), [data]);
  // Tylko wybory odbiegajace od domyslnych: reszta (spod, pokretlo, przyciski) podaza za czescia nadrzedna (ADR-0011).
  const [choices, setChoices] = useState<Choices>(() => explicitChoices(model, initial.parts));
  const [print, setPrint] = useState<string | null>(initial.print ?? null);
  const [quote, setQuote] = useState<ConfiguratorQuote | null>(null);
  const [quoteError, setQuoteError] = useState(false);
  const [stageState, setStageState] = useState<"loading" | "ready" | "error">("loading");
  const [canRender, setCanRender] = useState(true);
  const stage = useRef<StageHandle>(null);

  useEffect(() => setCanRender(webglAvailable()), []);

  const resolved = useMemo(
    () => resolveConfiguration(domainData, { model: model.id, parts: choices, print }),
    [domainData, model.id, choices, print],
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

  const parts = configurableParts(model);
  const printable = supportsPrints(data, model);
  const prints = printable ? printsForModel(data, model) : [];

  function choose(partId: string, patch: Partial<{ color: string; finish: string | null }>) {
    const part = model.parts.find((p) => p.id === partId);
    if (!part?.paleta) return;
    const palette = data.palettes[part.paleta];
    const finishes = allowedFinishes(data, model, part);
    const current = resolved.config.parts[partId];
    const color = patch.color ?? current?.color ?? part.domyslnie.kolor ?? "";
    let finish = patch.finish !== undefined ? patch.finish : (current?.finish ?? null);
    if ((palette?.wykonczenia.length ?? 0) > 0 && (!finish || !finishes.includes(finish))) {
      finish = finishes.includes(part.domyslnie.wykonczenie ?? "")
        ? part.domyslnie.wykonczenie
        : (finishes[0] ?? null);
    }
    if ((palette?.wykonczenia.length ?? 0) === 0) finish = null;
    setChoices((c) => ({ ...c, [partId]: { color, finish } }));
  }

  const total = quote?.ok ? quote.total_gr : null;
  const adjustments = resolved.adjustments.map((a) => {
    const label = model.parts.find((p) => p.id === a.part)?.etykieta ?? a.part;
    return `${label}: ${data.colors[a.from]?.label ?? a.from} zamieniono na ${data.colors[a.to]?.label ?? a.to}, bo kontrast z klawiszem był za niski.`;
  });

  return (
    <div className="konfigurator">
      <div className="konfigurator__scena" role="group" aria-label={`Podgląd 3D: ${productName}`}>
        {canRender && stageState !== "error" ? (
          <Stage
            model={model}
            data={data}
            config={resolved.config}
            handleRef={stage}
            onStatus={setStageState}
          />
        ) : (
          <p className="konfigurator__brak-3d" role="status">
            Podgląd 3D jest niedostępny w tej przeglądarce. Wybór kolorów obok działa, a cena i kod
            zestawienia poniżej zawsze się aktualizują.
          </p>
        )}
        {stageState === "loading" && canRender ? (
          <p className="konfigurator__laduje" role="status">
            Ładuję model…
          </p>
        ) : null}
        {stageState === "ready" ? (
          <div className="konfigurator__widok" role="group" aria-label="Obracanie modelu">
            <button
              type="button"
              className="przycisk-tekstowy"
              onClick={() => stage.current?.rotate(-30)}
            >
              Obróć w lewo
            </button>
            <button
              type="button"
              className="przycisk-tekstowy"
              onClick={() => stage.current?.rotate(30)}
            >
              Obróć w prawo
            </button>
            <button
              type="button"
              className="przycisk-tekstowy"
              onClick={() => stage.current?.view("front")}
            >
              Widok z przodu
            </button>
            <button
              type="button"
              className="przycisk-tekstowy"
              onClick={() => stage.current?.view("top")}
            >
              Widok z góry
            </button>
          </div>
        ) : null}
      </div>

      <div className="konfigurator__panel">
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
                  name="wzor"
                  checked={print === null}
                  onChange={() => setPrint(null)}
                />
                <span className="konfigurator__wzor-nazwa">Bez wzoru (kolor)</span>
              </label>
              {prints.map((p) => (
                <label key={p.id} className="konfigurator__wzor">
                  <input
                    type="radio"
                    name="wzor"
                    checked={print === p.id}
                    onChange={() => setPrint(p.id)}
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
          const palette = part.paleta ? data.palettes[part.paleta] : undefined;
          if (part.id === "wierzch" && print) return null;
          const colors = part.paleta ? paletteColors(data, part.paleta) : [];
          const finishes = allowedFinishes(data, model, part);
          const current = resolved.config.parts[part.id];
          const autoAllowed = palette?.auto === "kontrast";
          const currentLabel =
            choices[part.id]?.color === "auto"
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
                    aria-checked={choices[part.id]?.color === "auto"}
                    className="konfigurator__auto"
                    onClick={() => choose(part.id, { color: "auto", finish: null })}
                  >
                    Auto
                  </button>
                ) : null}
                {colors.map((key) => {
                  const c = data.colors[key];
                  if (!c) return null;
                  const on =
                    choices[part.id]?.color === key ||
                    (choices[part.id] === undefined && current?.color === key);
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
                      onClick={() => choose(part.id, { color: key })}
                    />
                  );
                })}
              </div>
              {finishes.length > 1 ? (
                <label className="konfigurator__wykonczenie">
                  <span>Wykończenie</span>
                  <select
                    value={current?.finish ?? ""}
                    onChange={(e) => choose(part.id, { finish: e.target.value })}
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
