"use client";
// F-250, F-251, F-255 (ADR-0011): panel wyboru czesci jednego modelu (wzor wierzchu podkladki, kolory i wykonczenia).
// Uzywany w konfiguratorze produktu i w „Stworz wlasny set”. Kazdy wybor to przycisk radio z nazwa koloru (a11y).
// Audyt UX: sekcje czesci jako akordeon (<details>) z miniatura biezacego wyboru (probka z colors.json) w naglowku,
// wykonczenie jako przelacznik segmentowy (radio) zamiast natywnego <select>, sekcje otwierane tez kliknieciem czesci
// na modelu 3D (`openPart`, F-257: `revealPart` ustawia tam fokus). Nazwa koloru w podpowiedzi (title) i w aria-label kazdej probki.
import { PartIcon } from "./ikony";
import type { ConfiguratorData } from "@taktyl/contracts";
import type { Configuration } from "@taktyl/domain";
import { useId, type ReactNode, type SyntheticEvent } from "react";
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
  /** Otwarta sekcja akordeonu (id czesci, "przelacznik", "wzor"); bez wlasciwosci - wszystkie otwarte jak dotad. */
  openPart?: string | null;
  onOpenPart?: (id: string | null) => void;
  /** Prefiks id sekcji (kilka paneli na jednej stronie w „Stworz wlasny set”). */
  idPrefix?: string;
}

/** id elementu sekcji akordeonu: cel przewiniecia po kliknieciu czesci na modelu. */
export const sectionId = (prefix: string, part: string) => `${prefix}czesc-${part}`;

/**
 * F-257: po kliknieciu czesci na modelu pokazuje jej sekcje i przenosi tam fokus (zaznaczona probka albo pierwszy
 * wybor). Otwiera tez zwiniete `<details>` nad sekcja (np. „Dobierz kolory części” w „Stworz wlasny set”). Wierzch
 * podkladki z nadrukiem nie ma sekcji koloru - wtedy sekcja wzoru. Wolane po otwarciu sekcji w stanie rodzica.
 */
export function revealPart(prefix: string, partId: string): void {
  const section =
    document.getElementById(sectionId(prefix, partId)) ??
    (partId === "wierzch" ? document.getElementById(sectionId(prefix, "wzor")) : null);
  if (!section) return;
  for (let d = section.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
    if (!d.open) d.open = true;
  }
  section.scrollIntoView?.({ block: "nearest" });
  const body = section.querySelector<HTMLElement>(".konfigurator__tresc-czesci") ?? section;
  const target =
    body.querySelector<HTMLElement>('[aria-checked="true"], input:checked') ??
    body.querySelector<HTMLElement>("button, input, select");
  (target ?? section.querySelector<HTMLElement>("summary"))?.focus({ preventScroll: true });
}

function Section({
  id,
  domId,
  title,
  openPart,
  onOpenPart,
  children,
}: {
  id: string;
  domId: string;
  title: ReactNode;
  openPart: string | null | undefined;
  onOpenPart: ((id: string | null) => void) | undefined;
  children: ReactNode;
}) {
  const accordion = openPart !== undefined && onOpenPart !== undefined;
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (!accordion) return;
    const open = e.currentTarget.open;
    if (open && openPart !== id) onOpenPart(id);
    else if (!open && openPart === id) onOpenPart(null);
  };
  return (
    <details
      id={domId}
      className="konfigurator__grupa konfigurator__sekcja-czesci"
      open={accordion ? openPart === id : true}
      onToggle={onToggle}
    >
      <summary className="konfigurator__naglowek-czesci">{title}</summary>
      <div className="konfigurator__tresc-czesci">{children}</div>
    </details>
  );
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
  openPart,
  onOpenPart,
  idPrefix = "",
}: Props) {
  const uid = useId();
  const parts = configurableParts(model);
  const printable = supportsPrints(data, model);
  const prints = printable ? printsForModel(data, model) : [];

  const keyboard = model.id.startsWith("k-");
  return (
    <>
      {keyboard ? (
        <Section
          id="przelacznik"
          domId={sectionId(idPrefix, "przelacznik")}
          openPart={openPart}
          onOpenPart={onOpenPart}
          title={
            <>
              <PartIcon id="przelaczniki" /> Przełącznik:{" "}
              <strong>{(switchId && data.switches[switchId]?.name) ?? ""}</strong>
            </>
          }
        >
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
        </Section>
      ) : null}
      {printable ? (
        <Section
          id="wzor"
          domId={sectionId(idPrefix, "wzor")}
          openPart={openPart}
          onOpenPart={onOpenPart}
          title={
            <>
              <PartIcon id="wierzch" /> Wzór wierzchu:{" "}
              <strong>
                {print ? (prints.find((p) => p.id === print)?.nazwa ?? "") : "bez wzoru"}
              </strong>
            </>
          }
        >
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
        </Section>
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
        const swatch = isAuto ? null : (data.colors[current?.color ?? ""]?.swatch ?? null);
        const finishLabel =
          finishes.length > 1 && current?.finish ? data.finishes[current.finish]?.label : null;
        return (
          <Section
            key={part.id}
            id={part.id}
            domId={sectionId(idPrefix, part.id)}
            openPart={openPart}
            onOpenPart={onOpenPart}
            title={
              <>
                <PartIcon id={part.id} /> {part.etykieta}:{" "}
                {swatch ? (
                  <span
                    className="konfigurator__miniatura"
                    style={{ backgroundColor: swatch }}
                    aria-hidden="true"
                  />
                ) : null}
                <span>
                  <strong>{currentLabel}</strong>
                  {finishLabel ? (
                    <span className="konfigurator__wykonczenie-nazwa">, {finishLabel}</span>
                  ) : null}
                </span>
              </>
            }
          >
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
              <div className="konfigurator__wykonczenie">
                <span id={`${uid}-${part.id}-wyk`}>Wykończenie</span>
                <div
                  className="konfigurator__segmenty"
                  role="radiogroup"
                  aria-labelledby={`${uid}-${part.id}-wyk`}
                >
                  {finishes.map((f) => (
                    <label key={f} className="konfigurator__segment">
                      <input
                        type="radio"
                        name={`${uid}-${part.id}-wykonczenie`}
                        value={f}
                        checked={(current?.finish ?? "") === f}
                        onChange={() => onChoose(part.id, { finish: f })}
                      />
                      <span>{data.finishes[f]?.label ?? f}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>
        );
      })}
    </>
  );
}
