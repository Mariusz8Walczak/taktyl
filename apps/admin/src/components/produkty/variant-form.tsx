"use client";
// B-103, B-104, B-105, B-106, B-107, B-108, B-113 (docs/15 par. 7.2): edycja wariantu - cena w zlotych (zapis w groszach),
// podglad skutku Omnibus przed zapisem, "najnizsza z 30 dni" TYLKO do odczytu z API i historia cen, stan z powodem korekty.
// Wersje (If-Match): 412 = "Ktos zmienil ten produkt" + "Wczytaj zmiany". Brak pola recznego lowest_30d (ADR-0005).
import { zodResolver } from "@hookform/resolvers/zod";
import {
  setPriceRequestSchema,
  setStockRequestSchema,
  variantPatchSchema,
  type AdminProductDetail,
} from "@taktyl/contracts";
import {
  formatZlotyInput,
  parseZlotyInput,
  previewPriceChange,
  promotionPercent,
  stockLevel,
  type PriceRow,
} from "@taktyl/domain";
import { Alert, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../lib/api/client";
import { catalogApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { applyServerErrors, plError } from "../../lib/forms";
import { formatDateTime, formatPLN, shopProductUrl } from "../../lib/format";
import { keys, usePriceHistory } from "../../lib/queries";
import { DisabledReason } from "../ui/disabled-reason";

type Variant = AdminProductDetail["variants"][number];

const PRICE_MSG = "Wpisz cenę w złotych, np. 749,00.";
const STOCK_MSG = "Wpisz całkowitą liczbę sztuk, np. 17.";

const priceText = z
  .string()
  .transform((s) => parseZlotyInput(s) ?? Number.NaN)
  .pipe(setPriceRequestSchema.shape.price_gr);
const regularText = z
  .string()
  .transform((s) => (s.trim() === "" ? null : (parseZlotyInput(s) ?? Number.NaN)))
  .pipe(setPriceRequestSchema.shape.regular_price_gr.unwrap());
const stockText = z
  .string()
  .transform((s) => (/^\s*\d+\s*$/.test(s) ? Number(s) : Number.NaN))
  .pipe(setStockRequestSchema.shape.stock);

/** Schemat formularza wariantu zlozony z pol kontraktu (ceny i stanu) - ten sam, co waliduje API. */
export const variantFormSchema = z.object({
  price: priceText,
  priceReason: z.string().max(200),
  regular: regularText,
  stock: stockText,
  stockReason: z.string().trim().max(200),
  status: variantPatchSchema.shape.status.unwrap(),
});
type FormInput = z.input<typeof variantFormSchema>;
type FormOutput = z.output<typeof variantFormSchema>;

const MESSAGES = {
  price: PRICE_MSG,
  regular: PRICE_MSG,
  stock: STOCK_MSG,
  priceReason: "Powód zmiany ceny może mieć najwyżej 200 znaków.",
  stockReason: "Podaj powód korekty stanu (do 200 znaków).",
};

function defaultsOf(v: Variant): FormInput {
  return {
    price: formatZlotyInput(v.price_gr),
    priceReason: "",
    regular: v.regular_price_gr === null ? "" : formatZlotyInput(v.regular_price_gr),
    stock: String(v.stock),
    stockReason: "",
    status: v.status,
  };
}

export function variantLabel(v: Variant): string {
  return [v.color, v.switch, v.size].filter(Boolean).join(" / ");
}

export interface VariantFormProps {
  product: AdminProductDetail;
  sku: string;
  /** Wywolywane po zapisie z aktualnym obiektem produktu z API. */
  onSaved?: (p: AdminProductDetail) => void;
  now?: () => Date;
}

export function VariantForm({ product, sku, onSaved, now = () => new Date() }: VariantFormProps) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "catalog.write");
  const variant = product.variants.find((v) => v.sku === sku);
  const history = usePriceHistory(sku);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(variantFormSchema, { error: plError(MESSAGES) }),
    defaultValues: variant ? defaultsOf(variant) : undefined,
  });

  const [formError, setFormError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [saved, setSaved] = useState<AdminProductDetail | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const rows: PriceRow[] = useMemo(
    () =>
      (history.data?.entries ?? []).map((e) => ({
        priceGr: e.price_gr,
        validFrom: new Date(e.valid_from),
        validTo: e.valid_to ? new Date(e.valid_to) : null,
      })),
    [history.data],
  );

  const priceInput = watch("price");
  const stockInput = watch("stock");
  const newPriceGr = parseZlotyInput(priceInput ?? "");
  const stockNumber = /^\s*\d+\s*$/.test(stockInput ?? "") ? Number(stockInput) : null;

  // B-106: podglad skutku Omnibus tylko gdy nowa cena jest nizsza od obecnej.
  const preview = useMemo(() => {
    if (
      !variant ||
      newPriceGr === null ||
      newPriceGr < 1 ||
      newPriceGr >= variant.price_gr ||
      rows.length === 0
    )
      return null;
    const p = previewPriceChange(rows, newPriceGr, now());
    return p.lowest30dGr !== null ? p : null;
  }, [variant, newPriceGr, rows, now]);

  if (!variant) return <Alert variant="blad">Nie znaleziono wariantu {sku}.</Alert>;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(null);
    let current = variant;
    let detail: AdminProductDetail | null = null;
    let phase: "price" | "stock" | "status" = "price";
    const priceChanged = values.price !== current.price_gr;
    const regularChanged = values.regular !== current.regular_price_gr;
    const stockChanged = values.stock !== current.stock;
    if (stockChanged && values.stockReason === "") {
      setError(
        "stockReason",
        { type: "custom", message: MESSAGES.stockReason },
        { shouldFocus: true },
      );
      return;
    }
    const pick = (d: AdminProductDetail): Variant =>
      d.variants.find((v) => v.sku === sku) ?? current;
    try {
      if (priceChanged || regularChanged) {
        detail = await catalogApi.setPrice(
          sku,
          {
            price_gr: values.price,
            ...(regularChanged ? { regular_price_gr: values.regular } : {}),
            ...(values.priceReason.trim() ? { reason: values.priceReason.trim() } : {}),
          },
          current.version,
        );
        current = pick(detail);
      }
      phase = "stock";
      if (stockChanged) {
        detail = await catalogApi.setStock(
          sku,
          { stock: values.stock, reason: values.stockReason },
          current.version,
        );
        current = pick(detail);
      }
      phase = "status";
      if (values.status !== current.status) {
        detail = await catalogApi.patchVariant(sku, current.version, { status: values.status });
        current = pick(detail);
      }
    } catch (e) {
      if (detail) qc.setQueryData(keys.product(product.id), detail);
      const map = (p: string) => {
        if (p === "price_gr") return "price" as const;
        if (p === "regular_price_gr") return "regular" as const;
        if (p === "stock") return "stock" as const;
        if (p === "reason")
          return phase === "price" ? ("priceReason" as const) : ("stockReason" as const);
        return null;
      };
      if (e instanceof ApiError && e.status === 422 && applyServerErrors(e, setError, map) > 0)
        return;
      setFormError(describeError(e, "ten produkt"));
      return;
    }
    if (!detail) {
      setFormError({ text: "Brak zmian do zapisania.", conflict: false });
      return;
    }
    qc.setQueryData(keys.product(product.id), detail);
    void qc.invalidateQueries({ queryKey: keys.productsAll });
    void qc.invalidateQueries({ queryKey: keys.priceHistory(sku) });
    reset(defaultsOf(current));
    setSaved(detail);
    onSaved?.(detail);
  });

  const reload = async () => {
    const fresh = await catalogApi.get(product.id);
    qc.setQueryData(keys.product(product.id), fresh);
    const v = fresh.variants.find((x) => x.sku === sku);
    if (v) reset(defaultsOf(v));
    setFormError(null);
  };

  const disabled = !allowed;
  const level = stockNumber === null ? null : stockLevel(stockNumber);
  const levelText = { brak: "Brak", ostatnie: "Ostatnie sztuki", dostepny: "Dostępny" } as const;
  const lowest = history.data?.lowest_30d_gr ?? null;
  const percent = promotionPercent(lowest, variant.price_gr);

  return (
    <form className="adm-formularz" onSubmit={onSubmit} noValidate aria-label={`Wariant ${sku}`}>
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
      {saved ? (
        <Alert variant="sukces">
          Zapisano. Sklep odświeży stronę w kilka sekund.{" "}
          <a
            className="tk-link"
            href={shopProductUrl(product.category, saved.slug)}
            target="_blank"
            rel="noreferrer"
          >
            Zobacz w sklepie
          </a>
          {saved.warnings.map((w) => (
            <span key={w.code} className="adm-stos">
              {w.message}
            </span>
          ))}
        </Alert>
      ) : null}

      <section className="adm-stos" aria-labelledby="wariant-cena">
        <h3 id="wariant-cena">Cena</h3>
        <div className="adm-siatka">
          <Field
            label="Nowa cena (zł)"
            hint="Z przecinkiem, np. 749,00. API zapisuje grosze i dopisuje wiersz do historii cen."
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            error={errors.price?.message}
            {...register("price")}
          />
          <Field
            label="Powód zmiany ceny (opcjonalnie)"
            disabled={disabled}
            error={errors.priceReason?.message}
            {...register("priceReason")}
          />
          <Field
            label="Cena regularna (zł)"
            hint="Tylko do użytku wewnętrznego. Nie jest pokazywana klientom."
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            error={errors.regular?.message}
            {...register("regular")}
          />
        </div>
        {preview ? (
          <p className="adm-ostrzezenie-omnibus" role="status">
            Obniżka pokaże przekreśloną najniższą cenę z 30 dni:{" "}
            {formatPLN(preview.lowest30dGr as number)}. Plakietka: −{preview.percent}%. Klient
            zobaczy: „Najniższa cena z 30 dni przed obniżką:{" "}
            {formatPLN(preview.lowest30dGr as number)}”.
          </p>
        ) : null}
        <dl className="adm-dl">
          <dt>Aktualna cena</dt>
          <dd className="adm-tylko-odczyt">{formatPLN(variant.price_gr)}</dd>
          <dt>Najniższa z 30 dni</dt>
          <dd className="adm-tylko-odczyt" data-testid="lowest-30d">
            {history.isPending
              ? "Wczytywanie"
              : lowest === null
                ? "Brak (wariant nie jest w promocji)"
                : `${formatPLN(lowest)}${percent !== null ? `, plakietka −${percent}%` : ""}`}
          </dd>
        </dl>
        <p className="adm-powod">
          Liczone z historii cen z ostatnich 30 dni. Nie wpisujesz tego ręcznie.
        </p>
      </section>

      <section className="adm-stos" aria-labelledby="wariant-stan">
        <h3 id="wariant-stan">Stan magazynowy</h3>
        <div className="adm-siatka">
          <Field
            label="Stan (szt.)"
            hint={level ? `Etykieta w sklepie: ${levelText[level]}.` : undefined}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            error={errors.stock?.message}
            {...register("stock")}
          />
          <Field
            label="Powód korekty"
            hint="Wymagany przy zmianie stanu."
            disabled={disabled}
            error={errors.stockReason?.message}
            {...register("stockReason")}
          />
          <Field
            as="select"
            label="Dostępność wariantu"
            disabled={disabled}
            error={errors.status?.message}
            {...register("status")}
          >
            <option value="active">Aktywny</option>
            <option value="disabled">Wyłączony</option>
          </Field>
        </div>
      </section>

      <section className="adm-stos" aria-labelledby="wariant-historia">
        <h3 id="wariant-historia">Historia cen</h3>
        {history.isError ? (
          <Alert variant="uwaga">Nie udało się pobrać historii cen.</Alert>
        ) : history.data && history.data.entries.length > 0 ? (
          <div
            className="adm-tabela-okno"
            role="region"
            aria-label="Historia cen (ostatnie wpisy)"
            tabIndex={0}
          >
            <table className="adm-tabela">
              <caption className="tk-sr-only">Historia cen wariantu {sku}</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className="adm-liczba">
                    Cena
                  </th>
                  <th scope="col">Zmienił</th>
                </tr>
              </thead>
              <tbody>
                {/* B-105: API zwraca wpisy od najnowszego (TAKTYL-82) */}
                {history.data.entries
                  .slice(0, 5)
                  .map((e) => (
                    <tr key={e.valid_from}>
                      <td>{formatDateTime(e.valid_from)}</td>
                      <td className="adm-liczba">{formatPLN(e.price_gr)}</td>
                      <td>{e.changed_by ?? "seed"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Link
          className="tk-link"
          href={`/produkty/${product.id}/ceny?sku=${encodeURIComponent(sku)}`}
        >
          Historia cen (pełna)
        </Link>
      </section>

      <div className="adm-akcje">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={disabled}
          aria-describedby={disabled ? `powod-${sku}` : undefined}
        >
          Zapisz wariant
        </Button>
        <DisabledReason id={`powod-${sku}`} reason={reason} />
      </div>
    </form>
  );
}
