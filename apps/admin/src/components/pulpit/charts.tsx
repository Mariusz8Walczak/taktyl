"use client";
// B-610, B-611, B-620 (docs/25 par. 2, decyzja wlasciciela 2026-11-25): wykresy z biblioteki Recharts jako wizualizacja
// danych (nie ilustracja). Kolory serii wylacznie z tokenow (zmienne --adm-seria-* w pulpit.css), bez animacji (regula 6),
// liczby na osiach i w podpowiedziach przez Intl (regula 7). Kazdy wykres ma obok tekst i tabele danych (dostepnosc).
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDayLong,
  formatDayShort,
  formatInt,
  formatPLN,
  formatPLNCompact,
} from "../../lib/format";

const AXIS = { fontSize: "var(--t-xs)", fill: "var(--tekst-slaby)" } as const;

/** Mini-wykres trendu w kaflu KPI. Dekoracja: wartosc i zmiana sa w tekscie kafla. */
export function Sparkline({
  values,
  tone = "seria-1",
}: {
  values: number[];
  tone?: "seria-1" | "seria-2";
}) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="adm-sparkline" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={`var(--adm-${tone})`}
            strokeWidth={2}
            fill={`var(--adm-${tone})`}
            fillOpacity={0.14}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TipRow {
  value?: unknown;
  dataKey?: unknown;
  name?: unknown;
  payload?: Record<string, unknown>;
}
interface TipProps {
  active?: boolean;
  payload?: readonly TipRow[];
  label?: unknown;
}

function TipBox({ children }: { children: ReactNode }) {
  return <div className="adm-wykres-podpowiedz">{children}</div>;
}

export interface SeriesDay {
  date: string;
  value: number;
  prev: number | null;
  prevDate: string | null;
}

/** Wartosc dzien po dniu z linia okresu poprzedniego (przerywana). `money` = grosze, inaczej liczba sztuk. */
export function DailyChart({
  days,
  money,
  label,
  prevLabel,
}: {
  days: SeriesDay[];
  money: boolean;
  label: string;
  prevLabel: string;
}) {
  const fmt = (v: number) => (money ? formatPLN(v) : formatInt(v));
  const renderTip = (raw: unknown) => {
    const p = raw as TipProps;
    if (!p.active || !p.payload || p.payload.length === 0) return null;
    const row = p.payload[0]?.payload as unknown as SeriesDay | undefined;
    if (!row) return null;
    return (
      <TipBox>
        <strong>{formatDayLong(row.date)}</strong>
        <span>
          {label}: {fmt(row.value)}
        </span>
        {row.prev !== null && row.prevDate ? (
          <span className="adm-tekst-slaby">
            {prevLabel} ({formatDayShort(row.prevDate)}): {fmt(row.prev)}
          </span>
        ) : null}
      </TipBox>
    );
  };
  const hasPrev = days.some((d) => d.prev !== null);
  return (
    <div className="adm-wykres" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--adm-siatka)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDayShort(v)}
            tick={AXIS}
            stroke="var(--adm-siatka)"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => (money ? formatPLNCompact(v) : formatInt(v))}
            tick={AXIS}
            stroke="var(--adm-siatka)"
            width={money ? 76 : 40}
            allowDecimals={false}
          />
          <Tooltip
            content={renderTip}
            cursor={{ stroke: "var(--linia-pola)" }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke="var(--adm-seria-1)"
            strokeWidth={2}
            fill="var(--adm-seria-1)"
            fillOpacity={0.12}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: "var(--adm-seria-1)", stroke: "var(--powierzchnia)" }}
          />
          {hasPrev ? (
            <Line
              type="monotone"
              dataKey="prev"
              name={prevLabel}
              stroke="var(--adm-seria-2)"
              strokeWidth={2}
              strokeDasharray="5 4"
              isAnimationActive={false}
              dot={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legenda wykresu dziennego (tekst, nie tylko kolor). */
export function DailyLegend({
  label,
  prevLabel,
  hasPrev,
}: {
  label: string;
  prevLabel: string;
  hasPrev: boolean;
}) {
  return (
    <ul className="adm-legenda">
      <li>
        <span className="adm-legenda__znak adm-legenda__znak--seria-1" aria-hidden="true" />
        {label}
      </li>
      {hasPrev ? (
        <li>
          <span className="adm-legenda__znak adm-legenda__znak--przerywany" aria-hidden="true" />
          {prevLabel}
        </li>
      ) : null}
    </ul>
  );
}
