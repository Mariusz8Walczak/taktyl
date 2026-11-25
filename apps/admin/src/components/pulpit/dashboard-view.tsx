"use client";
// B-600..B-619 (docs/15 par. 12, docs/25 par. 2): pulpit wg wzorca ukladu Bean Clock - kazdy widzet ma tytul, jedno zdanie
// "co to znaczy" i liczbe z kontekstem (zmiana do poprzedniego okresu, mini-wykres). Liczby wylacznie z API:
// /stats/sales (zakres z paska gornego), /stats/operations (stan na teraz), /audit (aktywnosc po ludzku).
// Rzedy: stan interesu (KPI), sprzedaz (przychod, lejek, mapa cieplna), USP (sety, konfigurator 3D, kolory, top produkty),
// operacje (co wymaga reakcji), aktywnosc. Kazdy blok laduje sie i myli niezaleznie.
import type { OperationsStats, SalesStats } from "@taktyl/contracts";
import { Alert, Button } from "@taktyl/ui";
import {
  Boxes,
  CircleDollarSign,
  ImageIcon,
  KeyRound,
  Package,
  Settings,
  ShoppingBag,
  type LucideIcon,
  FileText,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { humanize, type AuditKind } from "../../lib/audit-human";
import {
  CATEGORY_LABEL,
  DAY_COUNT,
  formatBp,
  formatCount,
  formatDateTime,
  formatDayLong,
  formatDayShort,
  formatInt,
  formatMinutes,
  formatPLN,
  ORDER_COUNT,
  PIECE_COUNT,
} from "../../lib/format";
import { useAudit, useColors, useOperations, useProducts, useSalesStats } from "../../lib/queries";
import { useRange } from "../../lib/range";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";
import { BarRow, Card, ChartData, Heatmap, Kpi, SectionHead } from "./blocks";
import { DailyChart, DailyLegend } from "./charts";

function BlockError({ text, onRetry, busy }: { text: string; onRetry: () => void; busy: boolean }) {
  return (
    <div className="adm-stos" role="alert">
      <Alert variant="blad">{text}</Alert>
      <div>
        <Button variant="secondary" loading={busy} onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      </div>
    </div>
  );
}

const STATUS_STEP: Record<string, string> = {
  pending_payment: "Złożone",
  paid: "Opłacone",
  processing: "W realizacji",
  shipped: "Wysłane",
  delivered: "Dostarczone",
};

// ---------------------------------------------------------------- rzad 1

function KpiRow({ s }: { s: SalesStats }) {
  const k = s.kpi;
  const daily = s.daily;
  return (
    <section className="adm-sekcja" aria-labelledby="sekcja-stan">
      <SectionHead
        id="sekcja-stan"
        title="Stan interesu"
        lead={`${formatDayShort(s.range.from)} do ${formatDayShort(s.range.to)}, ${formatCount(s.range.days, DAY_COUNT)}${
          s.range.previous
            ? `, porównanie z ${formatDayShort(s.range.previous.from)} do ${formatDayShort(s.range.previous.to)}`
            : ""
        }.`}
      />
      <div className="adm-siatka-12">
        <Kpi
          id="kpi-przychod"
          title="Przychód (opłacone)"
          value={formatPLN(k.revenue_gr.value)}
          stat={k.revenue_gr}
          spark={daily.map((d) => d.revenue_gr)}
          meaning="Suma opłaconych zamówień z dostawą, liczona według dnia płatności."
        />
        <Kpi
          id="kpi-zamowienia"
          title="Zamówienia"
          value={formatInt(k.orders.value)}
          stat={k.orders}
          spark={daily.map((d) => d.orders)}
          meaning={`Złożone w zakresie, także nieopłacone. Opłaconych: ${formatInt(k.paid_orders.value)}.`}
        />
        <Kpi
          id="kpi-aov"
          title="Średnia wartość koszyka"
          value={formatPLN(k.aov_gr.value)}
          stat={k.aov_gr}
          spark={daily.map((d) =>
            d.paid_orders > 0 ? Math.round(d.revenue_gr / d.paid_orders) : 0,
          )}
          meaning="Przychód podzielony przez liczbę opłaconych zamówień."
        />
        <Kpi
          id="kpi-sety"
          title="Udział setów"
          value={formatBp(k.set_share_bp.value)}
          stat={k.set_share_bp}
          spark={daily.map((d) =>
            d.items_revenue_gr > 0
              ? Math.round((d.set_revenue_gr * 10000) / d.items_revenue_gr)
              : 0,
          )}
          meaning="Jaka część wartości produktów pochodzi z setów z rabatem."
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- rzad 2

function SalesRow({ s }: { s: SalesStats }) {
  const days = s.daily.map((d) => ({
    date: d.date,
    value: d.revenue_gr,
    prev: d.prev_revenue_gr,
    prevDate: d.prev_date,
  }));
  const best = [...s.daily].sort((a, b) => b.revenue_gr - a.revenue_gr)[0];
  const f = s.funnel;
  const steps: [string, number][] = [
    [STATUS_STEP.pending_payment as string, f.created],
    [STATUS_STEP.paid as string, f.reached.paid],
    [STATUS_STEP.processing as string, f.reached.processing],
    [STATUS_STEP.shipped as string, f.reached.shipped],
    [STATUS_STEP.delivered as string, f.reached.delivered],
  ];
  const busiest = [...s.heatmap.cells].sort((a, b) => b.orders - a.orders)[0];
  return (
    <section className="adm-sekcja" aria-labelledby="sekcja-sprzedaz">
      <SectionHead
        id="sekcja-sprzedaz"
        title="Sprzedaż: kiedy i jak płyną zamówienia"
        lead="Przychód dzień po dniu, droga zamówienia od złożenia do doręczenia i godziny, w których klienci kupują."
      />
      <div className="adm-siatka-12">
        <Card
          id="karta-przychod"
          title="Przychód dzień po dniu"
          span={8}
          meaning={
            best && best.revenue_gr > 0
              ? `Najlepszy dzień: ${formatDayLong(best.date)}, ${formatPLN(best.revenue_gr)}.`
              : "W tym zakresie nie ma opłaconych zamówień."
          }
          aside={
            <DailyLegend
              label="Ten okres"
              prevLabel="Poprzedni okres"
              hasPrev={s.range.previous !== null}
            />
          }
        >
          <DailyChart days={days} money label="Przychód" prevLabel="Poprzedni okres" />
          <ChartData
            summary="Pokaż dane wykresu w tabeli"
            head={["Dzień", "Przychód", "Zamówienia", "Poprzedni okres"]}
            rows={s.daily.map((d) => [
              formatDayShort(d.date),
              formatPLN(d.revenue_gr),
              d.orders,
              d.prev_revenue_gr === null ? "brak" : formatPLN(d.prev_revenue_gr),
            ])}
          />
        </Card>
        <Card
          id="karta-lejek"
          title="Droga zamówienia"
          span={4}
          meaning={`Z ${formatCount(f.created, ORDER_COUNT)} złożonych w zakresie: anulowane ${f.cancelled}, czeka na płatność ${f.waiting_payment}, nieudana płatność co najmniej raz ${f.payment_failed_once}.`}
        >
          <ul className="adm-paski">
            {steps.map(([label, n]) => (
              <BarRow
                key={label}
                label={label}
                value={n}
                max={f.created}
                detail={`${formatInt(n)} (${formatBp(f.created > 0 ? Math.round((n * 10000) / f.created) : 0)})`}
              />
            ))}
          </ul>
          <h4 className="adm-kafel__podtytul">Mediana czasu przejścia</h4>
          <dl className="adm-dl adm-dl--kompakt">
            {f.transitions.map((t) => (
              <div key={`${t.from}-${t.to}`} className="adm-dl__wiersz">
                <dt>
                  {STATUS_STEP[t.from]} → {STATUS_STEP[t.to]}
                </dt>
                <dd className="adm-liczba">
                  {t.count > 0 ? formatMinutes(t.median_minutes) : "brak danych"}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card
          id="karta-mapa"
          title="Kiedy klienci składają zamówienia"
          span={12}
          meaning={
            busiest && busiest.orders > 0
              ? `Dzień tygodnia i godzina w czasie polskim. Najwięcej zamówień w zakresie: ${formatInt(busiest.orders)} (${["", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"][busiest.dow]}, ${busiest.hour}:00).`
              : "Dzień tygodnia i godzina w czasie polskim."
          }
        >
          <Heatmap
            cells={s.heatmap.cells}
            max={s.heatmap.max}
            caption="Liczba zamówień wg dnia tygodnia i godziny"
          />
          <p className="adm-skala" aria-hidden="true">
            <span>mniej</span>
            {[0, 25, 50, 75, 100].map((u) => (
              <span
                key={u}
                className="adm-skala__krok"
                style={{ ["--udzial" as string]: `${u}%` }}
              />
            ))}
            <span>więcej</span>
          </p>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- rzad 3

function UspRow({ s }: { s: SalesStats }) {
  const sets = s.sets;
  const cfg = s.configurator;
  const colorsMax = Math.max(1, ...s.colors.map((c) => c.units));
  const cfgColorsMax = Math.max(1, ...cfg.top_colors.map((c) => c.parts));
  const setOrderShare =
    sets.paid_orders > 0 ? Math.round((sets.orders_with_set * 10000) / sets.paid_orders) : 0;
  return (
    <section className="adm-sekcja" aria-labelledby="sekcja-usp">
      <SectionHead
        id="sekcja-usp"
        title="To odróżnia Taktyla: sety, konfigurator i kolory"
        lead="Czy klienci kupują komplety z rabatem, projektują własne kolory w 3D i które kolorystyki wygrywają."
      />
      <div className="adm-siatka-12">
        <Card
          id="karta-sety"
          title="Sety z rabatem"
          span={4}
          meaning={`${formatBp(setOrderShare)} opłaconych zamówień zawiera pełny set (${formatInt(sets.orders_with_set)} z ${formatInt(sets.paid_orders)}).`}
        >
          <dl className="adm-liczby-duze">
            <div>
              <dt>Przychód z setów</dt>
              <dd>{formatPLN(sets.set_revenue_gr)}</dd>
            </div>
            <div>
              <dt>Produkty pojedynczo</dt>
              <dd>{formatPLN(sets.single_revenue_gr)}</dd>
            </div>
            <div>
              <dt>Oddany rabat setu</dt>
              <dd>{formatPLN(sets.set_discount_gr)}</dd>
            </div>
            <div>
              <dt>Sprzedane sety</dt>
              <dd>{formatInt(sets.sets_sold)}</dd>
            </div>
          </dl>
          <ul className="adm-paski">
            <BarRow
              label="Sety"
              value={sets.set_revenue_gr}
              max={sets.set_revenue_gr + sets.single_revenue_gr}
              detail={formatBp(
                sets.set_revenue_gr + sets.single_revenue_gr > 0
                  ? Math.round(
                      (sets.set_revenue_gr * 10000) /
                        (sets.set_revenue_gr + sets.single_revenue_gr),
                    )
                  : 0,
              )}
            />
            <BarRow
              label="Pojedynczo"
              tone="seria-2"
              value={sets.single_revenue_gr}
              max={sets.set_revenue_gr + sets.single_revenue_gr}
              detail={formatBp(
                sets.set_revenue_gr + sets.single_revenue_gr > 0
                  ? Math.round(
                      (sets.single_revenue_gr * 10000) /
                        (sets.set_revenue_gr + sets.single_revenue_gr),
                    )
                  : 0,
              )}
            />
          </ul>
        </Card>
        <Card
          id="karta-konfigurator"
          title="Konfigurator 3D"
          span={4}
          meaning={
            cfg.items > 0
              ? `${formatCount(cfg.items, PIECE_COUNT)} we własnych kolorach w ${formatCount(cfg.orders, ORDER_COUNT)}; średnia dopłata za wykończenie ${formatPLN(cfg.surcharge_avg_gr)}.`
              : "W tym zakresie nikt nie zamówił konfiguracji własnej."
          }
        >
          <dl className="adm-liczby-duze">
            <div>
              <dt>Przychód z konfiguracji</dt>
              <dd>{formatPLN(cfg.revenue_gr)}</dd>
            </div>
            <div>
              <dt>Dopłaty razem</dt>
              <dd>{formatPLN(cfg.surcharge_total_gr)}</dd>
            </div>
          </dl>
          {cfg.top_colors.length > 0 ? (
            <>
              <h4 className="adm-kafel__podtytul">Najczęściej wybierane kolory części</h4>
              <ul className="adm-paski">
                {cfg.top_colors.slice(0, 5).map((c) => (
                  <BarRow
                    key={c.color}
                    label={c.label}
                    swatch={c.swatch}
                    value={c.parts}
                    max={cfgColorsMax}
                    detail={formatInt(c.parts)}
                    tone="seria-3"
                  />
                ))}
              </ul>
            </>
          ) : null}
          {cfg.by_model.length > 0 ? (
            <p className="adm-tekst-slaby adm-tekst-xs">
              Modele:{" "}
              {cfg.by_model
                .slice(0, 4)
                .map((m) => `${m.name} (${m.items})`)
                .join(", ")}
              {cfg.by_model.length > 4 ? ` i ${cfg.by_model.length - 4} innych` : ""}.
            </p>
          ) : null}
        </Card>
        <Card
          id="karta-kolory"
          title="Ranking kolorów"
          span={4}
          meaning="Sztuki wariantów seryjnych w opłaconych zamówieniach (bez konfiguracji własnych)."
        >
          {s.colors.length === 0 ? (
            <p>Brak danych do pokazania.</p>
          ) : (
            <ul className="adm-paski">
              {s.colors.slice(0, 6).map((c) => (
                <BarRow
                  key={c.color}
                  label={c.label}
                  swatch={c.swatch}
                  value={c.units}
                  max={colorsMax}
                  detail={`${formatCount(c.units, PIECE_COUNT)}, ${formatPLN(c.revenue_gr)}`}
                />
              ))}
            </ul>
          )}
        </Card>
        <Card
          id="karta-top"
          title="Najlepiej sprzedające się produkty"
          span={12}
          meaning="Według przychodu z pozycji po rabatach; zmiana do tego samego produktu w poprzednim okresie."
        >
          <div className="adm-tabela-okno">
            <table className="adm-tabela">
              <caption className="tk-sr-only">Najlepiej sprzedające się produkty</caption>
              <thead>
                <tr>
                  <th scope="col">Produkt</th>
                  <th scope="col">Kategoria</th>
                  <th scope="col" className="adm-liczba">
                    Sztuki
                  </th>
                  <th scope="col" className="adm-liczba">
                    Przychód
                  </th>
                  <th scope="col" className="adm-liczba">
                    Poprzedni okres
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.top_products.map((p) => (
                  <tr key={p.product_id} className="adm-wiersz-link">
                    <th scope="row">
                      <span className="adm-produkt">
                        {p.thumb_url ? (
                          <img
                            className="adm-produkt__miniatura"
                            src={p.thumb_url}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="adm-produkt__miniatura adm-produkt__miniatura--brak"
                            aria-hidden="true"
                          />
                        )}
                        <Link
                          className="tk-link"
                          href={`/produkty/${encodeURIComponent(p.product_id)}`}
                        >
                          {p.name}
                        </Link>
                      </span>
                    </th>
                    <td>{CATEGORY_LABEL[p.category]}</td>
                    <td className="adm-liczba">{formatInt(p.units)}</td>
                    <td className="adm-liczba">{formatPLN(p.revenue_gr)}</td>
                    <td className="adm-liczba">
                      {p.prev_revenue_gr === null ? "brak" : formatPLN(p.prev_revenue_gr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- rzad 4

function OpsRow({ o }: { o: OperationsStats }) {
  const p0 =
    o.images.p0_total > 0 ? Math.round((o.images.p0_ready * 10000) / o.images.p0_total) : 0;
  return (
    <section className="adm-sekcja" aria-labelledby="sekcja-operacje">
      <SectionHead
        id="sekcja-operacje"
        title="Co wymaga reakcji"
        lead={`Stan na ${formatDateTime(o.generated_at)}, niezależnie od zakresu dat.`}
      />
      <div className="adm-siatka-12">
        <Card
          id="karta-czekajace"
          title="Opłacone ponad 24 h bez realizacji"
          span={4}
          meaning={
            o.waiting_orders.count === 0
              ? "Wszystkie opłacone zamówienia są w realizacji."
              : `${formatCount(o.waiting_orders.count, ORDER_COUNT)} czeka na przekazanie do realizacji.`
          }
        >
          {o.waiting_orders.items.length > 0 ? (
            <ul className="adm-lista adm-lista--podzielona">
              {o.waiting_orders.items.slice(0, 6).map((w) => (
                <li key={w.number}>
                  <Link className="tk-link" href={`/zamowienia/${w.number}`}>
                    {w.number}
                  </Link>
                  <span className="adm-tekst-slaby">
                    {" "}
                    {formatPLN(w.total_gr)}, czeka {formatMinutes(w.hours * 60)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link className="tk-link" href="/zamowienia?status=paid">
            Wszystkie opłacone
          </Link>
        </Card>
        <Card
          id="karta-stany"
          title="Niski stan i prognoza"
          span={4}
          meaning={`Warianty ze stanem do 3 szt. albo z zapasem na mniej niż 14 dni przy sprzedaży z ostatnich 30 dni. Bez stanu: ${o.low_stock.out_of_stock}.`}
        >
          <ul className="adm-lista adm-lista--podzielona">
            {o.low_stock.items.slice(0, 7).map((v) => (
              <li key={v.sku}>
                <Link
                  className="tk-link"
                  href={`/produkty/${encodeURIComponent(v.product_id)}?zakladka=warianty`}
                >
                  {v.product_name}
                </Link>{" "}
                <span className="adm-tekst-slaby">{v.sku}</span>
                <br />
                <span className={v.stock === 0 ? "adm-stan adm-stan--blad" : "adm-stan"}>
                  {v.stock === 0 ? "brak" : `${v.stock} szt.`}
                </span>
                <span className="adm-tekst-slaby">
                  {v.days_left === null
                    ? ", bez sprzedaży w 30 dniach"
                    : v.stock === 0
                      ? `, sprzedano ${v.sold_30d} w 30 dni`
                      : `, skończy się za ok. ${formatCount(v.days_left, DAY_COUNT)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          id="karta-sprawy"
          title="Sprawy i kondycja"
          span={4}
          meaning="Zgłoszenia, kolejka odświeżania sklepu i zdjęcia produktów."
        >
          <dl className="adm-dl adm-dl--kompakt">
            <div className="adm-dl__wiersz">
              <dt>
                <Link className="tk-link" href="/zgloszenia">
                  Zgłoszenia bez odpowiedzi
                </Link>
              </dt>
              <dd className="adm-liczba">{o.messages_unhandled}</dd>
            </div>
            <div className="adm-dl__wiersz">
              <dt>Odświeżenia sklepu w kolejce</dt>
              <dd className="adm-liczba">{o.outbox.pending}</dd>
            </div>
            <div className="adm-dl__wiersz">
              <dt>Odświeżenia z błędem</dt>
              <dd className={o.outbox.failed > 0 ? "adm-liczba adm-stan--blad" : "adm-liczba"}>
                {o.outbox.failed}
              </dd>
            </div>
            <div className="adm-dl__wiersz">
              <dt>Ostatnie odświeżenie sklepu</dt>
              <dd>
                {o.outbox.last_revalidated_at
                  ? formatDateTime(o.outbox.last_revalidated_at)
                  : "jeszcze nie było"}
              </dd>
            </div>
          </dl>
          <h4 className="adm-kafel__podtytul">
            <Link className="tk-link" href="/media">
              Zdjęcia
            </Link>
          </h4>
          <ul className="adm-paski">
            <BarRow
              label="P0 (karty i listingi)"
              value={o.images.p0_ready}
              max={o.images.p0_total}
              detail={`${o.images.p0_ready} z ${o.images.p0_total} (${formatBp(p0)})`}
              tone="seria-3"
            />
            <BarRow
              label="Wszystkie"
              value={o.images.ready}
              max={o.images.total}
              detail={`${o.images.ready} z ${o.images.total}`}
              tone="seria-3"
            />
          </ul>
        </Card>
        <Card
          id="karta-omnibus"
          title="Promocje i najniższa cena z 30 dni"
          span={12}
          meaning="Warianty w promocji. Najniższą cenę z 30 dni przed obniżką liczy API z historii cen; w panelu nie ma pola do jej wpisania."
        >
          {o.omnibus.length === 0 ? (
            <p>Żaden wariant nie jest teraz w promocji.</p>
          ) : (
            <div className="adm-tabela-okno">
              <table className="adm-tabela">
                <caption className="tk-sr-only">Warianty w promocji</caption>
                <thead>
                  <tr>
                    <th scope="col">Wariant</th>
                    <th scope="col" className="adm-liczba">
                      Cena
                    </th>
                    <th scope="col" className="adm-liczba">
                      Cena regularna
                    </th>
                    <th scope="col" className="adm-liczba">
                      Najniższa z 30 dni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {o.omnibus.map((p) => (
                    <tr key={p.sku}>
                      <th scope="row">
                        <Link
                          className="tk-link"
                          href={`/produkty/${encodeURIComponent(p.product_id)}/ceny`}
                        >
                          {p.product_name}
                        </Link>{" "}
                        <span className="adm-tekst-slaby">{p.sku}</span>
                      </th>
                      <td className="adm-liczba">{formatPLN(p.price_gr)}</td>
                      <td className="adm-liczba">
                        {p.regular_price_gr === null ? "brak" : formatPLN(p.regular_price_gr)}
                      </td>
                      <td className="adm-liczba">{formatPLN(p.lowest_30d_gr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- rzad 5

const KIND_ICON: Record<AuditKind, LucideIcon> = {
  zdjecie: ImageIcon,
  cena: CircleDollarSign,
  stan: Boxes,
  produkt: Package,
  zamowienie: ShoppingBag,
  tresc: FileText,
  ustawienia: Settings,
  konto: KeyRound,
  system: Wrench,
};

const span = new Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" });
function seriesTime(first: string, last: string): string {
  const min = Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 60_000));
  return `w ${span.format(min, "minute").replace(/^za /, "")}`;
}

function Activity() {
  const audit = useAudit({ per_page: 100, page: 1 });
  const products = useProducts({ per_page: 100, page: 1 });
  const colors = useColors();
  const items = useMemo(() => {
    if (!audit.data) return [];
    return humanize(
      audit.data.items,
      {
        products: new Map((products.data?.items ?? []).map((p) => [p.id, p.name])),
        colors: new Map((colors.data?.items ?? []).map((c) => [c.id, c.label])),
      },
      10,
    );
  }, [audit.data, products.data, colors.data]);
  return (
    <section className="adm-sekcja" aria-labelledby="sekcja-aktywnosc">
      <SectionHead
        id="sekcja-aktywnosc"
        title="Kto co zmienił"
        lead="Ostatnie zmiany z dziennika, serie podobnych zmian zebrane w jeden wpis."
      />
      <div className="adm-siatka-12">
        <section className="adm-karta adm-kafel adm-kafel--12" aria-label="Ostatnie zmiany">
          {audit.isPending ? <Skeleton label="Wczytywanie dziennika" rows={4} /> : null}
          {audit.isError ? (
            <BlockError
              text="Nie udało się pobrać tego bloku."
              onRetry={() => void audit.refetch()}
              busy={audit.isFetching}
            />
          ) : null}
          {audit.data && items.length === 0 ? <p>Brak danych do pokazania.</p> : null}
          {items.length > 0 ? (
            <ol className="adm-aktywnosc">
              {items.map((e) => {
                const Icon = KIND_ICON[e.kind];
                // jeden element w odnosniku: tk-link jest flexem i gubi spacje miedzy dziecmi
                const body: ReactNode = (
                  <span>
                    <strong>{e.actor}</strong> {e.text}
                    {e.count > 1 ? (
                      <span className="adm-tekst-slaby"> ({seriesTime(e.firstAt, e.at)})</span>
                    ) : null}
                  </span>
                );
                return (
                  <li key={e.key} className="adm-aktywnosc__wpis">
                    <span
                      className={`adm-aktywnosc__ikona adm-aktywnosc__ikona--${e.kind}`}
                      aria-hidden="true"
                    >
                      <Icon className="adm-ikona" />
                    </span>
                    <span className="adm-aktywnosc__tekst">
                      {e.href ? (
                        <Link className="tk-link adm-aktywnosc__link" href={e.href}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </span>
                    <time className="adm-aktywnosc__czas" dateTime={e.at}>
                      {formatDateTime(e.at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <Link className="tk-link" href="/dziennik">
            Cały dziennik
          </Link>
        </section>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- strona

export function DashboardView() {
  const range = useRange();
  const sales = useSalesStats(range.query);
  const ops = useOperations();
  return (
    <div className="adm-strona adm-pulpit">
      <PageHeader title="Pulpit">
        {sales.data?.demo_data ? (
          <p className="adm-pulpit__demo">
            Zamówienia i ruch w tym zakresie pochodzą z generatora danych demonstracyjnych
            (prawdziwa wycena i statusy, fikcyjni klienci).
          </p>
        ) : null}
      </PageHeader>
      {sales.isPending ? <Skeleton label="Wczytywanie statystyk sprzedaży" rows={8} /> : null}
      {sales.isError ? (
        <BlockError
          text="Nie udało się pobrać statystyk sprzedaży."
          onRetry={() => void sales.refetch()}
          busy={sales.isFetching}
        />
      ) : null}
      {sales.data ? (
        <div className="adm-pulpit__sekcje" aria-busy={sales.isFetching}>
          <KpiRow s={sales.data} />
          <SalesRow s={sales.data} />
          <UspRow s={sales.data} />
        </div>
      ) : null}
      {ops.isPending ? <Skeleton label="Wczytywanie operacji" rows={4} /> : null}
      {ops.isError ? (
        <BlockError
          text="Nie udało się pobrać tego bloku."
          onRetry={() => void ops.refetch()}
          busy={ops.isFetching}
        />
      ) : null}
      {ops.data ? <OpsRow o={ops.data} /> : null}
      <Activity />
      <p className="adm-tekst-slaby adm-tekst-xs">
        Kwoty w złotych, czas polski.{" "}
        <Link className="tk-link" href="/ruch">
          Ruch w sklepie
        </Link>{" "}
        ·{" "}
        <Link className="tk-link" href="/system">
          Jak to jest zrobione
        </Link>
      </p>
    </div>
  );
}
