"use client";
// F-177, F-178, F-179, F-180, F-242 (docs/05 §7; wzorzec: `payment-confirmation.html`, `payment-failure.html`, docs/08 §6):
// symulacja platnosci, potwierdzenie i blad platnosci. Koszyk jest czyszczony DOPIERO po udanej platnosci (potwierdzenie,
// pierwsze wyswietlenie tego numeru); `purchase` raz na `transaction_id` (trackPurchaseOnce); zero pol kart i kodow BLIK.
import type { OrderDetail } from "@taktyl/contracts";
import { formatCivilDate, formatPLN } from "@taktyl/domain";
import { Alert, Button } from "@taktyl/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../../styles/cart.css";
import "../../styles/checkout.css";
import { parseIsoDate } from "../../lib/catalog/dispatch";
import { formatDiscount } from "../../lib/cart/messages";
import { simulatePayment } from "../../lib/cart/order-client";
import {
  orderValueGr,
  paymentFailedParams,
  purchaseParams,
  orderTrackItems,
} from "../../lib/cart/order-tracking";
import { cartStore } from "../../lib/cart/store";
import { trackPaymentInfo } from "../../lib/cart/tracking";
import { track, trackPurchaseOnce } from "../../lib/track";
import type { PaymentType } from "../../lib/track-events";
import { useOrder } from "./use-order";

export interface OrderPageSettings {
  paymentLabels: Record<string, string>;
  shippingLabels: Record<string, string>;
  shippingAddresses: Record<string, string | null>;
  timeZone: string;
  demoLabel: string;
}

const PAID_STATES = ["paid", "processing", "shipped", "delivered"];

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="kontener strona zam-status">
      <h1 className="naglowek-strony">{title}</h1>
      {children}
    </div>
  );
}

function Missing() {
  return (
    <Shell title="Nie znaleziono zamówienia">
      <p className="zam-status__tekst">
        Tego zamówienia nie ma w tej przeglądarce. Numer i klucz dostępu zapisujemy tylko tam, gdzie
        zamówienie złożono.
      </p>
      <div className="zam-status__akcje">
        <a href="/koszyk" className="tk-btn tk-btn--glowny">
          Wróć do koszyka
        </a>
      </div>
    </Shell>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell title="Zamówienie">
      <Alert variant="uwaga">
        Nie udało się pobrać zamówienia.{" "}
        <button type="button" className="tk-link tk-link--przycisk" onClick={onRetry}>
          Spróbuj ponownie
        </button>
      </Alert>
    </Shell>
  );
}

const Loading = ({ title }: { title: string }) => (
  <Shell title={title}>
    <p className="zam-status__tekst" role="status">
      Wczytujemy zamówienie…
    </p>
  </Shell>
);

/** F-177: symulacja platnosci. Dwa przyciski, zadnych pol na dane karty ani kod BLIK. */
export function PaymentPage({
  number,
  settings,
}: {
  number: string | null;
  settings: OrderPageSettings;
}) {
  const router = useRouter();
  const { load, token, reload } = useOrder(number);
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const order = load.state === "ready" ? load.order : null;
  useEffect(() => {
    if (!order) return;
    if (PAID_STATES.includes(order.status))
      router.replace(`/zamowienie/potwierdzenie?id=${order.number}`);
  }, [order, router]);

  if (load.state === "loading") return <Loading title="Płatność" />;
  if (load.state === "missing") return <Missing />;
  if (load.state === "error" || !order || !token) return <LoadError onRetry={reload} />;
  if (order.status === "cancelled") {
    return (
      <Shell title="Zamówienie anulowane">
        <p className="zam-status__tekst">
          To zamówienie zostało anulowane. Możesz złożyć nowe z zawartości koszyka.
        </p>
        <a href="/koszyk" className="tk-btn tk-btn--glowny">
          Wróć do koszyka
        </a>
      </Shell>
    );
  }

  const run = async (outcome: "paid" | "failed") => {
    if (busy) return;
    setBusy(outcome);
    setProblem(null);
    const res = await simulatePayment(order.number, token, outcome);
    if (!res.ok) {
      setBusy(null);
      setProblem(
        res.kind === "out_of_stock"
          ? "Stan magazynowy zmienił się w trakcie. Wróć do koszyka i wybierz inny wariant."
          : res.kind === "network"
            ? "Brak połączenia. Spróbuj ponownie, zamówienie jest zachowane."
            : "Nie udało się zasymulować płatności. Spróbuj ponownie.",
      );
      return;
    }
    if (res.data.status === "paid") {
      router.push(`/zamowienie/potwierdzenie?id=${order.number}`);
    } else {
      track("payment_failed", paymentFailedParams(order));
      router.push(`/zamowienie/blad-platnosci?id=${order.number}`);
    }
  };

  return (
    <Shell title="Płatność">
      <div className="zam-status__karta">
        <p className="zam-status__numer">
          Zamówienie <strong data-testid="numer-zamowienia">{order.number}</strong>
        </p>
        <dl className="koszyk-sumy">
          <div>
            <dt>Metoda płatności</dt>
            <dd>{settings.paymentLabels[order.payment.type] ?? order.payment.type}</dd>
          </div>
          <div className="koszyk-sumy__razem">
            <dt>Do zapłaty</dt>
            <dd data-testid="platnosc-kwota">{formatPLN(order.total_gr)}</dd>
          </div>
        </dl>
        <Alert variant="info">
          {settings.demoLabel} To jest symulacja płatności: nie wpisujesz tu danych karty ani kodu
          BLIK. Wybierz wynik, który chcesz zobaczyć.
        </Alert>
        {problem ? <Alert variant="blad">{problem}</Alert> : null}
        <div className="zam-status__akcje">
          <Button
            loading={busy === "paid"}
            disabled={busy !== null}
            onClick={() => void run("paid")}
          >
            Symuluj udaną płatność
          </Button>
          <Button
            variant="secondary"
            loading={busy === "failed"}
            disabled={busy !== null}
            onClick={() => void run("failed")}
          >
            Symuluj odrzuconą płatność
          </Button>
        </div>
      </div>
    </Shell>
  );
}

/** F-179: blad platnosci. Koszyk NIE jest czyszczony; "Spróbuj ponownie" wraca na platnosc tego samego zamowienia. */
export function FailurePage({
  number,
  settings,
}: {
  number: string | null;
  settings: OrderPageSettings;
}) {
  const router = useRouter();
  const { load, reload } = useOrder(number);
  const order = load.state === "ready" ? load.order : null;

  useEffect(() => {
    if (!order) return;
    if (PAID_STATES.includes(order.status))
      router.replace(`/zamowienie/potwierdzenie?id=${order.number}`);
  }, [order, router]);

  if (load.state === "loading") return <Loading title="Płatność" />;
  if (load.state === "missing") return <Missing />;
  if (load.state === "error" || !order) return <LoadError onRetry={reload} />;

  const retry = () => {
    // docs/10 §4: add_payment_info takze przy ponownej probie po bledzie
    trackPaymentInfo(
      orderTrackItems(order),
      orderValueGr(order),
      order.payment.type as PaymentType,
      order.coupon_code ?? undefined,
    );
    router.push(`/zamowienie/platnosc?id=${order.number}`);
  };

  return (
    <Shell title="Płatność nie powiodła się">
      <div className="zam-status__karta">
        <p className="zam-status__tekst">
          Symulowana płatność ({settings.paymentLabels[order.payment.type] ?? order.payment.type})
          została odrzucona. Nic nie pobraliśmy, a Twój koszyk jest nietknięty. Zamówienie{" "}
          <strong>{order.number}</strong> czeka na płatność.
        </p>
        <div className="zam-status__akcje">
          <Button onClick={retry}>Spróbuj ponownie</Button>
          <a href="/zamowienie" className="tk-btn tk-btn--poboczny">
            Zmień metodę płatności
          </a>
        </div>
        <p className="zam-status__uwaga">
          „Zmień metodę płatności” wraca do formularza zamówienia z zawartością koszyka, bo metoda
          jest zapisana przy zamówieniu.
        </p>
      </div>
    </Shell>
  );
}

function lineTotalGr(i: OrderDetail["items"][number]): number {
  return i.unit_price_gr * i.qty - i.set_discount_gr - i.coupon_discount_gr;
}

/** F-178, F-180: potwierdzenie. `purchase` raz; koszyk czyszczony przy pierwszym wyswietleniu oplaconego numeru. */
export function ConfirmationPage({
  number,
  settings,
}: {
  number: string | null;
  settings: OrderPageSettings;
}) {
  const router = useRouter();
  const { load, reload } = useOrder(number);
  const order = load.state === "ready" ? load.order : null;
  const paid = order ? PAID_STATES.includes(order.status) : false;

  useEffect(() => {
    if (!order) return;
    if (paid) {
      // pierwszy raz dla tego numeru: purchase i czyszczenie koszyka; odswiezenie nie liczy drugi raz (S20)
      if (trackPurchaseOnce(purchaseParams(order))) cartStore.clear();
    } else if (order.status === "payment_failed") {
      router.replace(`/zamowienie/blad-platnosci?id=${order.number}`);
    } else if (order.status === "pending_payment") {
      router.replace(`/zamowienie/platnosc?id=${order.number}`);
    }
  }, [order, paid, router]);

  if (load.state === "loading") return <Loading title="Potwierdzenie zamówienia" />;
  if (load.state === "missing") return <Missing />;
  if (load.state === "error" || !order) return <LoadError onRetry={reload} />;
  if (!paid) {
    return order.status === "cancelled" ? (
      <Shell title="Zamówienie anulowane">
        <p className="zam-status__tekst">To zamówienie zostało anulowane.</p>
      </Shell>
    ) : (
      <Loading title="Potwierdzenie zamówienia" />
    );
  }

  const tz = settings.timeZone;
  const address = settings.shippingAddresses[order.shipping_method];
  return (
    <Shell title="Dziękujemy za zamówienie">
      <div className="zam-status__karta">
        <p className="zam-status__numer">
          Numer zamówienia: <strong data-testid="numer-zamowienia">{order.number}</strong>
        </p>
        <Alert variant="sukces">
          Płatność została zasymulowana, a zamówienie przyjęte. {settings.demoLabel} Nie wysyłamy
          e-maili, więc to potwierdzenie zostaje tylko na tej stronie.
        </Alert>

        <h2 className="zam-status__podtytul">Pozycje</h2>
        <ul className="lista zam-status__pozycje">
          {order.items.map((i, idx) => (
            <li key={`${i.sku}-${idx}`}>
              <span>
                <strong>{i.name}</strong>
                {i.variant_label ? ` · ${i.variant_label}` : ""} × {i.qty}
                {i.group_id ? " · w secie" : ""}
              </span>
              <span>{formatPLN(lineTotalGr(i))}</span>
            </li>
          ))}
        </ul>
        <dl className="koszyk-sumy">
          <div>
            <dt>Wartość produktów</dt>
            <dd>{formatPLN(order.items_gr)}</dd>
          </div>
          {order.set_discount_gr > 0 ? (
            <div>
              <dt>Rabat za set</dt>
              <dd>{formatDiscount(order.set_discount_gr)}</dd>
            </div>
          ) : null}
          {order.coupon_discount_gr > 0 ? (
            <div>
              <dt>Kod {order.coupon_code}</dt>
              <dd>{formatDiscount(order.coupon_discount_gr)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Dostawa</dt>
            <dd>{order.shipping_gr === 0 ? "Darmowa" : formatPLN(order.shipping_gr)}</dd>
          </div>
          <div className="koszyk-sumy__razem">
            <dt>Razem</dt>
            <dd>{formatPLN(order.total_gr)}</dd>
          </div>
        </dl>

        <h2 className="zam-status__podtytul">Dostawa</h2>
        <p className="zam-status__tekst">
          {settings.shippingLabels[order.shipping_method] ?? order.shipping_method}
          {address ? `, ${address}` : ""}.
          {order.eta ? (
            <>
              {" "}
              Wyślemy: {formatCivilDate(parseIsoDate(order.eta.dispatch_date), tz)}. Dostawa:{" "}
              {formatCivilDate(parseIsoDate(order.eta.delivery_date), tz)}.
            </>
          ) : null}
        </p>

        <h2 className="zam-status__podtytul">Co dalej</h2>
        <ol className="zam-status__kroki">
          <li>
            Zamówienie zobaczysz w panelu sklepu demonstracyjnego; nic nie jest naprawdę pakowane
            ani wysyłane.
          </li>
          <li>Nie wysyłamy e-maili ani SMS-ów, więc status sprawdzisz tylko tutaj.</li>
          <li>Możesz wrócić do zakupów i zbudować kolejny set.</li>
        </ol>
        <div className="zam-status__akcje">
          <a href="/zbuduj-set" className="tk-btn tk-btn--glowny">
            Zbuduj kolejny set
          </a>
          <a href="/klawiatury" className="tk-btn tk-btn--poboczny">
            Wróć do sklepu
          </a>
        </div>
      </div>
    </Shell>
  );
}
