"use client";
// B-600..B-607 (docs/15 par. 12): pulpit "/" - wylacznie liczby i listy z danych (zero wykresow i grafik). Bloki: Zamowienia
// (dzis, 7 dni, wszystkie, wg statusu, przychod demo), Niski stan (warianty 0-3 z odnosnikiem do produktu), Wymagaja reakcji
// (oplacone > 24 h), Ostatnie zmiany (10 wpisow z dziennika), Zdjecia (P0), Polaczenie ze sklepem (outbox), Skroty.
// Wszystkie liczby z jednego GET /v1/admin/dashboard (role: kazda).
import type { Dashboard } from "@taktyl/contracts";
import { orderStatusSchema } from "@taktyl/contracts";
import { Alert, Button } from "@taktyl/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatCount,
  formatDateTime,
  formatPLN,
  ORDER_COUNT,
  ORDER_STATUS_LABEL,
} from "../../lib/format";
import { ACTION_LABEL } from "../../lib/audit-labels";
import { useDashboard } from "../../lib/queries";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="adm-karta adm-stos" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Orders({ d }: { d: Dashboard }) {
  const o = d.orders;
  const present = orderStatusSchema.options.filter((s) => (o.by_status[s] ?? 0) > 0);
  return (
    <Block id="blok-zamowienia" title="Zamówienia">
      {o.total === 0 ? (
        <p>Nie ma jeszcze zamówień.</p>
      ) : (
        <>
          <dl className="adm-liczby">
            <div>
              <dt>Dziś</dt>
              <dd>{o.today}</dd>
            </div>
            <div>
              <dt>Ostatnie 7 dni</dt>
              <dd>{o.last_7_days}</dd>
            </div>
            <div>
              <dt>Ostatnie 30 dni</dt>
              <dd>{o.last_30_days}</dd>
            </div>
            <div>
              <dt>Wszystkie</dt>
              <dd>{o.total}</dd>
            </div>
          </dl>
          <h3>Według statusu</h3>
          <ul className="adm-lista">
            {present.map((s) => (
              <li key={s}>
                <Link className="tk-link" href={`/zamowienia?status=${s}`}>
                  {ORDER_STATUS_LABEL[s]}
                </Link>
                : {formatCount(o.by_status[s] ?? 0, ORDER_COUNT)}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Przychód demonstracyjny (opłacone)</h3>
      <dl className="adm-dl">
        <dt>Ostatnie 7 dni</dt>
        <dd>{formatPLN(d.revenue.paid_7_days_gr)}</dd>
        <dt>Ostatnie 30 dni</dt>
        <dd>{formatPLN(d.revenue.paid_30_days_gr)}</dd>
      </dl>
      <p className="adm-powod">
        Kwoty zamówień w statusie opłacone i dalej. Sklep jest demonstracyjny.
      </p>
    </Block>
  );
}

function LowStock({ d }: { d: Dashboard }) {
  const l = d.low_stock;
  return (
    <Block id="blok-stany" title="Niski stan">
      {l.items.length === 0 ? (
        <p>Brak danych do pokazania.</p>
      ) : (
        <>
          <p className="adm-powod">
            Wariantów ze stanem do 3 szt.: {l.count}, w tym bez stanu: {l.out_of_stock_count}.
          </p>
          <ul className="adm-lista">
            {l.items.map((i) => (
              <li key={i.sku}>
                <Link className="tk-link" href={`/produkty/${i.product_id}?zakladka=warianty`}>
                  {i.product_name}, {i.sku}
                </Link>
                : {i.stock === 0 ? "brak (0 szt.)" : `${i.stock} szt.`}
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  );
}

function ToHandle({ d }: { d: Dashboard }) {
  return (
    <Block id="blok-reakcja" title="Zamówienia wymagające reakcji">
      {d.orders_to_handle.length === 0 ? (
        <p>Brak danych do pokazania.</p>
      ) : (
        <>
          <p className="adm-powod">Opłacone ponad 24 godziny temu i nadal bez realizacji.</p>
          <ul className="adm-lista">
            {d.orders_to_handle.map((o) => (
              <li key={o.number}>
                <Link className="tk-link" href={`/zamowienia/${o.number}`}>
                  {o.number}
                </Link>
                : opłacone {formatDateTime(o.paid_at)}, {formatPLN(o.total_gr)}
              </li>
            ))}
          </ul>
        </>
      )}
    </Block>
  );
}

function Recent({ d }: { d: Dashboard }) {
  return (
    <Block id="blok-zmiany" title="Ostatnie zmiany">
      {d.recent_changes.length === 0 ? (
        <p>Brak danych do pokazania.</p>
      ) : (
        <ul className="adm-lista">
          {d.recent_changes.map((c) => (
            <li key={c.id}>
              {formatDateTime(c.at)}: {c.actor_label}, {ACTION_LABEL[c.action] ?? c.action} (
              {c.entity} {c.entity_id})
            </li>
          ))}
        </ul>
      )}
      <Link className="tk-link" href="/dziennik">
        Cały dziennik
      </Link>
    </Block>
  );
}

function Images({ d }: { d: Dashboard }) {
  return (
    <Block id="blok-zdjecia" title="Zdjęcia">
      <p>
        Gotowe {d.images_p0.ready} z {d.images_p0.total} (P0)
      </p>
      <Link className="tk-link" href="/media">
        Otwórz zdjęcia
      </Link>
    </Block>
  );
}

function Connection({ d }: { d: Dashboard }) {
  const c = d.connection;
  return (
    <Block id="blok-polaczenie" title="Połączenie ze sklepem">
      <dl className="adm-dl">
        <dt>Ostatnia udana rewalidacja</dt>
        <dd>
          {c.last_revalidated_at ? formatDateTime(c.last_revalidated_at) : "jeszcze nie było"}
        </dd>
        <dt>Zdarzenia w kolejce</dt>
        <dd>{c.outbox_pending}</dd>
        <dt>Zdarzenia z błędem</dt>
        <dd>{c.outbox_failed}</dd>
      </dl>
      {c.outbox_pending > 0 || c.outbox_failed > 0 ? (
        <Alert variant="uwaga">
          Część zmian czeka na odświeżenie sklepu. API ponawia wysyłkę samo.
        </Alert>
      ) : null}
    </Block>
  );
}

export function DashboardView() {
  const query = useDashboard();
  return (
    <div className="adm-strona">
      <PageHeader title="Pulpit" />
      {query.isPending ? <Skeleton label="Wczytywanie pulpitu" rows={6} /> : null}
      {query.isError ? (
        <div className="adm-stos" role="alert">
          <Alert variant="blad">Nie udało się pobrać pulpitu.</Alert>
          <div>
            <Button
              variant="secondary"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Spróbuj ponownie
            </Button>
          </div>
        </div>
      ) : null}
      {query.data ? (
        <div className="adm-dwie-kolumny adm-dwie-kolumny--rowne">
          <Orders d={query.data} />
          <LowStock d={query.data} />
          <ToHandle d={query.data} />
          <Recent d={query.data} />
          <Images d={query.data} />
          <Connection d={query.data} />
        </div>
      ) : null}
      <section className="adm-karta" aria-labelledby="skroty">
        <h2 id="skroty">Najczęstsze zadania</h2>
        <ul className="adm-lista">
          <li>
            <Link className="tk-link" href="/produkty">
              Produkty: ceny, stany i plakietki
            </Link>
          </li>
          <li>
            <Link className="tk-link" href="/zamowienia">
              Zamówienia: statusy i notatki
            </Link>
          </li>
          <li>
            <Link className="tk-link" href="/ustawienia">
              Ustawienia sklepu
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
