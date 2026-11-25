"use client";
// B-610..B-620 (docs/25 par. 2): klocki pulpitu - karta z tytulem i zdaniem "co to znaczy", kafel KPI ze zmiana do
// poprzedniego okresu i mini-wykresem, pasek udzialu, mapa cieplna jako tabela, dane wykresu w tabeli (dostepnosc).
// Kolor nie jest jedynym nosnikiem: zmiana ma znak i tekst, slupki maja liczby.
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatDelta, weekdayShort } from "../../lib/format";
import { deltaPercent } from "../../lib/range";
import { Sparkline } from "./charts";

export function Card({
  id,
  title,
  meaning,
  span = 4,
  children,
  aside,
}: {
  id: string;
  title: string;
  /** Jedno zdanie: co ta liczba znaczy dla sklepu. */
  meaning?: ReactNode;
  /** Szerokosc w siatce 12 kolumn (komputer). */
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className={`adm-karta adm-kafel adm-kafel--${span}`} aria-labelledby={id}>
      <div className="adm-kafel__naglowek">
        <h3 id={id}>{title}</h3>
        {aside}
      </div>
      {meaning ? <p className="adm-kafel__znaczenie">{meaning}</p> : null}
      {children}
    </section>
  );
}

/** Zmiana do poprzedniego okresu. `goodWhenUp=false` dla wskaznikow, gdzie wzrost jest zly (np. porzucone koszyki). */
export function Delta({
  value,
  previous,
  goodWhenUp = true,
}: {
  value: number;
  previous: number | null;
  goodWhenUp?: boolean;
}) {
  const pct = deltaPercent(value, previous);
  if (previous === null) return null;
  if (pct === null)
    return <span className="adm-zmiana adm-zmiana--neutralna">nowe w tym okresie</span>;
  const dir = pct > 0 ? "wzrost" : pct < 0 ? "spadek" : "bez zmian";
  const good = pct === 0 ? null : pct > 0 === goodWhenUp;
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={`adm-zmiana ${good === null ? "adm-zmiana--neutralna" : good ? "adm-zmiana--dobra" : "adm-zmiana--zla"}`}
    >
      <Icon aria-hidden="true" className="adm-ikona" />
      <span>
        {formatDelta(pct)}
        <span className="tk-sr-only"> ({dir})</span> do poprzedniego okresu
      </span>
    </span>
  );
}

export function Kpi({
  id,
  title,
  value,
  stat,
  spark,
  meaning,
  goodWhenUp = true,
}: {
  id: string;
  title: string;
  value: string;
  stat: { value: number; previous: number | null };
  spark: number[];
  meaning: ReactNode;
  goodWhenUp?: boolean;
}) {
  return (
    <section className="adm-karta adm-kafel adm-kafel--3 adm-kpi" aria-labelledby={id}>
      <h3 id={id} className="adm-kpi__tytul">
        {title}
      </h3>
      <p className="adm-kpi__wartosc">{value}</p>
      <Delta value={stat.value} previous={stat.previous} goodWhenUp={goodWhenUp} />
      {spark.length > 1 ? <Sparkline values={spark} /> : null}
      <p className="adm-kafel__znaczenie">{meaning}</p>
    </section>
  );
}

/** Wiersz z paskiem udzialu (lejek, kolory, rankingi). Szerokosc paska to dana (procent), nie styl. */
export function BarRow({
  label,
  value,
  max,
  detail,
  swatch,
  tone = "seria-1",
}: {
  label: ReactNode;
  value: number;
  max: number;
  detail: ReactNode;
  swatch?: string;
  tone?: "seria-1" | "seria-2" | "seria-3" | "seria-4";
}) {
  const pct = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  return (
    <li className="adm-pasek">
      <span className="adm-pasek__etykieta">
        {swatch ? (
          // regula 2, wyjatek: kolor probki z data/colors.json -> swatch (dane, nie styl)
          <span className="adm-probka" style={{ backgroundColor: swatch }} aria-hidden="true" />
        ) : null}
        {label}
      </span>
      <span className="adm-pasek__wartosc">{detail}</span>
      <span className="adm-pasek__tor" aria-hidden="true">
        <span
          className={`adm-pasek__wypelnienie adm-pasek__wypelnienie--${tone}`}
          style={{ inlineSize: `${pct}%` }}
        />
      </span>
    </li>
  );
}

/** Mapa cieplna dzien tygodnia x godzina jako tabela (naglowki wierszy i kolumn, liczba w kazdej komorce). */
export function Heatmap({
  cells,
  max,
  caption,
}: {
  cells: { dow: number; hour: number; orders: number }[];
  max: number;
  caption: string;
}) {
  const at = new Map(cells.map((c) => [`${c.dow}:${c.hour}`, c.orders]));
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <div className="adm-tabela-okno adm-mapa-okno">
      <table className="adm-mapa">
        <caption className="tk-sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {hours.map((h) => (
              <th key={h} scope="col">
                {h % 3 === 0 ? h : <span className="tk-sr-only">{h}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
            <tr key={dow}>
              <th scope="row">{weekdayShort(dow)}</th>
              {hours.map((h) => {
                const n = at.get(`${dow}:${h}`) ?? 0;
                const share = max > 0 ? Math.round((n / max) * 100) : 0;
                return (
                  <td
                    key={h}
                    className="adm-mapa__komorka"
                    style={{ ["--udzial" as string]: `${share}%` }}
                    title={`${weekdayShort(dow)}, ${h}:00: ${n}`}
                  >
                    <span className="tk-sr-only">{n}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dane wykresu w tabeli pod przyciskiem (klawiatura, czytnik ekranu). */
export function ChartData({
  summary,
  head,
  rows,
}: {
  summary: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="adm-dane-wykresu">
      <summary>{summary}</summary>
      <div className="adm-tabela-okno">
        <table className="adm-tabela adm-tabela--kompakt">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={i > 0 ? "adm-liczba" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((c, i) =>
                  i === 0 ? (
                    <th key={i} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={i} className="adm-liczba">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Narracyjny naglowek sekcji pulpitu (H2 + jedno zdanie). */
export function SectionHead({ id, title, lead }: { id: string; title: string; lead: ReactNode }) {
  return (
    <div className="adm-sekcja__naglowek">
      <h2 id={id}>{title}</h2>
      <p>{lead}</p>
    </div>
  );
}
