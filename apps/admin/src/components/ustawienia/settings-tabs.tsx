"use client";
// B-400..B-408 (docs/15 par. 10.1): zakladki ustawien - Dostawa, Platnosci, Rabaty i kody, Punkty odbioru, Wysylka,
// Firma i etykiety. Kazda zakladka to osobny formularz z wlasnym przyciskiem "Zapisz". Zapis tylko owner; pozostali widza
// pola nieaktywne z objasnieniem. Usuwanie z list przez "Usun" z "Cofnij" w komunikacie (bez confirm()).
import { Button, Field, useToast } from "@taktyl/ui";
import { computeDispatch, formatCivilDate } from "@taktyl/domain";
import { useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { SHIPPING_LABEL, PAYMENT_LABEL } from "../../lib/format";
import { getFieldError } from "../../lib/product-form";
import {
  companyBody,
  companyDefaults,
  companyFormSchema,
  COMPANY_KEYS,
  discountsBody,
  discountsDefaults,
  discountsFormSchema,
  dispatchBody,
  dispatchDefaults,
  dispatchFormSchema,
  paymentsBody,
  paymentsDefaults,
  paymentsFormSchema,
  pickupBody,
  pickupDefaults,
  pickupFormSchema,
  SETTINGS_MESSAGES,
  shippingBody,
  shippingDefaults,
  shippingFormSchema,
  SHIPPING_FIELD_LABEL,
  SHIPPING_FIELD_OPTIONS,
  type AdminSettings,
  type CompanyInput,
  type CompanyOutput,
  type DiscountsInput,
  type DiscountsOutput,
  type DispatchInput,
  type DispatchOutput,
  type PaymentsInput,
  type PaymentsOutput,
  type PickupInput,
  type PickupOutput,
  type ShippingInput,
  type ShippingOutput,
} from "../../lib/settings-form";
import { TabShell, useSettingsTab } from "./use-settings-tab";

// ------------------------------------------------------------------ Dostawa (B-400, B-402)
export function ShippingTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<ShippingInput, ShippingOutput>({
    settings,
    schema: shippingFormSchema as never,
    defaults: shippingDefaults,
    toBody: shippingBody as never,
    messages: SETTINGS_MESSAGES,
    exact: { free_shipping_threshold_gr: "threshold" },
    rename: {
      shipping_methods: "methods",
      price_gr: "price",
      eta_business_days: "eta",
    },
  });
  const {
    register,
    formState: { errors },
  } = tab.form;
  const off = !tab.allowed;
  const err = (p: string) => getFieldError(errors, p);
  return (
    <TabShell tab={tab} label="Dostawa">
      <section className="adm-karta adm-stos" aria-labelledby="prog">
        <h2 id="prog">Darmowa dostawa</h2>
        <Field
          label="Próg darmowej dostawy (zł)"
          hint="Z przecinkiem, np. 299,00. API zapisuje grosze."
          inputMode="decimal"
          disabled={off}
          error={errors.threshold?.message}
          {...register("threshold")}
        />
      </section>
      {settings.shipping_methods.map((m, i) => (
        <fieldset key={m.id} className="adm-karta adm-stos">
          <legend className="tk-pole__etykieta">{SHIPPING_LABEL[m.id]}</legend>
          <input type="hidden" {...register(`methods.${i}.id` as const)} />
          <div className="adm-siatka">
            <Field
              label="Nazwa (opisowa, bez nazw handlowych)"
              disabled={off}
              error={err(`methods.${i}.label`)}
              {...register(`methods.${i}.label` as const)}
            />
            <Field
              label="Cena (zł)"
              inputMode="decimal"
              disabled={off}
              error={err(`methods.${i}.price`)}
              {...register(`methods.${i}.price` as const)}
            />
            <Field
              label="Dni robocze dostawy"
              type="number"
              inputMode="numeric"
              disabled={off}
              error={err(`methods.${i}.eta`)}
              {...register(`methods.${i}.eta` as const, { valueAsNumber: true })}
            />
            <Field
              label="Adres odbioru (tylko odbiór osobisty)"
              hint="Adres fikcyjny, kod 00-000."
              disabled={off}
              error={err(`methods.${i}.address`)}
              {...register(`methods.${i}.address` as const)}
            />
          </div>
          <fieldset aria-describedby={err(`methods.${i}.fields`) ? `m-${i}-pola-blad` : undefined}>
            <legend className="tk-pole__etykieta">Pola wymagane w kasie</legend>
            <div className="adm-zetony">
              {SHIPPING_FIELD_OPTIONS.map((f) => (
                <label key={f} className="adm-radio">
                  <input
                    type="checkbox"
                    value={f}
                    disabled={off}
                    {...register(`methods.${i}.fields` as const)}
                  />
                  <span>{SHIPPING_FIELD_LABEL[f]}</span>
                </label>
              ))}
            </div>
            {err(`methods.${i}.fields`) ? (
              <p id={`m-${i}-pola-blad`} className="tk-pole__blad">
                {err(`methods.${i}.fields`)}
              </p>
            ) : null}
          </fieldset>
          <label className="adm-radio">
            <input type="checkbox" disabled={off} {...register(`methods.${i}.active` as const)} />
            <span>Metoda aktywna w kasie</span>
          </label>
        </fieldset>
      ))}
    </TabShell>
  );
}

// ------------------------------------------------------------------ Platnosci (B-403)
export function PaymentsTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<PaymentsInput, PaymentsOutput>({
    settings,
    schema: paymentsFormSchema as never,
    defaults: paymentsDefaults,
    toBody: paymentsBody as never,
    messages: { ...SETTINGS_MESSAGES, "methods.*.label": "Wpisz nazwę metody płatności." },
    rename: { payment_methods: "methods" },
  });
  const {
    register,
    formState: { errors },
  } = tab.form;
  const off = !tab.allowed;
  return (
    <TabShell tab={tab} label="Płatności">
      <p className="adm-powod">
        Metody płatności to tekst (bez logotypów). Wyłączona metoda znika z kasy. Płatność w sklepie
        jest symulacją.
      </p>
      {settings.payment_methods.map((m, i) => (
        <fieldset key={m.id} className="adm-karta adm-stos">
          <legend className="tk-pole__etykieta">{PAYMENT_LABEL[m.id]}</legend>
          <input type="hidden" {...register(`methods.${i}.id` as const)} />
          <Field
            label="Nazwa w kasie"
            disabled={off}
            error={getFieldError(errors, `methods.${i}.label`)}
            {...register(`methods.${i}.label` as const)}
          />
          <label className="adm-radio">
            <input type="checkbox" disabled={off} {...register(`methods.${i}.active` as const)} />
            <span>Metoda aktywna w kasie</span>
          </label>
        </fieldset>
      ))}
    </TabShell>
  );
}

// ------------------------------------------------------------------ Rabaty i kody (B-401, B-404)
export function DiscountsTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<DiscountsInput, DiscountsOutput>({
    settings,
    schema: discountsFormSchema as never,
    defaults: discountsDefaults,
    toBody: discountsBody as never,
    messages: SETTINGS_MESSAGES,
    exact: { "set_discount.percent": "percent", "set_discount.categories": "percent" },
    rename: { discount_codes: "codes" },
  });
  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = tab.form;
  const { fields, append, remove, insert } = useFieldArray({ control, name: "codes" as never });
  const toast = useToast();
  const off = !tab.allowed;
  const err = (p: string) => getFieldError(errors, p);

  const removeCode = (index: number) => {
    const snapshot = getValues(`codes.${index}` as never);
    remove(index);
    toast.toast({
      message: `Usunięto kod ${(snapshot as { code?: string }).code ?? ""}. Zapisz, aby zmiana weszła w życie.`,
      actionLabel: "Cofnij",
      onAction: () => insert(index, snapshot as never),
    });
  };

  return (
    <TabShell tab={tab} label="Rabaty i kody">
      <section className="adm-karta adm-stos" aria-labelledby="rabat-setu">
        <h2 id="rabat-setu">Rabat setu</h2>
        <Field
          label="Rabat setu (%)"
          hint="Liczba od 0 do 50. Zmiana przelicza ceny gotowych setów."
          type="number"
          inputMode="numeric"
          disabled={off}
          error={errors.percent?.message}
          {...register("percent", { valueAsNumber: true })}
        />
        <p className="adm-powod">
          Wymagane kategorie: {settings.set_discount.categories.join(", ")}.
        </p>
      </section>
      <section className="adm-stos" aria-labelledby="kody">
        <h2 id="kody">Kody rabatowe</h2>
        {fields.length === 0 ? <p className="adm-tekst-slaby">Brak kodów.</p> : null}
        {fields.map((f, i) => (
          <fieldset key={f.id} className="adm-karta adm-stos">
            <legend className="tk-pole__etykieta">Kod {i + 1}</legend>
            <input type="hidden" {...register(`codes.${i}.valid_from` as never)} />
            <input type="hidden" {...register(`codes.${i}.valid_to` as never)} />
            <div className="adm-siatka">
              <Field
                label="Kod"
                hint="4-20 znaków: wielkie litery i cyfry."
                disabled={off}
                error={err(`codes.${i}.code`)}
                {...register(`codes.${i}.code` as never)}
              />
              <Field
                as="select"
                label="Rodzaj"
                disabled={off}
                {...register(`codes.${i}.type` as never)}
              >
                <option value="percent">Procent</option>
                <option value="free_shipping">Darmowa dostawa</option>
              </Field>
              <Field
                label="Wartość (%)"
                hint="Tylko dla kodu procentowego."
                type="number"
                inputMode="numeric"
                disabled={off}
                error={err(`codes.${i}.value`)}
                {...register(`codes.${i}.value` as never)}
              />
              <Field
                label="Zakres (opis)"
                disabled={off}
                error={err(`codes.${i}.scope`)}
                {...register(`codes.${i}.scope` as never)}
              />
              <Field
                label="Etykieta"
                disabled={off}
                error={err(`codes.${i}.label`)}
                {...register(`codes.${i}.label` as never)}
              />
            </div>
            <label className="adm-radio">
              <input type="checkbox" disabled={off} {...register(`codes.${i}.active` as never)} />
              <span>Kod aktywny</span>
            </label>
            <div>
              <Button variant="secondary" disabled={off} onClick={() => removeCode(i)}>
                {`Usuń kod ${i + 1}`}
              </Button>
            </div>
          </fieldset>
        ))}
        <div>
          <Button
            variant="secondary"
            disabled={off}
            onClick={() =>
              append({
                code: "",
                type: "percent",
                value: "",
                scope: "pozycje spoza setów",
                label: "",
                active: true,
                valid_from: "",
                valid_to: "",
              } as never)
            }
          >
            Dodaj kod
          </Button>
        </div>
      </section>
    </TabShell>
  );
}

// ------------------------------------------------------------------ Punkty odbioru (B-405)
export function PickupTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<PickupInput, PickupOutput>({
    settings,
    schema: pickupFormSchema as never,
    defaults: pickupDefaults,
    toBody: pickupBody as never,
    messages: SETTINGS_MESSAGES,
    rename: { pickup_points: "points" },
  });
  const {
    register,
    control,
    getValues,
    watch,
    formState: { errors },
  } = tab.form;
  const { fields, append, remove, insert } = useFieldArray({ control, name: "points" as never });
  const toast = useToast();
  const [q, setQ] = useState("");
  const off = !tab.allowed;
  const err = (p: string) => getFieldError(errors, p);
  const values = watch("points" as never) as unknown as PickupInput["points"] | undefined;
  const needle = q.trim().toLowerCase();
  const matches = (i: number) => {
    if (!needle) return true;
    const p = values?.[i];
    return !p || `${p.id} ${p.city} ${p.label}`.toLowerCase().includes(needle);
  };
  const shown = fields.filter((_, i) => matches(i)).length;

  const removePoint = (index: number) => {
    const snapshot = getValues(`points.${index}` as never);
    remove(index);
    toast.toast({
      message: `Usunięto punkt ${(snapshot as { id?: string }).id ?? ""}. Zapisz, aby zmiana weszła w życie.`,
      actionLabel: "Cofnij",
      onAction: () => insert(index, snapshot as never),
    });
  };

  return (
    <TabShell tab={tab} label="Punkty odbioru">
      <p className="adm-powod">
        Wyłącznie adresy fikcyjne, kod pocztowy 00-000. Lista w kasie jest filtrowana po mieście.
      </p>
      <Field
        label="Szukaj punktu"
        hint={`Pokazano ${shown} z ${fields.length}.`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {fields.map((f, i) => (
        <fieldset key={f.id} className="adm-karta adm-stos" hidden={!matches(i)}>
          <legend className="tk-pole__etykieta">Punkt {i + 1}</legend>
          <div className="adm-siatka">
            <Field
              label="Identyfikator"
              hint="Np. WAW-001."
              disabled={off}
              error={err(`points.${i}.id`)}
              {...register(`points.${i}.id` as never)}
            />
            <Field
              label="Miasto"
              disabled={off}
              error={err(`points.${i}.city`)}
              {...register(`points.${i}.city` as never)}
            />
            <Field
              label="Nazwa i adres (fikcyjny)"
              disabled={off}
              error={err(`points.${i}.label`)}
              {...register(`points.${i}.label` as never)}
            />
          </div>
          <label className="adm-radio">
            <input type="checkbox" disabled={off} {...register(`points.${i}.active` as never)} />
            <span>Punkt aktywny</span>
          </label>
          <div>
            <Button variant="secondary" disabled={off} onClick={() => removePoint(i)}>
              {`Usuń punkt ${i + 1}`}
            </Button>
          </div>
        </fieldset>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={off}
          onClick={() => append({ id: "", city: "", label: "", active: true } as never)}
        >
          Dodaj punkt
        </Button>
      </div>
    </TabShell>
  );
}

// ------------------------------------------------------------------ Wysylka (B-407)
/** Chwila, ktorej czas scienny w Europe/Warsaw to data + godzina (dla podgladu terminu). */
export function warsawInstant(date: string, hour: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (const offset of [1, 2]) {
    const candidate = new Date(Date.UTC(y, mo - 1, d, hour - offset));
    const wall = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hour: "numeric",
      hourCycle: "h23",
      day: "numeric",
    }).formatToParts(candidate);
    const h = Number(wall.find((p) => p.type === "hour")?.value);
    const day = Number(wall.find((p) => p.type === "day")?.value);
    if (h === hour && day === d) return candidate;
  }
  return null;
}

export function DispatchTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<DispatchInput, DispatchOutput>({
    settings,
    schema: dispatchFormSchema as never,
    defaults: dispatchDefaults,
    toBody: dispatchBody as never,
    messages: SETTINGS_MESSAGES,
    exact: { dispatch_cutoff_hour: "cutoff" },
  });
  const {
    register,
    watch,
    formState: { errors },
  } = tab.form;
  const [date, setDate] = useState("2026-10-07");
  const [hour, setHour] = useState("13");
  const [method, setMethod] = useState(settings.shipping_methods[0]?.id ?? "kurier");
  const cutoff = Number(watch("cutoff"));
  const eta = settings.shipping_methods.find((m) => m.id === method)?.eta_business_days ?? 1;

  const preview = useMemo(() => {
    const at = warsawInstant(date, Number(hour));
    if (!at || !Number.isInteger(cutoff) || cutoff < 0 || cutoff > 23) return null;
    const info = computeDispatch(at, {
      cutoffHour: cutoff,
      timeZone: "Europe/Warsaw",
      etaBusinessDays: eta,
    });
    return {
      label: info.label,
      delivery: formatCivilDate(info.deliveryDate, "Europe/Warsaw"),
    };
  }, [date, hour, cutoff, eta]);

  return (
    <TabShell tab={tab} label="Wysyłka">
      <section className="adm-karta adm-stos" aria-labelledby="godzina">
        <h2 id="godzina">Godzina graniczna</h2>
        <Field
          label="Zamówienia przed tą godziną wychodzą tego samego dnia roboczego"
          hint="Godzina od 0 do 23, strefa Europe/Warsaw."
          type="number"
          inputMode="numeric"
          disabled={!tab.allowed}
          error={errors.cutoff?.message}
          {...register("cutoff", { valueAsNumber: true })}
        />
      </section>
      <section className="adm-karta adm-stos" aria-labelledby="podglad-terminu">
        <h2 id="podglad-terminu">Podgląd terminu</h2>
        <div className="adm-siatka">
          <Field
            label="Dzień zamówienia"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            label="Godzina zamówienia"
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
          />
          <Field
            as="select"
            label="Metoda dostawy"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            {settings.shipping_methods.map((m) => (
              <option key={m.id} value={m.id}>
                {SHIPPING_LABEL[m.id]}
              </option>
            ))}
          </Field>
        </div>
        <p role="status" data-testid="podglad-terminu">
          {preview
            ? `${preview.label}. Dostawa: ${preview.delivery}.`
            : "Wpisz poprawną datę i godzinę."}
        </p>
        <p className="adm-powod">Podgląd liczy dla niezapisanej godziny granicznej.</p>
      </section>
    </TabShell>
  );
}

// ------------------------------------------------------------------ Firma i etykiety (B-406, B-408)
export function CompanyTab({ settings }: { settings: AdminSettings }) {
  const tab = useSettingsTab<CompanyInput, CompanyOutput>({
    settings,
    schema: companyFormSchema as never,
    defaults: companyDefaults,
    toBody: companyBody as never,
    messages: SETTINGS_MESSAGES,
    exact: { "demo.label": "demoLabel" },
  });
  const {
    register,
    formState: { errors },
  } = tab.form;
  const off = !tab.allowed;
  return (
    <TabShell tab={tab} label="Firma i etykiety">
      <section className="adm-karta adm-stos" aria-labelledby="etykieta-demo">
        <h2 id="etykieta-demo">Etykieta demo</h2>
        <Field
          label="Tekst paska demo"
          hint="Widoczny w pasku demo, stopce, kasie i na ekranie płatności. Nie może być pusty i musi mówić, że to sklep demonstracyjny."
          disabled={off}
          error={errors.demoLabel?.message}
          {...register("demoLabel")}
        />
      </section>
      <section className="adm-karta adm-stos" aria-labelledby="firma">
        <h2 id="firma">Dane firmy fikcyjnej</h2>
        <p className="adm-powod">
          Bez numerów NIP, REGON, KRS i BDO. E-maile tylko w domenie taktyl.example.
        </p>
        <div className="adm-siatka">
          {COMPANY_KEYS.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              disabled={off}
              error={getFieldError(errors, `company.${key}`)}
              {...register(`company.${key}` as const)}
            />
          ))}
        </div>
      </section>
    </TabShell>
  );
}
