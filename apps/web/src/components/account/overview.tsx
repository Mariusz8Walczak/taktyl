"use client";
// F-201 (docs/05 §1 `/konto`; wzorzec: pulpit konta, docs/08 §6): skrot - ostatnie zamowienie, zapisane sety, ulubione.
// Dane z tej przegladarki (zamowienia z tokenem, sety, ulubione), status ostatniego zamowienia odswiezany z API.
import Link from "next/link";
import { PRODUCT_FORMS, formatCount } from "@taktyl/domain";
import { useHydrated, useSavedSets, useStoredOrders } from "../../lib/account/hooks";
import { useWishlistSkus } from "../../lib/wishlist/store";
import { EmptyOrders, OrderRow } from "./orders-list";
import { useOrdersRefresh } from "./use-orders-refresh";

const SET_FORMS = { one: "set", few: "sety", many: "setów" } as const;

export function AccountOverview({ timeZone }: { timeZone: string }) {
  const hydrated = useHydrated();
  const orders = useStoredOrders();
  const last = orders.slice(0, 1);
  const rows = useOrdersRefresh(last);
  const sets = useSavedSets();
  const favorites = useWishlistSkus();
  if (!hydrated) return null;
  const lastOrder = last[0];

  return (
    <div className="konto-przeglad">
      <section className="konto-blok" aria-labelledby="konto-ostatnie">
        <h2 id="konto-ostatnie" className="konto-blok__tytul">
          Ostatnie zamówienie
        </h2>
        {lastOrder ? (
          <>
            <ul className="lista konto-zamowienia">
              <OrderRow item={lastOrder} row={rows[lastOrder.number]} timeZone={timeZone} />
            </ul>
            <Link href="/konto/zamowienia" className="tk-link">
              Wszystkie zamówienia
            </Link>
          </>
        ) : (
          <EmptyOrders />
        )}
      </section>

      <section className="konto-blok" aria-labelledby="konto-sety">
        <h2 id="konto-sety" className="konto-blok__tytul">
          Zapisane sety
        </h2>
        {sets.length > 0 ? (
          <>
            <p>Masz {formatCount(sets.length, SET_FORMS)}.</p>
            <ul className="lista">
              {sets.slice(0, 3).map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Nie masz jeszcze zapisanych setów.</p>
        )}
        <Link href="/konto/sety" className="tk-link">
          Zapisane sety
        </Link>
      </section>

      <section className="konto-blok" aria-labelledby="konto-ulubione">
        <h2 id="konto-ulubione" className="konto-blok__tytul">
          Ulubione
        </h2>
        <p>
          {favorites.length > 0
            ? `Zapisane: ${formatCount(favorites.length, PRODUCT_FORMS)}.`
            : "Nie masz jeszcze ulubionych produktów."}
        </p>
        <Link href="/ulubione" className="tk-link">
          Ulubione
        </Link>
      </section>
    </div>
  );
}
