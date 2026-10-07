"use client";
// F-202 (docs/05 §1 `/konto/zamowienia`; wzorzec: lista zamowien konta, docs/08 §6): zamowienia z `taktyl.orders.v1`
// (numer, token, data) + status i suma odswiezane z API przez `order_token`. Kwoty z API w groszach -> Intl.
// Brak tokenu / 401 / 404: komunikat przy tym zamowieniu; brak zamowien: zaproszenie do sklepu.
import { formatPLN } from "@taktyl/domain";
import Link from "next/link";
import { useHydrated, useStoredOrders } from "../../lib/account/hooks";
import { ORDER_STATUS_LABEL, formatDateTime, type StoredOrderRef } from "../../lib/account/orders";
import type { OrderRowState } from "./use-orders-refresh";
import { useOrdersRefresh } from "./use-orders-refresh";

export const ORDER_MISSING_TEXT =
  "Nie możemy odczytać tego zamówienia w tej przeglądarce: brakuje ważnego tokenu albo zamówienia nie ma w systemie demo.";
export const ORDER_ERROR_TEXT = "Nie udało się odświeżyć statusu. Spróbuj ponownie za chwilę.";

export function OrderRow({
  item: orderRef,
  row,
  timeZone,
}: {
  item: StoredOrderRef;
  row: OrderRowState | undefined;
  timeZone: string;
}) {
  const state = row ?? { state: "loading" as const };
  const at = state.state === "ready" ? state.order.created_at : orderRef.at;
  return (
    <li className="konto-zamowienie">
      <div className="konto-zamowienie__glowa">
        <h3 className="konto-zamowienie__numer">
          <Link href={`/konto/zamowienia/${orderRef.number}`} className="tk-link">
            Zamówienie {orderRef.number}
          </Link>
        </h3>
        {at ? <p className="konto-zamowienie__data">{formatDateTime(at, timeZone)}</p> : null}
      </div>
      {state.state === "ready" ? (
        <dl className="konto-zamowienie__dane">
          <div>
            <dt>Status</dt>
            <dd>{ORDER_STATUS_LABEL[state.order.status]}</dd>
          </div>
          <div>
            <dt>Razem</dt>
            <dd>{formatPLN(state.order.total_gr)}</dd>
          </div>
        </dl>
      ) : state.state === "loading" ? (
        <p className="konto-zamowienie__info" role="status">
          Odświeżam status…
        </p>
      ) : (
        <p className="konto-zamowienie__info" role="alert">
          {state.state === "missing" ? ORDER_MISSING_TEXT : ORDER_ERROR_TEXT}
        </p>
      )}
    </li>
  );
}

export function EmptyOrders() {
  return (
    <div className="pusty-stan">
      <p className="pusty-stan__tekst">
        Nie ma jeszcze zamówień złożonych w tej przeglądarce. Gdy złożysz zamówienie, pojawi się tu
        razem ze statusem.
      </p>
      <div className="pusty-stan__akcje">
        <Link href="/klawiatury" className="tk-btn tk-btn--glowny">
          Zobacz klawiatury
        </Link>
        <Link href="/zbuduj-set" className="tk-btn tk-btn--poboczny">
          Zbuduj set
        </Link>
      </div>
    </div>
  );
}

export function OrdersList({ timeZone }: { timeZone: string }) {
  const hydrated = useHydrated();
  const refs = useStoredOrders();
  const rows = useOrdersRefresh(refs);
  if (!hydrated) return null;
  if (refs.length === 0) return <EmptyOrders />;
  return (
    <div>
      <p className="konto__stan">
        Zamówienia zapisane w tej przeglądarce. Status odświeżamy z systemu demo.
      </p>
      <ul className="lista konto-zamowienia">
        {refs.map((r) => (
          <OrderRow key={r.number} item={r} row={rows[r.number]} timeZone={timeZone} />
        ))}
      </ul>
    </div>
  );
}
