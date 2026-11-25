"use client";
// B-624 (docs/25 par. 2): zakres dat pulpitu i ruchu w adresie (?zakres=30 | ?od=&do=, ?porownanie=nie), dni w Europe/Warsaw.
// Adres mozna udostepnic; zmiana zakresu nie przeladowuje strony (router.replace).
import type { StatsRangeQuery } from "@taktyl/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export const RANGE_PRESETS = [
  { id: "1", label: "Dziś", days: 1 },
  { id: "7", label: "7 dni", days: 7 },
  { id: "30", label: "30 dni", days: 30 },
  { id: "90", label: "90 dni", days: 90 },
] as const;
export type RangePresetId = (typeof RANGE_PRESETS)[number]["id"] | "wlasny";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const warsawDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const warsawToday = (now = new Date()): string => warsawDate.format(now);

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface RangeState {
  preset: RangePresetId;
  from: string;
  to: string;
  compare: boolean;
  query: StatsRangeQuery;
}

/** Stan zakresu z parametrow adresu (czysta funkcja, testowalna). */
export function rangeFromParams(params: URLSearchParams, today = warsawToday()): RangeState {
  const compare = params.get("porownanie") !== "nie";
  const od = params.get("od") ?? "";
  const doo = params.get("do") ?? "";
  if (ISO.test(od) && ISO.test(doo) && od <= doo) {
    return {
      preset: "wlasny",
      from: od,
      to: doo,
      compare,
      query: { from: od, to: doo, compare: compare ? "previous" : "none" },
    };
  }
  const preset = RANGE_PRESETS.find((p) => p.id === params.get("zakres")) ?? RANGE_PRESETS[2];
  const from = addDays(today, -(preset.days - 1));
  return {
    preset: preset.id,
    from,
    to: today,
    compare,
    query: { from, to: today, compare: compare ? "previous" : "none" },
  };
}

export function useRange() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useMemo(() => rangeFromParams(new URLSearchParams(params.toString())), [params]);
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return {
    ...state,
    setPreset: (id: RangePresetId) =>
      update(id === "wlasny" ? { zakres: null } : { zakres: id, od: null, do: null }),
    setCustom: (from: string, to: string) => update({ od: from, do: to, zakres: null }),
    setCompare: (on: boolean) => update({ porownanie: on ? null : "nie" }),
  };
}

/** Zmiana procentowa do poprzedniego okresu (liczba calkowita) albo null, gdy nie ma z czym porownac. */
export function deltaPercent(value: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return value === 0 ? 0 : null;
  return Math.round(((value - previous) / previous) * 100);
}
