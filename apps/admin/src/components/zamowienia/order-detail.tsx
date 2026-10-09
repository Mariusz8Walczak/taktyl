"use client";
// B-202, B-203, B-204, B-205, B-208 (docs/15 par. 8.2): szczegoly zamowienia - pozycje (grupy setow z rabatem), kwoty co do
// grosza (grosze -> Intl), dostawa, faktura, platnosc symulowana, historia statusow, notatki wewnetrzne. Zmiana statusu
// WYLACZNIE przejsciami z allowed_transitions[] (API jest zrodlem prawdy); anulowanie z powodem w oknie z pulapka fokusu.
import { zodResolver } from "@hookform/resolvers/zod";
import {
  orderNoteRequestSchema,
  orderTransitionRequestSchema,
  type OrderStatus,
} from "@taktyl/contracts";
import type { z } from "zod";
import { z as zod } from "zod";
import { Alert, Badge, Button, Dialog, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../lib/api/client";
import { ordersApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { applyServerErrors, plError } from "../../lib/forms";
import {
  formatCount,
  formatDateTime,
  formatPLN,
  ITEM_COUNT,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  SHIPPING_LABEL,
} from "../../lib/format";
import { keys, useOrder } from "../../lib/queries";
import { DisabledReason } from "../ui/disabled-reason";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";

type Detail = Awaited<ReturnType<typeof ordersApi.get>>;
type Target = Detail["allowed_transitions"][number];

/** Tekst przycisku dla przejscia: pelna tresc akcji (docs/15 par. 13). */
export const TRANSITION_LABEL: Record<Target, string> = {
  processing: "Rozpocznij realizację",
  shipped: "Oznacz jako wysłane",
  delivered: "Oznacz jako dostarczone",
  cancelled: "Anuluj zamówienie",
};

const PAYMENT_STATUS_LABEL = {
  created: "Utworzona",
  paid: "Opłacona",
  failed: "Nieudana",
} as const;

const cancelSchema = zod.object({ note: zod.string() }).transform((v, ctx) => {
  // reguly z kontraktu (powod min. 5 znakow przy anulowaniu), komunikat pod polem "note"
  const r = orderTransitionRequestSchema.safeParse({ to: "cancelled", note: v.note });
  if (!r.success) {
    ctx.addIssue({ code: "custom", message: "Podaj powód anulowania.", path: ["note"] });
    return zod.NEVER;
  }
  return r.data;
});
type CancelInput = { note: string };

const noteFormSchema = zod.object({ note: zod.string() }).pipe(orderNoteRequestSchema);

function statusBadge(status: OrderStatus) {
  return (
    <Badge variant={status === "cancelled" ? "brak" : "nowosc"}>{ORDER_STATUS_LABEL[status]}</Badge>
  );
}

function CancelDialog({
  order,
  open,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: Detail;
  open: boolean;
  onClose: () => void;
  onDone: (d: Detail) => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CancelInput, unknown, z.output<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema, { error: plError({ note: "Podaj powód anulowania." }) }),
    defaultValues: { note: "" },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const restocks = order.status === "paid" || order.status === "processing";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const detail = await ordersApi.transition(order.number, values);
      reset();
      onDone(detail);
    } catch (e) {
      if (applyServerErrors(e, setError) > 0) return;
      setFormError(describeError(e, "to zamówienie").text);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Anulowanie zamówienia"
      returnFocusRef={returnFocusRef}
    >
      <form
        className="adm-formularz"
        onSubmit={onSubmit}
        noValidate
        aria-label="Anulowanie zamówienia"
      >
        <p>
          Anulujesz zamówienie {order.number}. Tej zmiany nie da się cofnąć w panelu.
          {restocks ? " Stany magazynowe zamówionych sztuk wrócą do magazynu." : ""}
        </p>
        {formError ? <Alert variant="blad">{formError}</Alert> : null}
        <Field
          as="textarea"
          label="Powód anulowania"
          hint="Co najmniej 5 znaków. Powód trafia do historii statusów."
          rows={3}
          error={errors.note?.message}
          {...register("note")}
        />
        <div className="adm-akcje">
          <Button type="submit" loading={isSubmitting}>
            Anuluj zamówienie
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Wróć bez anulowania
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Notes({ order, onChange }: { order: Detail; onChange: (d: Detail) => void }) {
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "orders.write");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ note: string }, unknown, z.output<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema, { error: plError({ note: "Wpisz treść notatki." }) }),
    defaultValues: { note: "" },
  });
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      onChange(await ordersApi.addNote(order.number, values));
      reset();
    } catch (e) {
      if (applyServerErrors(e, setError) > 0) return;
      setFormError(describeError(e, "to zamówienie").text);
    }
  });

  return (
    <section className="adm-karta adm-stos" aria-labelledby="notatki">
      <h2 id="notatki">Notatki wewnętrzne</h2>
      <p className="adm-powod">Klient ich nie widzi.</p>
      {order.notes.length === 0 ? (
        <p className="adm-tekst-slaby">Brak notatek.</p>
      ) : (
        <ul className="adm-lista">
          {order.notes.map((n) => (
            <li key={n.id}>
              <strong>{n.author ?? "system"}</strong>,{" "}
              <time dateTime={n.at}>{formatDateTime(n.at)}</time>
              <br />
              <span>{n.body}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="adm-formularz" onSubmit={onSubmit} noValidate aria-label="Dodaj notatkę">
        {formError ? <Alert variant="blad">{formError}</Alert> : null}
        <Field
          as="textarea"
          label="Nowa notatka"
          rows={3}
          disabled={!allowed}
          error={errors.note?.message}
          {...register("note")}
        />
        <div className="adm-akcje">
          <Button
            type="submit"
            variant="secondary"
            loading={isSubmitting}
            disabled={!allowed}
            aria-describedby={!allowed ? "powod-notatki" : undefined}
          >
            Dodaj notatkę
          </Button>
          <DisabledReason id="powod-notatki" reason={reason} />
        </div>
      </form>
    </section>
  );
}

function OrderView({ initial }: { initial: Detail }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "orders.write");
  const query = useOrder(initial.number);
  const order = query.data ?? initial;
  const headingRef = useRef<HTMLDivElement>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState<Target | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focusHeading, setFocusHeading] = useState(0);

  // docs/15 par. 8.2: po zapisie fokus na naglowek statusu (tabindex -1), zmiana ogloszona przez role="status".
  useEffect(() => {
    if (focusHeading > 0) headingRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [focusHeading]);

  const apply = (detail: Detail, text: string) => {
    qc.setQueryData(keys.order(detail.number), detail);
    void qc.invalidateQueries({ queryKey: ["orders"] });
    setMessage(text);
    setError(null);
    setFocusHeading((n) => n + 1);
  };

  const transition = async (to: Exclude<Target, "cancelled">) => {
    setBusy(to);
    setError(null);
    try {
      const detail = await ordersApi.transition(order.number, { to });
      apply(detail, `Status zmieniony: ${ORDER_STATUS_LABEL[detail.status]}.`);
    } catch (e) {
      setError(describeError(e, "to zamówienie").text);
      if (e instanceof ApiError && e.code === "invalid_transition") void query.refetch();
    } finally {
      setBusy(null);
    }
  };

  const main = order.allowed_transitions.find((t) => t !== "cancelled");
  const canCancel = order.allowed_transitions.includes("cancelled");

  return (
    <div className="adm-strona">
      <div ref={headingRef}>
        <PageHeader title={order.number} />
      </div>
      <div className="adm-wiersz">
        {statusBadge(order.status)}
        <span className="adm-licznik">
          Złożone {formatDateTime(order.created_at)}, {formatCount(order.items.length, ITEM_COUNT)}
        </span>
      </div>
      <p role="status" className="adm-powod">
        {message}
      </p>
      <nav aria-label="Okruszki">
        <Link className="tk-link" href="/zamowienia">
          Wróć do listy zamówień
        </Link>
      </nav>
      <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
        <div className="adm-stos">
          <section className="adm-karta" aria-labelledby="pozycje">
            <h2 id="pozycje">Pozycje</h2>
            <div
              className="adm-tabela-okno"
              role="region"
              aria-label="Pozycje zamówienia"
              tabIndex={0}
            >
              <table className="adm-tabela">
                <caption className="tk-sr-only">Pozycje zamówienia {order.number}</caption>
                <thead>
                  <tr>
                    <th scope="col">Produkt</th>
                    <th scope="col">SKU</th>
                    <th scope="col" className="adm-liczba">
                      Ilość
                    </th>
                    <th scope="col" className="adm-liczba">
                      Cena
                    </th>
                    <th scope="col" className="adm-liczba">
                      Rabat setu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it, i) => (
                    <tr key={`${it.sku}-${i}`}>
                      <th scope="row">
                        {it.name}
                        <br />
                        <span className="adm-tekst-slaby adm-tekst-xs">
                          {it.variant_label}
                          {it.group_id ? ", w secie" : ""}
                        </span>
                      </th>
                      <td>
                        {it.config_sku ? (
                          <>
                            <code>{it.config_sku}</code>
                            <br />
                            <span className="adm-tekst-slaby adm-tekst-xs">
                              na zamówienie, wariant bazowy {it.sku}
                            </span>
                          </>
                        ) : (
                          it.sku
                        )}
                      </td>
                      <td className="adm-liczba">{it.qty}</td>
                      <td className="adm-liczba">{formatPLN(it.unit_price_gr)}</td>
                      <td className="adm-liczba">
                        {it.set_discount_gr > 0 ? `−${formatPLN(it.set_discount_gr)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="adm-dl" aria-label="Kwoty">
              <dt>Produkty</dt>
              <dd className="adm-liczba">{formatPLN(order.items_gr)}</dd>
              <dt>Rabat setu</dt>
              <dd className="adm-liczba">
                {order.set_discount_gr > 0 ? `−${formatPLN(order.set_discount_gr)}` : formatPLN(0)}
              </dd>
              <dt>Kod rabatowy{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
              <dd className="adm-liczba">
                {order.coupon_discount_gr > 0
                  ? `−${formatPLN(order.coupon_discount_gr)}`
                  : formatPLN(0)}
              </dd>
              <dt>Dostawa</dt>
              <dd className="adm-liczba">{formatPLN(order.shipping_gr)}</dd>
              <dt>
                <strong>Razem</strong>
              </dt>
              <dd className="adm-liczba">
                <strong>{formatPLN(order.total_gr)}</strong>
              </dd>
            </dl>
          </section>
          <Notes order={order} onChange={(d) => apply(d, "Dodano notatkę.")} />
        </div>

        <aside className="adm-stos" aria-label="Status i szczegóły">
          <section className="adm-karta adm-stos" aria-labelledby="akcje">
            <h2 id="akcje">Status</h2>
            <p>{ORDER_STATUS_LABEL[order.status]}</p>
            {error ? <Alert variant="blad">{error}</Alert> : null}
            {main ? (
              <Button
                loading={busy === main}
                disabled={!allowed || busy !== null}
                onClick={() => void transition(main as Exclude<Target, "cancelled">)}
              >
                {TRANSITION_LABEL[main]}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                ref={cancelTrigger}
                variant="secondary"
                disabled={!allowed || busy !== null}
                onClick={() => setCancelOpen(true)}
              >
                {TRANSITION_LABEL.cancelled}
              </Button>
            ) : null}
            {!main && !canCancel ? (
              <p className="adm-powod">
                {reason ?? "Z tego statusu nie ma już dostępnych przejść."}
              </p>
            ) : null}
            {reason && (main || canCancel) ? <p className="adm-powod">{reason}</p> : null}
          </section>

          <section className="adm-karta" aria-labelledby="platnosc">
            <h2 id="platnosc">Płatność (symulacja)</h2>
            <dl className="adm-dl">
              <dt>Metoda</dt>
              <dd>{PAYMENT_LABEL[order.payment.type]}</dd>
              <dt>Stan płatności</dt>
              <dd>{PAYMENT_STATUS_LABEL[order.payment.status]}</dd>
              <dt>Próby</dt>
              <dd>{order.payment.attempts}</dd>
            </dl>
          </section>

          <section className="adm-karta" aria-labelledby="dostawa">
            <h2 id="dostawa">Dostawa i kontakt</h2>
            <dl className="adm-dl">
              <dt>Metoda</dt>
              <dd>{SHIPPING_LABEL[order.shipping_method]}</dd>
              {order.eta ? (
                <>
                  <dt>Wysyłka</dt>
                  <dd>{order.eta.dispatch_date}</dd>
                  <dt>Dostawa</dt>
                  <dd>{order.eta.delivery_date}</dd>
                </>
              ) : null}
              <dt>E-mail</dt>
              <dd>{order.contact.email || "Dane usunięte"}</dd>
              <dt>Telefon</dt>
              <dd>{order.contact.phone || "Dane usunięte"}</dd>
              {order.shipping_address
                ? Object.entries(order.shipping_address).map(([k, v]) => (
                    <FragmentRow key={k} label={ADDRESS_LABEL[k] ?? k} value={v} />
                  ))
                : null}
            </dl>
            {order.invoice ? (
              <>
                <h3>Faktura</h3>
                <dl className="adm-dl">
                  {Object.entries(order.invoice).map(([k, v]) => (
                    <FragmentRow key={k} label={INVOICE_LABEL[k] ?? k} value={v} />
                  ))}
                </dl>
              </>
            ) : null}
          </section>

          <section className="adm-karta" aria-labelledby="historia">
            <h2 id="historia">Historia statusów</h2>
            <ol className="adm-lista">
              {order.history.map((h, i) => (
                <li key={i}>
                  <time dateTime={h.at}>{formatDateTime(h.at)}</time>: {ORDER_STATUS_LABEL[h.to]} (
                  {h.actor}){h.note ? <span className="adm-tekst-slaby">. {h.note}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <CancelDialog
        order={order}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onDone={(d) => {
          setCancelOpen(false);
          apply(d, `Zamówienie anulowane.${d.status === "cancelled" ? "" : ""}`);
        }}
        returnFocusRef={cancelTrigger}
      />
    </div>
  );
}

const ADDRESS_LABEL: Record<string, string> = {
  name: "Odbiorca",
  street: "Ulica",
  postcode: "Kod pocztowy",
  city: "Miasto",
  point: "Punkt odbioru",
};
const INVOICE_LABEL: Record<string, string> = { nip: "NIP", name: "Nazwa", address: "Adres" };

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function OrderDetail({ number }: { number: string }) {
  const query = useOrder(number);
  return (
    <QueryBoundary
      query={query}
      errorText="Nie udało się pobrać zamówienia."
      notFoundText="Nie ma takiego zamówienia."
    >
      {(order) => <OrderView initial={order} />}
    </QueryBoundary>
  );
}
