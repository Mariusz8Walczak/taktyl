"use client";
// F-102, F-103, F-105, F-115 (docs/03 §2 kroki 1-3): lista produktow jako kafle radio, zetony szybkiego filtra,
// wybor wariantu po wyborze kafla (kolor, przelacznik z domyslnym profilu, rozmiar podkladki z wymiarami i cena).
// Wzorce: kafle `product-swatch-image` i probki `product-color-swatch` (docs/08 §3), przestylowane tokenami.
import { formatPLN, formatRangeWithUnit, formatWithUnit, isQuietProduct } from "@taktyl/domain";
import { ChoiceTile, FilterChip, ProductImage, Swatch } from "@taktyl/ui";
import { useState } from "react";
import { connectivityText, padSizeDescription } from "../../lib/catalog/attributes";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import {
  dimValues,
  isBuyable,
  optionStatus,
  resolveVariant,
  selectionOf,
  type Dim,
} from "../../lib/catalog/variants";
import {
  attrs,
  colorLabel,
  fromPrice,
  hasStock,
  packshotEntry,
  productsOf,
  sortForStep,
  widthCm,
  type BuilderProduct,
} from "../../lib/builder/catalog";
import { cx } from "../../lib/builder/cx";
import { padTileHint, type PadKind } from "../../lib/builder/fit";
import {
  SLOT_CATEGORY,
  SLOT_LABEL,
  STEP_LABEL,
  SLOT_STEP,
  type SlotKey,
} from "../../lib/builder/types";
import { stepCounter } from "./parts";
import { headingId, type BuilderApi } from "./use-builder";

/** Zeton filtra: klucz, etykieta i predykat produktu (docs/03 §2). */
interface Chip {
  id: string;
  label: string;
  group: string;
  test: (p: BuilderProduct) => boolean;
}

function chipsFor(api: BuilderApi, slot: SlotKey): Chip[] {
  const { model, state } = api;
  const products = productsOf(model, SLOT_CATEGORY[slot]);
  const chips: Chip[] = [];
  if (slot === "k") {
    const seen = new Set<string>();
    for (const p of products) {
      const size = attrs(p).size ?? "";
      if (p.category !== "klawiatury" || seen.has(size)) continue;
      seen.add(size);
      chips.push({
        id: `rozmiar-${size}`,
        label: attrs(p).size_label?.split(" (")[0] ?? size,
        group: "rozmiar",
        test: (x) => x.category === "klawiatury" && attrs(x).size === size,
      });
    }
    chips.push({
      id: "bezprzewodowe",
      label: "Bezprzewodowe",
      group: "lacznosc",
      test: (x) =>
        x.category === "klawiatury" &&
        (attrs(x).connectivity ?? []).some((c) => c === "bt" || c === "2.4ghz"),
    });
    chips.push({
      id: "ciche",
      label: "Ciche",
      group: "dzwiek",
      test: (x) => x.category === "klawiatury" && isQuietProduct(x),
    });
  } else if (slot === "m") {
    chips.push({
      id: "waga",
      label: "Do 60 g",
      group: "waga",
      test: (x) => x.category === "myszki" && (attrs(x).weight_g ?? Infinity) <= 60,
    });
    const shapes = new Set<string>();
    for (const p of products) {
      const shape = attrs(p).shape ?? "";
      if (p.category !== "myszki" || shapes.has(shape)) continue;
      shapes.add(shape);
      chips.push({
        id: `ksztalt-${shape}`,
        label: shape.charAt(0).toUpperCase() + shape.slice(1),
        group: "ksztalt",
        test: (x) => x.category === "myszki" && attrs(x).shape === shape,
      });
    }
    if (state.handCm !== null) {
      const hand = state.handCm;
      chips.push({
        id: "dlon",
        label: "Pasuje do mojej dłoni",
        group: "dlon",
        test: (x) => {
          const r = attrs(x).hand_cm;
          return x.category === "myszki" && r !== undefined && r[0] <= hand && hand <= r[1];
        },
      });
    }
  }
  return chips;
}

function tileLines(api: BuilderApi, slot: SlotKey, p: BuilderProduct): string[] {
  const { model, state, analysis, padKind } = api;
  const price = `od ${formatPLN(fromPrice(p))}`;
  if (p.category === "klawiatury") {
    return [
      [widthCm(p), connectivityText(attrs(p).connectivity ?? [])].filter(Boolean).join(" · "),
      price,
    ];
  }
  if (p.category === "myszki") {
    const [min, max] = attrs(p).hand_cm ?? [0, 0];
    const lines = [
      `dla dłoni ${formatRangeWithUnit(min, max, "cm")}`,
      `${formatWithUnit(attrs(p).weight_g ?? 0, "g")} · ${attrs(p).shape ?? ""}`,
    ];
    if (state.handCm !== null) {
      lines.push(
        min <= state.handCm && state.handCm <= max
          ? "Pasuje do Twojej dłoni"
          : "Poza zakresem Twojej dłoni",
      );
    }
    lines.push(price);
    return lines;
  }
  const hint = padTileHint(model, state.profile, analysis.entries.k, p, padKind);
  void slot;
  return [attrs(p).surface ?? "", ...(hint ? [hint] : []), price];
}

function Tile({
  api,
  slot,
  product,
  checked,
}: {
  api: BuilderApi;
  slot: SlotKey;
  product: BuilderProduct;
  checked: boolean;
}) {
  const { model } = api;
  const base =
    product.variants.find((v) => v.sku === product.default_variant_sku) ?? product.variants[0];
  const soldOut = !hasStock(product);
  const lines = tileLines(api, slot, product);
  return (
    <label className={cx("tk-kafel", "kafel-produktu", soldOut && "kafel-produktu--brak")}>
      <input
        type="radio"
        name={`produkt-${slot}`}
        value={product.id}
        className="tk-kafel__input"
        checked={checked}
        onChange={() => api.selectProduct(slot, product)}
      />
      <span className="tk-kafel__tresc kafel-produktu__tresc">
        {base ? (
          <span className="kafel-produktu__zdjecie">
            <ProductImage
              entry={packshotEntry(product, base)}
              baseUrl={MEDIA_BASE_URL}
              productName={product.name}
              colorName={colorLabel(model, base.color)}
              decorative
              sizes="(min-width: 992px) 20vw, 100vw"
            />
          </span>
        ) : null}
        <span className="tk-kafel__tytul">{product.name}</span>
        {lines.map((l) => (
          <span key={l} className="tk-kafel__opis">
            {l}
          </span>
        ))}
        {soldOut ? <span className="tk-kafel__brak">Brak w magazynie</span> : null}
        {checked ? <span className="kafel-produktu__wybrano">Wybrano</span> : null}
      </span>
    </label>
  );
}

/** F-103: wybor wariantu po wyborze kafla - kolor (probki z nazwa), przelacznik (kafle), rozmiar podkladki. */
function VariantPanel({ api, slot }: { api: BuilderApi; slot: SlotKey }) {
  const { model, state, analysis } = api;
  const entry = analysis.entries[slot];
  const found = entry ? model.bySku.get(entry.variant.sku) : undefined;
  if (!found) return null;
  const { product, variant } = found;
  const variants = product.variants;
  const selection = selectionOf(variant);
  const colorIds = dimValues(variants, "color");
  const switchIds = dimValues(variants, "switch");
  const sizeIds = dimValues(variants, "size");
  const pick = (dim: Dim, value: string) => {
    const next = resolveVariant(variants, selection, dim, value);
    if (next) api.selectVariant(slot, next.sku, dim);
  };
  const status = (dim: Dim, value: string) => optionStatus(variants, selection, dim, value);
  const defaultSwitch = state.profile
    ? model.rules.profiles[state.profile]?.default_switch
    : undefined;
  const sizes = product.category === "podkladki" ? attrs(product).sizes : undefined;
  return (
    <fieldset className="wariant-kreatora">
      <legend className="wariant-kreatora__legenda">Wariant: {product.name}</legend>
      {colorIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">
            Kolor: <strong>{colorLabel(model, variant.color)}</strong>
          </legend>
          <div className="wariant__probki">
            {colorIds.map((id) => {
              const st = status("color", id);
              return (
                <Swatch
                  key={id}
                  name={`kolor-${slot}`}
                  value={id}
                  label={colorLabel(model, id)}
                  swatch={model.colors.find((c) => c.id === id)?.swatch ?? ""}
                  checked={selection.color === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak" : undefined}
                  onChange={() => pick("color", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {switchIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">Przełącznik</legend>
          <div className="wariant__kafle">
            {switchIds.map((id) => {
              const sw = model.switches.find((s) => s.id === id);
              const st = status("switch", id);
              const parts = [sw ? `${sw.type_label}, ${formatWithUnit(sw.force_g, "g")}` : ""];
              if (id === defaultSwitch) parts.push("polecany dla profilu");
              if (st === "brak") parts.push("Brak");
              return (
                <ChoiceTile
                  key={id}
                  name={`przelacznik-${slot}`}
                  value={id}
                  title={sw?.name ?? id}
                  description={parts.filter(Boolean).join(" · ")}
                  checked={selection.switch === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => pick("switch", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {sizeIds.length > 0 ? (
        <fieldset className="wariant">
          <legend className="wariant__nazwa">Rozmiar</legend>
          <div className="wariant__kafle">
            {sizeIds.map((id) => {
              const size = sizes?.[id];
              const st = status("size", id);
              const target = resolveVariant(variants, selection, "size", id);
              const parts = [
                size ? padSizeDescription(size.w, size.d) : "",
                target ? formatPLN(target.price_gr) : "",
              ];
              if (st === "brak") parts.push("Brak");
              return (
                <ChoiceTile
                  key={id}
                  name={`rozmiar-${slot}`}
                  value={id}
                  title={size?.label ?? id.toUpperCase()}
                  description={parts.filter(Boolean).join(" · ")}
                  checked={selection.size === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => pick("size", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {!isBuyable(variant) ? (
        <p className="wariant-kreatora__brak">Brak — wybierz inny wariant</p>
      ) : null}
    </fieldset>
  );
}

function PadKindToggle({ api }: { api: BuilderApi }) {
  const options: { id: PadKind; label: string }[] = [
    { id: "biurko", label: "Na całe biurko (XL, XXL)" },
    { id: "mysz", label: "Pod samą myszkę (M, L)" },
  ];
  return (
    <fieldset className="przelacznik-typu">
      <legend className="przelacznik-typu__legenda">Rodzaj podkładki</legend>
      <div className="kafle kafle--typ">
        {options.map((o) => (
          <ChoiceTile
            key={o.id}
            name="rodzaj-podkladki"
            value={o.id}
            title={o.label}
            checked={api.padKind === o.id}
            onChange={() => api.setPadKind(o.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Kroki 1-3. Przycisk "Dalej" jest w pasku akcji kreatora (jeden, na telefonie przyklejony do dolu). */
export function StepProducts({ api, slot }: { api: BuilderApi; slot: SlotKey }) {
  const { model, state, analysis, padKind } = api;
  const step = SLOT_STEP[slot];
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const chips = chipsFor(api, slot);
  const currentId = analysis.entries[slot]?.product.id ?? null;

  const list = (() => {
    const sorted = sortForStep(productsOf(model, SLOT_CATEGORY[slot]), state.profile);
    const groups = new Map<string, Chip[]>();
    for (const c of chips)
      if (active.has(c.id)) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    return sorted.filter((p) => {
      if (p.id === currentId) return true; // wybrany kafel nie znika po zmianie filtra
      if (
        slot === "p" &&
        !p.variants.some((v) => v.size !== null && matchesKind(p, v.size, padKind))
      )
        return false;
      return [...groups.values()].every((g) => g.some((c) => c.test(p)));
    });
  })();

  const toggle = (id: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <fieldset className="krok">
      <legend className="krok__legenda">
        <h2 id={headingId(step)} tabIndex={-1} className="krok__naglowek">
          {stepCounter(step)}: {STEP_LABEL[step]}
        </h2>
      </legend>
      <p className="krok__wstep">
        {slot === "p"
          ? "Wybierz podkładkę. Na kaflu widać, czy zmieści się Twoja klawiatura i ruch myszki."
          : `Wybierz ${SLOT_LABEL[slot].acc}. Lista jest uporządkowana od najlepiej dopasowanej${state.profile ? " do wybranego profilu" : ""}.`}
      </p>
      {slot === "p" ? <PadKindToggle api={api} /> : null}
      {chips.length > 0 ? (
        <div role="group" aria-label="Szybki filtr" className="zetony">
          {chips.map((c) => (
            <FilterChip key={c.id} active={active.has(c.id)} onClick={() => toggle(c.id)}>
              {c.label}
            </FilterChip>
          ))}
        </div>
      ) : null}
      <div className="kafle kafle--produkty">
        {list.map((p) => (
          <Tile key={p.id} api={api} slot={slot} product={p} checked={p.id === currentId} />
        ))}
      </div>
      {list.length === 0 ? (
        <p className="krok__pusto">
          Żaden model nie spełnia wybranych filtrów. Wyłącz któryś żeton.
        </p>
      ) : null}
      <VariantPanel api={api} slot={slot} />
    </fieldset>
  );
}

function matchesKind(p: BuilderProduct, sizeKey: string, kind: PadKind): boolean {
  return p.category === "podkladki" && attrs(p).sizes?.[sizeKey]?.type === kind;
}
