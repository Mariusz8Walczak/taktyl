"use client";
// F-104, F-105, F-106, F-107, F-110, A-06 (hak), A-08 (hak), A-16 (hak) (docs/03 §3-§6): prawa kolumna kreatora -
// podglad biurka (DeskStage), wyniki dopasowania, trzy pozycje, ceny i przycisk dodania. Wzorzec: przyklejone
// podsumowanie (`checkout.html`, kolumna zamowienia) i suma (`product-frequently-bought-together.html`), docs/08 §6.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { formatPLN, mouseZoneMm } from "@taktyl/domain";
import { Button, DeskStage, ProductImage, TextButton } from "@taktyl/ui";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import {
  attrs,
  colorLabel,
  packshotEntry,
  textureEntry,
  topdownEntry,
  variantText,
  type BuilderProduct,
} from "../../lib/builder/catalog";
import { cx } from "../../lib/builder/cx";
import { SLOT_LABEL, SLOT_STEP, SLOTS, type SlotKey } from "../../lib/builder/types";
import { useCompleteRing } from "../../lib/motion/set-complete";
import { Kwota } from "./parts";
import type { BuilderApi } from "./use-builder";

const LEVEL_LABEL = { uwaga: "Uwaga", ok: "OK", info: "Info" } as const;

/** Wiersz wyniku dopasowania; A-08: wchodzi (opacity + translateY) tylko, gdy zostal dodany po zaladowaniu strony. */
function FitResult({
  level,
  animate,
  children,
}: {
  level: keyof typeof LEVEL_LABEL;
  animate: boolean;
  children: ReactNode;
}) {
  const [isNew] = useState(animate); // zatrzask: stan z chwili montowania wiersza
  return <li className={cx("wynik", `wynik--${level}`, isNew && "is-nowy")}>{children}</li>;
}

/** F-104 (docs/03 §4.5): lista wynikow; naglowek w regionie aria-live, miejsce na 2 wiersze zarezerwowane (A-08). */
export function FitResults({ api }: { api: BuilderApi }) {
  const { analysis } = api;
  const { report } = analysis;
  // A-08: animacje dostaja tylko wiersze dodane po zaladowaniu (pierwszy ekran bez opacity 0)
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);
  const hasResults = report.results.length > 0;
  // F-104 (docs/03 §3): na telefonie lista wynikow jest zwinieta; przelacznik to button z aria-expanded.
  const [open, setOpen] = useState(false);
  return (
    <section
      className={cx("wyniki", open && "is-rozwiniete")}
      aria-labelledby="wyniki-tytul"
      data-rozwiniete={open ? "true" : "false"}
    >
      <h3 id="wyniki-tytul" className="wyniki__tytul">
        Dopasowanie
      </h3>
      <p className="wyniki__naglowek" role="status" aria-live="polite" aria-atomic="true">
        {hasResults
          ? report.headline
          : "Sprawdzimy dopasowanie, gdy wybierzesz klawiaturę, myszkę i podkładkę."}
      </p>
      {/* Tylko telefon (CSS): zwinieta linia "Wyniki: ..." rozwijajaca liste. */}
      <button
        type="button"
        className="wyniki__przelacznik"
        aria-expanded={open}
        aria-controls="wyniki-lista"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wyniki__przelacznik-tekst">
          Wyniki: {hasResults ? report.headline.toLowerCase() : "po wyborze setu"}
        </span>
        <span className="wyniki__przelacznik-akcja">{open ? "ukryj" : "pokaż"}</span>
      </button>
      {/* A-08: min. wysokosc dwoch wierszy - pojawienie sie komunikatu nie przesuwa tresci */}
      <ul id="wyniki-lista" className="lista wyniki__lista">
        {report.results.map((r) => (
          <FitResult key={r.id} level={r.level} animate={armed}>
            <span className="wynik__etykieta">{LEVEL_LABEL[r.level]}</span>
            <span className="wynik__tresc">
              <span className="wynik__tekst">{r.message}</span>
              {r.suggestion ? (
                <Button
                  variant="secondary"
                  className="wynik__propozycja"
                  onClick={() =>
                    api.applySuggestion(r.suggestion as NonNullable<typeof r.suggestion>)
                  }
                >
                  {r.suggestion.label}
                </Button>
              ) : null}
            </span>
          </FitResult>
        ))}
      </ul>
      {report.noProfileNotice ? <p className="wyniki__profil">{report.noProfileNotice}</p> : null}
    </section>
  );
}

/** F-106: podglad biurka zasilany stanem kreatora; elementy z manifestu albo placeholdery w wymiarach z danych. */
export function DeskView({ api }: { api: BuilderApi }) {
  const { model, state, analysis } = api;
  const { k, m, p } = analysis.entries;
  const bp = (e: { product: { id: string } } | null): BuilderProduct | null =>
    e ? (model.byId.get(e.product.id) ?? null) : null;
  const kp = bp(k);
  const mp = bp(m);
  const pp = bp(p);
  const swatch = (color: string) => model.colors.find((c) => c.id === color)?.swatch ?? "";
  const padSize = p && pp ? attrs(pp).sizes?.[p.variant.size ?? ""] : undefined;
  return (
    <DeskStage
      className="kreator__scena"
      baseUrl={MEDIA_BASE_URL}
      zoneMm={mouseZoneMm(state.profile, model.rules)}
      gapMm={model.rules.gap_keyboard_mouse_mm}
      marginMm={model.rules.edge_margin_mm}
      result={analysis.deskResult}
      keyboard={
        k && kp
          ? {
              name: kp.name,
              colorName: colorLabel(model, k.variant.color),
              dimsMm: {
                w: k.product.attributes.dims_mm?.w ?? 0,
                d: k.product.attributes.dims_mm?.d ?? 0,
              },
              entry: topdownEntry(kp, k.variant.color),
            }
          : null
      }
      mouse={
        m && mp
          ? {
              name: mp.name,
              colorName: colorLabel(model, m.variant.color),
              dimsMm: {
                w: m.product.attributes.dims_mm?.w ?? 0,
                d: m.product.attributes.dims_mm?.d ?? 0,
              },
              entry: topdownEntry(mp, m.variant.color),
            }
          : null
      }
      pad={
        p && pp && padSize
          ? {
              name: pp.name,
              sizeLabel: padSize.label,
              colorName: colorLabel(model, p.variant.color),
              sizeMm: { w: padSize.w, d: padSize.d, type: padSize.type },
              entry: textureEntry(pp, p.variant.color),
              swatch: swatch(p.variant.color),
            }
          : null
      }
    />
  );
}

function minus(gr: number): string {
  return `−${formatPLN(gr)}`;
}

/** Zdanie wyjasniajace, dlaczego nie mozna dodac setu (F-110, docs/03 §8). */
export function addBlocker(api: BuilderApi): string | null {
  const { analysis } = api;
  if (!analysis.complete)
    return "Wybierz klawiaturę, myszkę i podkładkę, żeby dodać set do koszyka.";
  if (analysis.soldOut.length > 0)
    return "Wybrany wariant jest niedostępny. Wybierz inny wariant, żeby dodać set do koszyka.";
  return null;
}

function Rows({ api }: { api: BuilderApi }) {
  const { model, analysis } = api;
  return (
    <ol className="lista pozycje">
      {SLOTS.map((slot: SlotKey) => {
        const e = analysis.entries[slot];
        const found = e ? model.bySku.get(e.variant.sku) : undefined;
        const soldOut = analysis.soldOut.includes(slot);
        return (
          <li key={slot} className={cx("pozycja", !e && "is-pusta", soldOut && "is-brak")}>
            {found && e ? (
              <>
                <div className="pozycja__zdjecie">
                  <ProductImage
                    entry={packshotEntry(found.product, found.variant)}
                    baseUrl={MEDIA_BASE_URL}
                    productName={found.product.name}
                    colorName={colorLabel(model, found.variant.color)}
                    decorative
                    sizes="4rem"
                  />
                </div>
                <div className="pozycja__opis">
                  <p className="pozycja__nazwa">{found.product.name}</p>
                  <p className="pozycja__wariant">
                    {variantText(model, found.product, found.variant)}
                  </p>
                  {soldOut ? <p className="pozycja__brak">Brak — wybierz inny wariant</p> : null}
                </div>
                <p className="pozycja__cena">{formatPLN(e.variant.price)}</p>
                <TextButton
                  className="pozycja__zmien"
                  aria-label={`Zmień ${SLOT_LABEL[slot].acc}: ${found.product.name}`}
                  onClick={() => api.goStep(SLOT_STEP[slot])}
                >
                  Zmień
                </TextButton>
              </>
            ) : (
              <>
                <div className="pozycja__opis">
                  <p className="pozycja__nazwa">
                    {SLOT_LABEL[slot].nom[0]?.toUpperCase()}
                    {SLOT_LABEL[slot].nom.slice(1)}
                  </p>
                  <p className="pozycja__wariant">Nie wybrano</p>
                </div>
                <TextButton
                  className="pozycja__zmien"
                  aria-label={`Wybierz ${SLOT_LABEL[slot].acc}`}
                  onClick={() => api.goStep(SLOT_STEP[slot])}
                >
                  Wybierz
                </TextButton>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** F-107 (docs/03 §6): suma, rabat za set (tylko komplet), razem, "Oszczedzasz"; niepelny set: zdanie z kwota rabatu. */
export function PriceBlock({ api }: { api: BuilderApi }) {
  const { analysis } = api;
  const { price } = analysis;
  if (analysis.count === 0) return null;
  return (
    <div className="ceny" data-testid="ceny-setu">
      <dl className="ceny__lista">
        {price.complete ? (
          <>
            <div className="ceny__wiersz">
              <dt>Suma</dt>
              <dd>{formatPLN(price.sum)}</dd>
            </div>
            <div className="ceny__wiersz ceny__wiersz--rabat">
              <dt>Rabat za set</dt>
              <dd>{minus(price.discount)}</dd>
            </div>
          </>
        ) : null}
        <div className="ceny__wiersz ceny__wiersz--razem">
          <dt>Razem</dt>
          <dd>
            <Kwota gr={price.total} />
          </dd>
        </div>
      </dl>
      {price.complete && price.discount > 0 ? (
        <p className="ceny__oszczedzasz">Oszczędzasz {formatPLN(price.savings)}</p>
      ) : null}
      {!price.complete && analysis.discountHint ? (
        <p className="ceny__podpowiedz">{analysis.discountHint}</p>
      ) : null}
    </div>
  );
}

/** Prawa kolumna na komputerze, na telefonie: podglad u gory, a lista pozycji i cen na kroku "Podsumowanie". */
export function Summary({ api }: { api: BuilderApi }) {
  const blocker = addBlocker(api);
  // A-16: klasa znika po animacji pierscienia (animationName "obieg", nie po animacjach potomkow) albo po czasie zapasowym
  const onAnimationEnd = useCompleteRing(api.justCompleted, api.clearCompleted);
  return (
    <aside
      aria-label="Podsumowanie setu"
      className={cx("kreator__podsumowanie", "podsumowanie", api.justCompleted && "is-komplet")}
      data-krok={api.state.step}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="kreator__podglad">
        <DeskView api={api} />
        <FitResults api={api} />
      </div>
      <div className="kreator__lista">
        <h3 className="kreator__lista-tytul">Twój set</h3>
        <Rows api={api} />
        <PriceBlock api={api} />
        <Button
          className="kreator__dodaj"
          loading={api.busy}
          disabled={blocker !== null}
          aria-describedby={blocker ? "powod-dodania" : undefined}
          onClick={() => void api.addToCart()}
        >
          Dodaj set do koszyka
        </Button>
        {blocker ? (
          <p id="powod-dodania" className="kreator__powod">
            {blocker}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
