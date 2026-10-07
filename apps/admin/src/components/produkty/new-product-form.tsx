"use client";
// B-111 (docs/15 par. 7.1, P1): dodawanie produktu. Formularz wymusza komplet atrybutow dla kategorii (schemat kategorii z
// @taktyl/contracts). Nowy produkt bez wariantow zostaje ukryty (archived) do czasu dodania pierwszego wariantu (API-011).
import { zodResolver } from "@hookform/resolvers/zod";
import { categoryIdSchema, type CategoryId } from "@taktyl/contracts";
import { Alert, Button, Field, useToast } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { catalogApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { applyServerErrors, plError } from "../../lib/forms";
import { CATEGORY_LABEL } from "../../lib/format";
import {
  FIT_KEYS,
  FIT_LABEL,
  PAD_SIZE_KEYS,
  PRODUCT_MESSAGES,
  productNewSchema,
} from "../../lib/product-form";
import { keys } from "../../lib/queries";
import { DisabledReason } from "../ui/disabled-reason";
import { PageHeader } from "../ui/page-header";
import { AttributesFields } from "./attributes-fields";

type FormInput = z.input<ReturnType<typeof productNewSchema>>;
type FormOutput = z.output<ReturnType<typeof productNewSchema>>;

const OPTION_LABEL = { color: "Kolor", switch: "Przełącznik", size: "Rozmiar" } as const;

function emptyAttributes(category: CategoryId, sizes: readonly string[]): Record<string, unknown> {
  if (category === "klawiatury")
    return { connectivity: [], hotswap: false, knob: false, dims_mm: {} };
  if (category === "myszki")
    return { grips: [], connectivity: [], dims_mm: {}, hand: "prawa", size: "M", hand_cm: [] };
  return {
    sizes: Object.fromEntries(sizes.map((k) => [k, { type: "mysz" }])),
  };
}

function Form({ category, sizes }: { category: CategoryId; sizes: readonly string[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "catalog.write");
  const schema = useMemo(() => productNewSchema(category), [category]);
  const methods = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema, { error: plError(PRODUCT_MESSAGES) }),
    shouldUnregister: true,
    defaultValues: {
      id: "",
      slug: "",
      category,
      name: "",
      short: "",
      options: [],
      badges: [],
      fit: { fps: 0, gry: 0, programowanie: 0, biuro: 0, cisza: 0 },
      in_box: "",
      gpsr: { manufacturer: "", address: "", contact: "", warnings: "" },
      attributes: emptyAttributes(category, sizes) as FormInput["attributes"],
    },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = methods;
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const created = await catalogApi.create(values as never);
      qc.setQueryData(keys.product(created.id), created);
      void qc.invalidateQueries({ queryKey: keys.productsAll });
      toast.toast({
        message: "Dodano produkt. Pozostaje ukryty do czasu dodania pierwszego wariantu.",
      });
      router.push(`/produkty/${created.id}?zakladka=warianty`);
    } catch (e) {
      if (applyServerErrors(e, setError as never) > 0) return;
      setFormError(describeError(e, "ten produkt").text);
    }
  });

  return (
    <FormProvider {...methods}>
      <form className="adm-formularz" onSubmit={onSubmit} noValidate aria-label="Nowy produkt">
        {formError ? (
          <div ref={alertRef} tabIndex={-1}>
            <Alert variant="blad">{formError}</Alert>
          </div>
        ) : null}
        <input type="hidden" {...register("category")} />
        <section className="adm-karta">
          <h2>Podstawowe</h2>
          <div className="adm-siatka">
            <Field
              label="Identyfikator"
              hint="Np. k-bazalt-75; zaczyna się od k-, m- albo p-."
              disabled={!allowed}
              error={errors.id?.message}
              {...register("id")}
            />
            <Field
              label="Adres (slug)"
              disabled={!allowed}
              error={errors.slug?.message}
              {...register("slug")}
            />
            <Field
              label="Nazwa"
              disabled={!allowed}
              error={errors.name?.message}
              {...register("name")}
            />
          </div>
          <Field
            as="textarea"
            label="Krótki opis (short)"
            rows={3}
            disabled={!allowed}
            error={errors.short?.message}
            {...register("short")}
          />
          <fieldset aria-describedby={errors.options ? "opcje-blad" : undefined}>
            <legend className="tk-pole__etykieta">Opcje wariantu</legend>
            {(["color", "switch", "size"] as const).map((o) => (
              <label key={o} className="adm-radio">
                <input type="checkbox" value={o} disabled={!allowed} {...register("options")} />
                <span>{OPTION_LABEL[o]}</span>
              </label>
            ))}
            {errors.options ? (
              <p id="opcje-blad" className="tk-pole__blad">
                {errors.options.message}
              </p>
            ) : null}
          </fieldset>
        </section>
        <section className="adm-karta">
          <h2>Atrybuty</h2>
          <AttributesFields category={category} disabled={!allowed} padSizes={sizes} />
        </section>
        <section className="adm-karta">
          <h2>Dopasowanie do profilu (0 do 3)</h2>
          <div className="adm-siatka">
            {FIT_KEYS.map((k) => (
              <Field
                key={k}
                label={FIT_LABEL[k]}
                type="number"
                min={0}
                max={3}
                disabled={!allowed}
                error={errors.fit?.[k]?.message}
                {...register(`fit.${k}`, { valueAsNumber: true })}
              />
            ))}
          </div>
        </section>
        <section className="adm-karta">
          <h2>Zawartość zestawu i dane GPSR</h2>
          <Field
            as="textarea"
            label="Zawartość zestawu"
            hint="Jedna pozycja w wierszu."
            rows={3}
            disabled={!allowed}
            error={errors.in_box?.message}
            {...register("in_box")}
          />
          <div className="adm-siatka">
            <Field
              label="Producent"
              disabled={!allowed}
              error={errors.gpsr?.manufacturer?.message}
              {...register("gpsr.manufacturer")}
            />
            <Field
              label="Adres producenta"
              disabled={!allowed}
              error={errors.gpsr?.address?.message}
              {...register("gpsr.address")}
            />
            <Field
              label="Kontakt (e-mail)"
              hint="Adres w domenie taktyl.example."
              disabled={!allowed}
              error={errors.gpsr?.contact?.message}
              {...register("gpsr.contact")}
            />
            <Field
              label="Ostrzeżenia"
              disabled={!allowed}
              error={errors.gpsr?.warnings?.message}
              {...register("gpsr.warnings")}
            />
          </div>
        </section>
        <div className="adm-akcje">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!allowed}
            aria-describedby={!allowed ? "powod-nowy" : undefined}
          >
            Dodaj produkt
          </Button>
          <DisabledReason id="powod-nowy" reason={reason} />
        </div>
      </form>
    </FormProvider>
  );
}

export function NewProduct() {
  const [category, setCategory] = useState<CategoryId>("klawiatury");
  const [sizes, setSizes] = useState<string[]>(["m"]);
  return (
    <div className="adm-strona">
      <PageHeader title="Nowy produkt" />
      <div className="adm-karta adm-stos">
        <Field
          as="select"
          label="Kategoria"
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId)}
        >
          {categoryIdSchema.options.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Field>
        {category === "podkladki" ? (
          <fieldset>
            <legend className="tk-pole__etykieta">Rozmiary podkładki</legend>
            {PAD_SIZE_KEYS.map((k) => (
              <label key={k} className="adm-radio">
                <input
                  type="checkbox"
                  checked={sizes.includes(k)}
                  onChange={(e) =>
                    setSizes((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))
                  }
                />
                <span>{k.toUpperCase()}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>
      <Form
        key={`${category}:${sizes.join(",")}`}
        category={category}
        sizes={category === "podkladki" ? sizes : []}
      />
    </div>
  );
}
