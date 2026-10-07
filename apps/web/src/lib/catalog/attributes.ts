// F-041, F-070 (docs/04 §4): etykiety i formaty atrybutow. Liczby z jednostka maja twarda spacje, liczby po polsku
// (formatery z @taktyl/domain, regula 7). Parametry kluczowe karty to same atrybuty, bez przymiotnikow.
import type { Product } from "@taktyl/contracts";
import {
  formatCmFromMm,
  formatDimensionsCm,
  formatNumber,
  formatRangeWithUnit,
  formatWeight,
  formatWithUnit,
} from "@taktyl/domain";

export interface Param {
  label: string;
  value: string;
}

const CONNECTIVITY: Record<string, string> = {
  "usb-c": "przewód USB-C",
  "2.4ghz": "2,4 GHz",
  bt: "Bluetooth",
  przewod: "przewód",
};
const HAND: Record<string, string> = { prawa: "dla praworęcznych", obureczna: "oburęczna" };
const GRIP: Record<string, string> = {
  palm: "dłoniowy (palm)",
  claw: "szponowy (claw)",
  fingertip: "opuszkowy (fingertip)",
};
const PURPOSE: Record<string, string> = { mysz: "pod myszkę", biurko: "na całe biurko" };

export const yesNo = (b: boolean): string => (b ? "tak" : "nie");

export function connectivityText(list: readonly string[]): string {
  return list.map((c) => CONNECTIVITY[c] ?? c).join(", ");
}

export interface SwitchLike {
  id: string;
  name: string;
  type_label: string;
  force_g: number;
}

/** F-041: trzy parametry kluczowe karty na listingu. */
export function keyParams(product: Product, switches: readonly SwitchLike[]): Param[] {
  switch (product.category) {
    case "klawiatury": {
      const used = new Set<string>();
      for (const v of product.variants) if (v.switch !== null) used.add(v.switch);
      const names = switches.filter((s) => used.has(s.id)).map((s) => s.name);
      const a = product.attributes;
      return [
        { label: "Rozmiar", value: a.size_label },
        { label: "Łączność", value: connectivityText(a.connectivity) },
        { label: "Przełączniki", value: names.join(", ") },
      ];
    }
    case "myszki": {
      const a = product.attributes;
      return [
        { label: "Waga", value: formatWeight(a.weight_g) },
        { label: "Kształt", value: a.shape },
        { label: "Dłoń", value: formatRangeWithUnit(a.hand_cm[0], a.hand_cm[1], "cm") },
      ];
    }
    case "podkladki": {
      const a = product.attributes;
      const sizes = Object.values(a.sizes)
        .map((s) => s.label)
        .join(", ");
      return [
        { label: "Powierzchnia", value: a.surface },
        { label: "Rozmiary", value: sizes },
        { label: "Materiał", value: a.material },
      ];
    }
  }
}

/** "90 × 40 cm" z milimetrow (twarda spacja przed jednostka). */
function sizeCm(w: number, d: number): string {
  return `${formatCmFromMm(w)} × ${formatCmFromMm(d)}\u00A0cm`;
}

/** F-070: wiersze specyfikacji niezalezne od wariantu (kolejnosc i etykiety z docs/04 §4). Puste wartosci pomijane. */
export function specRows(product: Product): Param[] {
  const rows: Param[] = [];
  switch (product.category) {
    case "klawiatury": {
      const a = product.attributes;
      rows.push(
        { label: "Rozmiar", value: a.size_label },
        { label: "Liczba klawiszy", value: formatNumber(a.keys) },
        { label: "Układ", value: a.layout },
        { label: "Łączność", value: connectivityText(a.connectivity) },
        { label: "Obudowa", value: a.case },
        { label: "Mocowanie płyty", value: a.mount },
        { label: "Wymiana przełączników bez lutowania", value: yesNo(a.hotswap) },
        { label: "Keycapy", value: a.keycaps },
        { label: "Podświetlenie", value: a.backlight },
      );
      if (a.battery !== null) rows.push({ label: "Akumulator", value: a.battery });
      rows.push(
        { label: "Pokrętło", value: yesNo(a.knob) },
        { label: "Waga", value: formatWeight(a.weight_g) },
        {
          label: "Wymiary (szer. × gł. × wys.)",
          value: formatDimensionsCm([a.dims_mm.w, a.dims_mm.d, a.dims_mm.h]),
        },
      );
      break;
    }
    case "myszki": {
      const a = product.attributes;
      rows.push(
        { label: "Kształt", value: a.shape },
        { label: "Ręka", value: HAND[a.hand] ?? a.hand },
      );
      if (a.hand_note) rows.push({ label: "Uwagi", value: a.hand_note });
      rows.push(
        { label: "Rozmiar", value: a.size },
        { label: "Długość dłoni", value: formatRangeWithUnit(a.hand_cm[0], a.hand_cm[1], "cm") },
        { label: "Chwyt", value: a.grips.map((g) => GRIP[g] ?? g).join(", ") },
        { label: "Waga", value: formatWeight(a.weight_g) },
        {
          label: "Wymiary (dł. × szer. × wys.)",
          value: formatDimensionsCm([a.dims_mm.d, a.dims_mm.w, a.dims_mm.h]),
        },
        { label: "Łączność", value: connectivityText(a.connectivity) },
        { label: "Rozdzielczość maks.", value: formatWithUnit(a.dpi_max, "DPI") },
        { label: "Częstotliwość raportowania", value: formatWithUnit(a.polling_hz, "Hz") },
      );
      if (a.battery !== null) rows.push({ label: "Bateria", value: a.battery });
      rows.push({ label: "Sensor", value: a.sensor });
      break;
    }
    case "podkladki": {
      const a = product.attributes;
      rows.push(
        { label: "Powierzchnia", value: a.surface },
        { label: "Materiał", value: a.material },
        { label: "Grubość", value: formatWithUnit(a.thickness_mm, "mm") },
        { label: "Krawędź", value: a.edge },
      );
      break;
    }
  }
  return rows;
}

export interface PadSizeLike {
  label: string;
  w: number;
  d: number;
  type: string;
}

export interface VariantSpecInput {
  category: string;
  /** Tylko podkladki: attributes.sizes. */
  sizes?: Readonly<Record<string, PadSizeLike | undefined>>;
}

/** F-070: wiersze zalezne od wybranego wariantu (przelacznik; rozmiar i przeznaczenie podkladki). */
export function variantSpecRows(
  product: VariantSpecInput,
  variant: { switch: string | null; size: string | null },
  switches: readonly SwitchLike[],
): Param[] {
  const rows: Param[] = [];
  if (product.category === "klawiatury" && variant.switch !== null) {
    const s = switches.find((x) => x.id === variant.switch);
    if (s) {
      rows.push({
        label: "Przełącznik",
        value: `${s.name} (${s.type_label}, ${formatWithUnit(s.force_g, "g")})`,
      });
    }
  }
  if (product.category === "podkladki" && variant.size !== null) {
    const s = product.sizes?.[variant.size];
    if (s) {
      rows.push(
        { label: "Rozmiar", value: `${s.label} · ${sizeCm(s.w, s.d)}` },
        { label: "Przeznaczenie", value: PURPOSE[s.type] ?? s.type },
      );
    }
  }
  return rows;
}

/** Podpis kafla rozmiaru podkladki: wymiary w cm (F-062). */
export function padSizeDescription(w: number, d: number): string {
  return sizeCm(w, d);
}
