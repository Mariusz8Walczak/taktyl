"use client";
// B-102, B-109, B-110, B-113 (docs/15 par. 7.2, zakladka "Dane"): nazwa, slug, short, plakietki reczne, fit, in_box, GPSR,
// atrybuty wg kategorii. Schemat z @taktyl/contracts; blad pod polem, fokus na pierwszy blad, 412 z "Wczytaj zmiany".
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminProductDetail } from "@taktyl/contracts";
import { Alert, Badge, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError } from "../../lib/api/client";
import { catalogApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { applyServerErrors, plError } from "../../lib/forms";
import { shopProductUrl } from "../../lib/format";
import { FIT_KEYS, FIT_LABEL, PRODUCT_MESSAGES, productEditSchema } from "../../lib/product-form";
import { keys } from "../../lib/queries";
import { DisabledReason } from "../ui/disabled-reason";
import { SaveBar } from "../ui/save-bar";
import { AttributesFields } from "./attributes-fields";

type FormInput = z.input<ReturnType<typeof productEditSchema>>;
type FormOutput = z.output<ReturnType<typeof productEditSchema>>;

function defaultsOf(p: AdminProductDetail): FormInput {
  return {
    name: p.name,
    slug: p.slug,
    short: p.short,
    badges: p.badges,
    fit: p.fit,
    in_box: p.in_box.join("\n"),
    gpsr: p.gpsr,
    status: p.status,
    attributes: JSON.parse(JSON.stringify(p.attributes)) as FormInput["attributes"],
  };
}

export function ProductDataForm({
  product,
  onSaved,
}: {
  product: AdminProductDetail;
  onSaved?: (p: AdminProductDetail) => void;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "catalog.write");
  const schema = useMemo(() => productEditSchema(product.category), [product.category]);

  const methods = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema, { error: plError(PRODUCT_MESSAGES) }),
    defaultValues: defaultsOf(product),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = methods;

  const [formError, setFormError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [warnings, setWarnings] = useState<AdminProductDetail["warnings"]>([]);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const padSizes = useMemo(
    () => (product.category === "podkladki" ? Object.keys(product.attributes.sizes) : []),
    [product],
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const dirtyKeys = Object.keys(dirtyFields) as (keyof FormOutput)[];
    if (dirtyKeys.length === 0) return;
    const body: Record<string, unknown> = {};
    for (const k of dirtyKeys) body[k] = values[k];
    try {
      const saved = await catalogApi.patch(product.id, product.version, body as never);
      qc.setQueryData(keys.product(product.id), saved);
      void qc.invalidateQueries({ queryKey: keys.productsAll });
      reset(defaultsOf(saved));
      setWarnings(saved.warnings);
      setSavedAt(new Date());
      onSaved?.(saved);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(
          "slug",
          { type: "server", message: "Ten adres jest już używany. Wybierz inny." },
          { shouldFocus: true },
        );
        return;
      }
      if (applyServerErrors(e, setError as never) > 0) return;
      setFormError(describeError(e, "ten produkt"));
    }
  });

  const reload = async () => {
    const fresh = await catalogApi.get(product.id);
    qc.setQueryData(keys.product(product.id), fresh);
    reset(defaultsOf(fresh));
    setFormError(null);
  };

  const disabled = !allowed;

  return (
    <FormProvider {...methods}>
      <form className="adm-formularz" onSubmit={onSubmit} noValidate aria-label="Dane produktu">
        <SaveBar
          dirty={isDirty}
          savedAt={savedAt}
          shopUrl={shopProductUrl(product.category, product.slug)}
        />
        {formError ? (
          <div ref={alertRef} tabIndex={-1}>
            <Alert variant="blad">
              {formError.text}{" "}
              {formError.conflict ? (
                <Button variant="secondary" onClick={() => void reload()}>
                  Wczytaj zmiany
                </Button>
              ) : null}
            </Alert>
          </div>
        ) : null}
        {warnings.map((w) => (
          <Alert key={w.code} variant="uwaga">
            {w.message}
          </Alert>
        ))}

        <section className="adm-karta" aria-labelledby="sek-podstawy">
          <h2 id="sek-podstawy">Podstawowe</h2>
          <div className="adm-siatka">
            <Field
              label="Nazwa"
              disabled={disabled}
              error={errors.name?.message}
              {...register("name")}
            />
            <Field
              label="Adres (slug)"
              hint="Małe litery, cyfry i łączniki. Zmiana adresu odświeża też stary adres w sklepie."
              disabled={disabled}
              error={errors.slug?.message}
              {...register("slug")}
            />
            <Field
              as="select"
              label="Status"
              hint="Ukryty produkt znika z listingu, wyszukiwarki i gotowych setów, a adres karty daje 404."
              disabled={disabled}
              error={errors.status?.message}
              {...register("status")}
            >
              <option value="active">Aktywny</option>
              <option value="archived">Ukryty (archiwum)</option>
            </Field>
          </div>
          <Field
            as="textarea"
            label="Krótki opis (short)"
            rows={3}
            disabled={disabled}
            error={errors.short?.message}
            {...register("short")}
          />
        </section>

        <section className="adm-karta" aria-labelledby="sek-plakietki">
          <h2 id="sek-plakietki">Plakietki</h2>
          <fieldset>
            <legend className="tk-pole__etykieta">Ręczne (maksymalnie dwie)</legend>
            <label className="adm-radio">
              <input type="checkbox" value="nowosc" disabled={disabled} {...register("badges")} />
              <span>Nowość</span>
            </label>
            <label className="adm-radio">
              <input
                type="checkbox"
                value="bestseller"
                disabled={disabled}
                {...register("badges")}
              />
              <span>Bestseller</span>
            </label>
          </fieldset>
          <p className="adm-powod">
            Plakietki wyliczane tylko do odczytu: <Badge variant="promocja" />{" "}
            <Badge variant="ostatnie-sztuki" /> <Badge variant="brak" />. Pojawiają się same, gdy
            dane na to pozwalają (obniżka, stan do 3 szt., stan 0).
          </p>
        </section>

        <section className="adm-karta" aria-labelledby="sek-atrybuty">
          <h2 id="sek-atrybuty">Atrybuty</h2>
          <AttributesFields category={product.category} disabled={disabled} padSizes={padSizes} />
        </section>

        <section className="adm-karta" aria-labelledby="sek-fit">
          <h2 id="sek-fit">Dopasowanie do profilu (0 do 3)</h2>
          <div className="adm-siatka">
            {FIT_KEYS.map((k) => (
              <Field
                key={k}
                label={FIT_LABEL[k]}
                type="number"
                min={0}
                max={3}
                inputMode="numeric"
                disabled={disabled}
                error={errors.fit?.[k]?.message}
                {...register(`fit.${k}`, { valueAsNumber: true })}
              />
            ))}
          </div>
        </section>

        <section className="adm-karta" aria-labelledby="sek-zestaw">
          <h2 id="sek-zestaw">Zawartość zestawu i dane GPSR</h2>
          <Field
            as="textarea"
            label="Zawartość zestawu"
            hint="Jedna pozycja w wierszu."
            rows={4}
            disabled={disabled}
            error={errors.in_box?.message}
            {...register("in_box")}
          />
          <div className="adm-siatka">
            <Field
              label="Producent"
              disabled={disabled}
              error={errors.gpsr?.manufacturer?.message}
              {...register("gpsr.manufacturer")}
            />
            <Field
              label="Adres producenta"
              disabled={disabled}
              error={errors.gpsr?.address?.message}
              {...register("gpsr.address")}
            />
            <Field
              label="Kontakt (e-mail)"
              hint="Adres w domenie taktyl.example."
              disabled={disabled}
              error={errors.gpsr?.contact?.message}
              {...register("gpsr.contact")}
            />
            <Field
              label="Ostrzeżenia"
              disabled={disabled}
              error={errors.gpsr?.warnings?.message}
              {...register("gpsr.warnings")}
            />
          </div>
        </section>

        <div className="adm-akcje">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={disabled}
            aria-describedby={disabled ? "powod-zapisu" : undefined}
          >
            Zapisz
          </Button>
          <DisabledReason id="powod-zapisu" reason={reason} />
        </div>
      </form>
    </FormProvider>
  );
}
