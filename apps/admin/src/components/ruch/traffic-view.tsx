"use client";
// B-620 (docs/25 par. 2, wzorzec #/traffic): ruch w sklepie z kolektora zdarzen docs/10 (ADR-0012). Sesje, lejek
// view_item -> add_to_cart -> begin_checkout -> purchase, konwersja, porzucone koszyki, kreator setu, wyszukiwania.
// Zdarzenia sa zbierane tylko przy zgodzie na analityke, wiec liczby dotycza sesji ze zgoda.
import type { TrafficStats } from "@taktyl/contracts";
import { Alert, Button } from "@taktyl/ui";
import {
  DAY_COUNT,
  formatBp,
  formatCount,
  formatDayLong,
  formatDayShort,
  formatInt,
  SESSION_COUNT,
} from "../../lib/format";
import { useTrafficStats } from "../../lib/queries";
import { useRange } from "../../lib/range";
import { BarRow, Card, ChartData, Kpi, SectionHead } from "../pulpit/blocks";
import { DailyChart, DailyLegend } from "../pulpit/charts";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";

const STEP_LABEL: Record<string, string> = {
  view_item: "Obejrzał produkt",
  add_to_cart: "Dodał do koszyka",
  begin_checkout: "Zaczął zamówienie",
  purchase: "Kupił",
};
const ENTRY_LABEL: Record<string, string> = {
  hero: "Strona główna",
  nav: "Menu",
  pdp: "Karta produktu",
  pdp_complete: "Dokończ set",
  preset: "Gotowe sety",
  share_link: "Link do setu",
  guide: "Poradnik",
  account: "Konto",
};

function View({ t }: { t: TrafficStats }) {
  const k = t.kpi;
  const top = t.funnel[0]?.sessions ?? 0;
  const days = t.daily.map((d, i) => ({
    date: d.date,
    value: d.sessions,
    prev: d.prev_sessions,
    prevDate: t.range.previous ? (t.daily[i] ? addPrev(t.range.previous.from, i) : null) : null,
  }));
  const best = [...t.daily].sort((a, b) => b.sessions - a.sessions)[0];
  const viewsMax = Math.max(1, ...t.top_items.map((i) => i.views));
  const searchMax = Math.max(1, ...t.searches.map((s) => s.count));
  const entryMax = Math.max(1, ...t.builder.entry_points.map((e) => e.count));
  return (
    <>
      <section className="adm-sekcja" aria-labelledby="ruch-kpi">
        <SectionHead
          id="ruch-kpi"
          title="Ile osób odwiedza sklep i ile z nich kupuje"
          lead={`${formatDayShort(t.range.from)} do ${formatDayShort(t.range.to)}, ${formatCount(t.range.days, DAY_COUNT)}. Liczone są tylko sesje ze zgodą na analitykę.`}
        />
        <div className="adm-siatka-12">
          <Kpi
            id="kpi-sesje"
            title="Sesje"
            value={formatInt(k.sessions.value)}
            stat={k.sessions}
            spark={t.daily.map((d) => d.sessions)}
            meaning="Anonimowe wizyty z co najmniej jednym zdarzeniem pomiaru."
          />
          <Kpi
            id="kpi-konwersja"
            title="Konwersja"
            value={formatBp(k.conversion_bp.value)}
            stat={k.conversion_bp}
            spark={t.daily.map((d) =>
              d.sessions > 0 ? Math.round((d.purchases * 10000) / d.sessions) : 0,
            )}
            meaning="Część sesji zakończonych zakupem (zdarzenie purchase)."
          />
          <Kpi
            id="kpi-zakupy"
            title="Zakupy"
            value={formatInt(k.purchases.value)}
            stat={k.purchases}
            spark={t.daily.map((d) => d.purchases)}
            meaning="Opłacone zamówienia zarejestrowane w pomiarze (jeden purchase na numer)."
          />
          <Kpi
            id="kpi-porzucone"
            title="Porzucone koszyki"
            value={formatInt(k.abandoned_carts.value)}
            stat={k.abandoned_carts}
            spark={[]}
            goodWhenUp={false}
            meaning="Sesje z dodaniem do koszyka, które nie skończyły się zakupem."
          />
        </div>
      </section>

      <section className="adm-sekcja" aria-labelledby="ruch-dzien">
        <SectionHead
          id="ruch-dzien"
          title="Ruch i lejek"
          lead="Sesje dzień po dniu i miejsca, w których klienci odpadają."
        />
        <div className="adm-siatka-12">
          <Card
            id="karta-sesje"
            title="Sesje dzień po dniu"
            span={8}
            meaning={
              best && best.sessions > 0
                ? `Najwięcej sesji: ${formatDayLong(best.date)}, ${formatInt(best.sessions)}.`
                : "Brak sesji w tym zakresie."
            }
            aside={
              <DailyLegend
                label="Ten okres"
                prevLabel="Poprzedni okres"
                hasPrev={t.range.previous !== null}
              />
            }
          >
            <DailyChart days={days} money={false} label="Sesje" prevLabel="Poprzedni okres" />
            <ChartData
              summary="Pokaż dane wykresu w tabeli"
              head={["Dzień", "Sesje", "Zakupy", "Poprzedni okres"]}
              rows={t.daily.map((d) => [
                formatDayShort(d.date),
                d.sessions,
                d.purchases,
                d.prev_sessions ?? "brak",
              ])}
            />
          </Card>
          <Card
            id="karta-lejek-ruch"
            title="Lejek zakupowy"
            span={4}
            meaning={`Z ${formatCount(top, SESSION_COUNT)} oglądających produkt kupiło ${formatBp(top > 0 ? Math.round(((t.funnel[3]?.sessions ?? 0) * 10000) / top) : 0)}.`}
          >
            <ul className="adm-paski">
              {t.funnel.map((f, i) => {
                const prev = i > 0 ? (t.funnel[i - 1]?.sessions ?? 0) : null;
                return (
                  <BarRow
                    key={f.step}
                    label={STEP_LABEL[f.step] ?? f.step}
                    value={f.sessions}
                    max={top}
                    detail={
                      prev === null
                        ? formatInt(f.sessions)
                        : `${formatInt(f.sessions)} (${formatBp(prev > 0 ? Math.round((f.sessions * 10000) / prev) : 0)} z poprzedniego kroku)`
                    }
                  />
                );
              })}
            </ul>
            <p className="adm-tekst-slaby adm-tekst-xs">
              Zdarzenia w zakresie: {formatInt(k.events.value)}. Sesja może dodać set z kreatora bez
              oglądania karty produktu.
            </p>
          </Card>
        </div>
      </section>

      <section className="adm-sekcja" aria-labelledby="ruch-co">
        <SectionHead
          id="ruch-co"
          title="Czego szukają i co oglądają"
          lead="Kreator setu, najczęściej oglądane produkty i wpisywane frazy."
        />
        <div className="adm-siatka-12">
          <Card
            id="karta-kreator"
            title="Kreator setu"
            span={4}
            meaning={`Rozpoczęcia: ${formatInt(t.builder.starts)}, komplet trzech produktów: ${formatInt(t.builder.completes)}, set w koszyku: ${formatInt(t.builder.add_to_cart)}.`}
          >
            <h4 className="adm-kafel__podtytul">Skąd klienci wchodzą do kreatora</h4>
            <ul className="adm-paski">
              {t.builder.entry_points.map((e) => (
                <BarRow
                  key={e.entry_point}
                  label={ENTRY_LABEL[e.entry_point] ?? e.entry_point}
                  value={e.count}
                  max={entryMax}
                  detail={formatInt(e.count)}
                  tone="seria-3"
                />
              ))}
            </ul>
          </Card>
          <Card
            id="karta-ogladane"
            title="Najczęściej oglądane"
            span={4}
            meaning="Zdarzenia view_item i dodania do koszyka tego samego SKU."
          >
            <ul className="adm-paski">
              {t.top_items.slice(0, 8).map((i) => (
                <BarRow
                  key={i.item_id}
                  label={
                    <>
                      {i.item_name} <span className="adm-tekst-slaby">{i.item_id}</span>
                    </>
                  }
                  value={i.views}
                  max={viewsMax}
                  detail={`${formatInt(i.views)}, w koszyku ${formatInt(i.add_to_cart)}`}
                />
              ))}
            </ul>
          </Card>
          <Card
            id="karta-szukane"
            title="Wyszukiwane frazy"
            span={4}
            meaning="Zdarzenie search: wysłane wyszukiwanie albo wybrana podpowiedź."
          >
            {t.searches.length === 0 ? (
              <p>Brak wyszukiwań w tym zakresie.</p>
            ) : (
              <ul className="adm-paski">
                {t.searches.map((s) => (
                  <BarRow
                    key={s.term}
                    label={s.term}
                    value={s.count}
                    max={searchMax}
                    detail={formatInt(s.count)}
                    tone="seria-2"
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

function addPrev(from: string, i: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
}

export function TrafficView() {
  const range = useRange();
  const q = useTrafficStats(range.query);
  return (
    <div className="adm-strona adm-pulpit">
      <PageHeader title="Ruch">
        {q.data?.demo_data ? (
          <p className="adm-pulpit__demo">
            Ruch w tym zakresie pochodzi z generatora danych demonstracyjnych (zdarzenia z docs/10,
            anonimowe sesje).
          </p>
        ) : null}
      </PageHeader>
      {q.isPending ? <Skeleton label="Wczytywanie ruchu" rows={8} /> : null}
      {q.isError ? (
        <div className="adm-stos" role="alert">
          <Alert variant="blad">Nie udało się pobrać statystyk ruchu.</Alert>
          <div>
            <Button variant="secondary" loading={q.isFetching} onClick={() => void q.refetch()}>
              Spróbuj ponownie
            </Button>
          </div>
        </div>
      ) : null}
      {q.data ? (
        <div className="adm-pulpit__sekcje" aria-busy={q.isFetching}>
          <View t={q.data} />
        </div>
      ) : null}
    </div>
  );
}
