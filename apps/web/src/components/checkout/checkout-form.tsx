"use client";
// F-170...F-176, F-242 (docs/05 §7; wzorzec: `checkout.html`, docs/08 §6): jedna strona Kontakt -> Dostawa -> Faktura
// (zwinieta) -> Platnosc -> Zgody -> etykieta demo -> "Zamawiam i płacę". Pola zalezne od metody dostawy z ustawien
// (automat: e-mail, telefon, punkt; kurier: + imie i nazwisko, adres). Walidacja po opuszczeniu pola i przy wysylce,
// komunikat pod polem (aria-describedby, aria-invalid), fokus na pierwszy blad. ZERO pol na dane kart, kody BLIK i hasla.
import { Alert, Button, ChoiceTile, Field } from "@taktyl/ui";
import { formatPLN, matchesSearch } from "@taktyl/domain";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "../../styles/cart.css";
import "../../styles/checkout.css";
import {
  EMPTY_CHECKOUT,
  SERVER_PATH_TO_FIELD,
  buildOrderBody,
  fieldsOf,
  firstError,
  validateAll,
  validateField,
  type CheckoutValues,
  type Errors,
  type FieldKey,
} from "../../lib/cart/checkout-validation";
import { createOrder, skusFromStockErrors } from "../../lib/cart/order-client";
import {
  clearIdempotencyKey,
  getIdempotencyKey,
  saveOrderToken,
} from "../../lib/cart/order-session";
import {
  QUOTE_ERROR_TEXT,
  buildQuoteRequest,
  hasBlockingProblems,
  useCartQuote,
} from "../../lib/cart/quote";
import { useCart } from "../../lib/cart/store";
import {
  quoteItems,
  quoteValueGr,
  trackBeginCheckout,
  trackPaymentInfo,
  trackShippingInfo,
} from "../../lib/cart/tracking";
import type { PaymentType, ShippingTier } from "../../lib/track-events";
import { EmptyCartMessage } from "../cart/cart-parts";
import { OrderSummary } from "./order-summary";

export interface CheckoutSettings {
  shippingMethods: {
    id: string;
    label: string;
    priceGr: number;
    fields: string[];
    address: string | null;
  }[];
  paymentMethods: { id: string; label: string }[];
  pickupPoints: { id: string; city: string; label: string }[];
  demoLabel: string;
  demoEmailDomain: string;
}

const FIELD_IDS: Record<FieldKey, string> = {
  email: "zam-email",
  phone: "zam-telefon",
  shipping: "zam-dostawa",
  point: "zam-punkt-szukaj",
  name: "zam-imie",
  street: "zam-ulica",
  postcode: "zam-kod",
  city: "zam-miasto",
  nip: "zam-nip",
  companyName: "zam-firma",
  companyAddress: "zam-adres-firmy",
  payment: "zam-platnosc",
  terms: "zam-regulamin",
};

const STOCK_TEXT = "Część produktów skończyła się, zanim złożyłeś zamówienie.";

export function CheckoutForm({ settings }: { settings: CheckoutSettings }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useCart();
  const [values, setValues] = useState<CheckoutValues>(EMPTY_CHECKOUT);
  const [errors, setErrors] = useState<Errors>({});
  const [citySearch, setCitySearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<{ text: string; stockSkus?: string[] } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocus = useRef<FieldKey | null>(null);

  const {
    quote,
    status,
    error: quoteError,
    reload,
  } = useCartQuote(cart, {
    shippingMethod: values.shipping || null,
  });
  // F-170 (TAKTYL-80): do czasu wyceny przycisk jest w stanie ladowania z widocznym powodem; blad wyceny = ponow.
  const hasLines = cart.lines.length > 0;
  const waitingForQuote = hasLines && (status === "idle" || status === "loading");
  const quoteFailed = hasLines && status === "error";
  const fields = useMemo(
    () => fieldsOf(settings.shippingMethods, values.shipping),
    [settings.shippingMethods, values.shipping],
  );
  const blocked = hasBlockingProblems(quote);
  const method = settings.shippingMethods.find((m) => m.id === values.shipping) ?? null;

  const set = <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // begin_checkout: wejscie na /zamowienie, raz, gdy wycena jest gotowa (docs/10 §4)
  const began = useRef(false);
  useEffect(() => {
    if (began.current || !quote || status !== "ready" || quote.lines.length === 0) return;
    began.current = true;
    trackBeginCheckout(quote);
  }, [quote, status]);

  // add_shipping_info: po wyborze metody dostawy (raz na zmiane wyboru, po gotowej wycenie)
  const shippingSent = useRef<string>("");
  useEffect(() => {
    if (
      !values.shipping ||
      !quote ||
      status !== "ready" ||
      shippingSent.current === values.shipping
    )
      return;
    shippingSent.current = values.shipping;
    trackShippingInfo(quote, values.shipping as ShippingTier);
  }, [values.shipping, quote, status]);

  // fokus na pole po renderze (np. po ujawnieniu pol, ktore jeszcze nie istnialy)
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    document.getElementById(FIELD_IDS[key])?.focus();
  });

  const focusField = (key: FieldKey) => {
    pendingFocus.current = key;
    setErrors((e) => ({ ...e }));
  };

  const blur = (key: FieldKey) => {
    const msg = validateField(key, values, fields);
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  };
  const clearError = (...keys: FieldKey[]) =>
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });

  const points = useMemo(
    () =>
      settings.pickupPoints.filter((p) => !citySearch.trim() || matchesSearch(p.city, citySearch)),
    [settings.pickupPoints, citySearch],
  );

  // F-170 (TAKTYL-80): klikniecie przed wycena nie jest gubione - zamowienie czeka w kolejce i rusza po wycenie.
  const [queued, setQueued] = useState(false);

  async function run() {
    if (busy) return;
    setFormError(null);
    const errs = validateAll(values, fields);
    setErrors(errs);
    const first = firstError(errs);
    if (first) {
      setQueued(false);
      focusField(first);
      return;
    }
    const body = buildQuoteRequest(cart, values.shipping);
    if (blocked) {
      setQueued(false);
      return; // powod jest widoczny w ostrzezeniu "pozycje bez stanu"
    }
    if (!quote || !body || status !== "ready") {
      if (waitingForQuote) {
        setQueued(true); // wyslemy po powrocie wyceny (efekt ponizej)
        return;
      }
      setQueued(false);
      setFormError({
        text: quoteFailed
          ? "Nie udało się sprawdzić cen. Użyj przycisku „Spróbuj ponownie”."
          : "Twój koszyk jest pusty. Dodaj produkty, żeby złożyć zamówienie.",
      });
      return;
    }
    setQueued(false);
    setBusy(true);
    const applied = quote.coupon?.applied ? quote.coupon.code : null;
    const res = await createOrder(
      buildOrderBody({
        values,
        fields,
        items: body.items,
        coupon: applied,
        expectedTotalGr: quote.summary.total_gr,
      }),
      getIdempotencyKey(),
    );
    if (res.ok) {
      clearIdempotencyKey();
      saveOrderToken(res.data.number, res.data.order_token);
      // add_payment_info po wyslaniu formularza (docs/10 §4); dane osobowe nie trafiaja do pomiaru
      trackPaymentInfo(
        quoteItems(quote),
        quoteValueGr(quote),
        values.payment as PaymentType,
        applied ?? undefined,
      );
      router.push(`/zamowienie/platnosc?id=${encodeURIComponent(res.data.number)}`);
      return;
    }
    setBusy(false);
    if (res.kind === "network" || res.kind === "server" || res.kind === "rate_limited") {
      // ten sam klucz idempotencji zostaje: ponowienie nie zalozy drugiego zamowienia
      setFormError({
        text:
          res.kind === "rate_limited"
            ? "Zbyt wiele prób w krótkim czasie. Poczekaj chwilę i spróbuj ponownie. Dane w formularzu zostały."
            : "Nie udało się złożyć zamówienia. Sprawdź połączenie i spróbuj ponownie. Dane w formularzu zostały.",
      });
      return;
    }
    clearIdempotencyKey();
    if (res.kind === "out_of_stock") {
      setFormError({ text: STOCK_TEXT, stockSkus: skusFromStockErrors(res.errors) });
    } else if (res.kind === "price_changed") {
      reload();
      setFormError({
        text: "Ceny zmieniły się. Sprawdź nowe podsumowanie i złóż zamówienie ponownie.",
      });
    } else if (res.kind === "validation") {
      const mapped: Errors = {};
      for (const er of res.errors) {
        const key = SERVER_PATH_TO_FIELD[er.path];
        if (key)
          mapped[key] = key === "nip" ? "Numer NIP jest nieprawidłowy. Sprawdź cyfry." : er.message;
      }
      const k = firstError(mapped);
      if (k) {
        setErrors(mapped);
        focusField(k);
      } else {
        setFormError({
          text: "Serwer odrzucił dane zamówienia. Sprawdź formularz i spróbuj ponownie.",
        });
      }
    } else {
      setFormError({ text: "Nie udało się złożyć zamówienia. Spróbuj ponownie." });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run();
  }

  // Wycena wrocila (albo sie nie udala) po kliknieciu: kontynuacja z aktualnymi wartosciami formularza.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!queued || waitingForQuote) return;
    void runRef.current();
  }, [queued, waitingForQuote]);

  if (!mounted) {
    return (
      <div className="kontener strona">
        <h1 className="naglowek-strony">Zamówienie</h1>
      </div>
    );
  }
  if (cart.lines.length === 0) {
    return (
      <div className="kontener strona">
        <h1 className="naglowek-strony">Zamówienie</h1>
        <EmptyCartMessage />
      </div>
    );
  }

  const pointSelected = settings.pickupPoints.find((p) => p.id === values.point);
  const err = (k: FieldKey) => errors[k];
  const bind = (k: FieldKey, key: keyof CheckoutValues) => ({
    id: FIELD_IDS[k],
    value: values[key] as string,
    onChange: (ev: { target: { value: string } }) => {
      set(key, ev.target.value as never);
      if (errors[k]) clearError(k);
    },
    onBlur: () => blur(k),
    error: err(k),
  });

  return (
    <div className="kontener strona zam">
      <h1 className="naglowek-strony">Zamówienie</h1>
      <div className="zam__uklad">
        <OrderSummary
          cart={cart}
          quote={quote}
          shippingLabel={method?.label ?? null}
          busy={status === "loading"}
        />
        <form
          ref={formRef}
          className="zam__formularz"
          onSubmit={onSubmit}
          noValidate
          aria-describedby={formError ? "zam-blad-formularza" : undefined}
        >
          {formError ? (
            <Alert variant="blad" id="zam-blad-formularza" data-testid="zam-blad-formularza">
              {formError.text}
              {formError.stockSkus && formError.stockSkus.length > 0 ? (
                <ul className="zam__braki">
                  {formError.stockSkus.map((s) => (
                    <li key={s}>SKU: {s}</li>
                  ))}
                </ul>
              ) : null}
              {formError.stockSkus ? (
                <p>
                  <a href="/koszyk" className="tk-link">
                    Wróć do koszyka
                  </a>
                </p>
              ) : null}
            </Alert>
          ) : null}
          {blocked ? (
            <Alert variant="uwaga">
              W koszyku są pozycje bez stanu.{" "}
              <a href="/koszyk" className="tk-link">
                Wróć do koszyka
              </a>{" "}
              i wybierz inny wariant.
            </Alert>
          ) : null}

          <section className="zam__sekcja" aria-labelledby="zam-kontakt">
            <h2 id="zam-kontakt" className="zam__naglowek">
              1. Kontakt
            </h2>
            <Field
              {...bind("email", "email")}
              label="Adres e-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={`jan@${settings.demoEmailDomain}`}
              hint="To sklep demonstracyjny: nie wysyłamy e-maili, więc potwierdzenie zobaczysz tylko na stronie."
              required
            />
            <Field
              {...bind("phone", "phone")}
              label="Telefon"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="500 000 000"
              hint="9 cyfr, kurier i automat paczkowy potrzebują numeru."
              required
            />
          </section>

          <fieldset
            className="zam__sekcja zam__grupa"
            aria-describedby={err("shipping") ? "zam-dostawa-blad" : undefined}
          >
            <legend className="zam__naglowek">2. Dostawa</legend>
            <div className="zam__kafle">
              {settings.shippingMethods.map((m, i) => (
                <ChoiceTile
                  key={m.id}
                  id={i === 0 ? FIELD_IDS.shipping : `zam-dostawa-${m.id}`}
                  name="dostawa"
                  value={m.id}
                  checked={values.shipping === m.id}
                  onChange={() => {
                    setValues((v) => ({
                      ...v,
                      shipping: m.id,
                      point: m.id === "automat" ? v.point : "",
                    }));
                    clearError("shipping", "point", "name", "street", "postcode", "city");
                  }}
                  title={m.label}
                  description={
                    <>
                      {quote && quote.summary.free_shipping_remaining_gr === 0
                        ? "Darmowa"
                        : formatPLN(m.priceGr)}
                      {m.address ? ` · ${m.address}` : ""}
                    </>
                  }
                  aria-invalid={err("shipping") ? true : undefined}
                />
              ))}
            </div>
            {err("shipping") ? (
              <p id="zam-dostawa-blad" className="tk-pole__blad zam__blad-grupy">
                {err("shipping")}
              </p>
            ) : null}

            {fields.includes("point") ? (
              <div className="zam__punkty">
                <Field
                  id={FIELD_IDS.point}
                  label="Szukaj automatu po mieście"
                  type="search"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  autoComplete="off"
                  error={err("point")}
                  hint="Lista automatów jest przykładowa, bez mapy."
                />
                <div role="radiogroup" aria-label="Automat paczkowy" className="zam__kafle">
                  {points.length === 0 ? (
                    <p className="zam__brak-punktow" role="status">
                      Brak automatów w tym mieście. Zmień wyszukiwanie.
                    </p>
                  ) : (
                    points.map((p) => (
                      <ChoiceTile
                        key={p.id}
                        id={`zam-punkt-${p.id}`}
                        name="punkt"
                        value={p.id}
                        checked={values.point === p.id}
                        onChange={() => {
                          set("point", p.id);
                          clearError("point");
                        }}
                        title={p.city}
                        description={p.label}
                      />
                    ))
                  )}
                </div>
                {pointSelected && !points.some((p) => p.id === pointSelected.id) ? (
                  <p className="zam__wybrany">Wybrany automat: {pointSelected.label}</p>
                ) : null}
              </div>
            ) : null}

            {fields.includes("name") ? (
              <Field
                {...bind("name", "name")}
                label="Imię i nazwisko"
                autoComplete="name"
                required
              />
            ) : null}
            {fields.includes("street") ? (
              <Field
                {...bind("street", "street")}
                label="Ulica i numer domu"
                autoComplete="street-address"
                required
              />
            ) : null}
            {fields.includes("postcode") ? (
              <Field
                {...bind("postcode", "postcode")}
                label="Kod pocztowy"
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="00-000"
                required
              />
            ) : null}
            {fields.includes("city") ? (
              <Field
                {...bind("city", "city")}
                label="Miejscowość"
                autoComplete="address-level2"
                required
              />
            ) : null}
          </fieldset>

          <section className="zam__sekcja" aria-labelledby="zam-faktura-naglowek">
            <h2 id="zam-faktura-naglowek" className="zam__naglowek">
              3. Faktura
            </h2>
            <label className="zam__zgoda">
              <input
                type="checkbox"
                id="zam-faktura"
                checked={values.invoice}
                aria-expanded={values.invoice}
                aria-controls="zam-faktura-pola"
                onChange={(e) => {
                  set("invoice", e.target.checked);
                  if (!e.target.checked) clearError("nip", "companyName", "companyAddress");
                }}
              />
              <span>Chcę otrzymać fakturę na firmę</span>
            </label>
            <div id="zam-faktura-pola" className="zam__faktura">
              {values.invoice ? (
                <>
                  <Field
                    {...bind("nip", "nip")}
                    label="NIP"
                    inputMode="numeric"
                    autoComplete="off"
                    hint="10 cyfr, spacje i myślniki są dozwolone."
                    required
                  />
                  <Field
                    {...bind("companyName", "companyName")}
                    label="Nazwa firmy"
                    autoComplete="organization"
                    required
                  />
                  <Field
                    {...bind("companyAddress", "companyAddress")}
                    label="Adres firmy"
                    autoComplete="off"
                    hint="Ulica, kod pocztowy i miejscowość."
                    required
                  />
                </>
              ) : null}
            </div>
          </section>

          <fieldset
            className="zam__sekcja zam__grupa"
            aria-describedby={err("payment") ? "zam-platnosc-blad" : undefined}
          >
            <legend className="zam__naglowek">4. Płatność</legend>
            <p className="zam__info">
              Płatność jest symulacją: nie wpisujesz tu danych karty ani kodu BLIK.
            </p>
            <div className="zam__kafle">
              {settings.paymentMethods.map((p, i) => (
                <ChoiceTile
                  key={p.id}
                  id={i === 0 ? FIELD_IDS.payment : `zam-platnosc-${p.id}`}
                  name="platnosc"
                  value={p.id}
                  checked={values.payment === p.id}
                  onChange={() => {
                    set("payment", p.id);
                    clearError("payment");
                  }}
                  title={p.label}
                />
              ))}
            </div>
            {err("payment") ? (
              <p id="zam-platnosc-blad" className="tk-pole__blad zam__blad-grupy">
                {err("payment")}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="zam__sekcja zam__grupa">
            <legend className="zam__naglowek">5. Zgody</legend>
            <label className="zam__zgoda">
              <input
                type="checkbox"
                id={FIELD_IDS.terms}
                checked={values.terms}
                aria-invalid={err("terms") ? true : undefined}
                aria-describedby={err("terms") ? "zam-regulamin-blad" : undefined}
                onChange={(e) => {
                  set("terms", e.target.checked);
                  clearError("terms");
                }}
              />
              <span>
                Akceptuję{" "}
                <a href="/regulamin" className="tk-link">
                  regulamin
                </a>{" "}
                (wymagane)
              </span>
            </label>
            {err("terms") ? (
              <p id="zam-regulamin-blad" className="tk-pole__blad zam__blad-grupy">
                {err("terms")}
              </p>
            ) : null}
            <label className="zam__zgoda">
              <input
                type="checkbox"
                id="zam-newsletter"
                checked={values.newsletter}
                onChange={(e) => set("newsletter", e.target.checked)}
              />
              <span>Chcę dostawać newsletter (opcjonalnie; w demo nic nie wysyłamy)</span>
            </label>
          </fieldset>

          <div className="zam__wyslij">
            <p className="zam__demo" data-testid="zam-etykieta-demo">
              {settings.demoLabel}
            </p>
            <Button
              type="submit"
              loading={busy || queued}
              disabled={blocked || quoteFailed}
              aria-describedby={waitingForQuote || quoteFailed ? "zam-powod-wyceny" : undefined}
              className="zam__zamow"
            >
              Zamawiam i płacę
            </Button>
            {waitingForQuote ? (
              <p id="zam-powod-wyceny" className="zam__powod" role="status">
                Czekamy na wycenę koszyka...
              </p>
            ) : null}
            {quoteFailed ? (
              <p id="zam-powod-wyceny" className="zam__powod" role="alert">
                {QUOTE_ERROR_TEXT[quoteError?.kind ?? "server"]}{" "}
                <Button variant="secondary" onClick={reload}>
                  Spróbuj ponownie
                </Button>
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
