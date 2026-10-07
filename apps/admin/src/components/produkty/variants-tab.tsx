"use client";
// B-103, B-104, B-108, B-111, B-113 (docs/15 par. 7.2, zakladka "Warianty i ceny"): tabela wariantow (SKU, kolor,
// przelacznik/rozmiar, cena, stan, status); wiersz otwiera okno edycji (Dialog z pulapka fokusu, fokus wraca na przycisk).
// Tworzenie wariantu, domyslny wariant (ostrzezenie, nie blokada).
import { zodResolver } from "@hookform/resolvers/zod";
import {
  colorIdSchema,
  padSizeKeySchema,
  switchIdSchema,
  variantCreateSchema,
  type AdminProductDetail,
} from "@taktyl/contracts";
import { parseZlotyInput, stockLevel } from "@taktyl/domain";
import { Alert, Badge, Button, Dialog, Field } from "@taktyl/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { catalogApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { applyServerErrors, plError } from "../../lib/forms";
import {
  COLOR_LABEL,
  formatPLN,
  formatCount,
  PAD_SIZE_LABEL,
  SWITCH_LABEL,
  VARIANT_COUNT,
} from "../../lib/format";
import { keys } from "../../lib/queries";
import { DataTable } from "../ui/data-table";
import { DisabledReason } from "../ui/disabled-reason";
import { VariantForm } from "./variant-form";

type Product = AdminProductDetail;
type Variant = Product["variants"][number];

const STOCK_LABEL = { brak: "Brak", ostatnie: "Ostatnie sztuki", dostepny: "Dostępny" } as const;

function optionLabel(v: Variant): string {
  if (v.switch) return SWITCH_LABEL[v.switch];
  if (v.size) return PAD_SIZE_LABEL[v.size];
  return "";
}

export function VariantsTab({ product }: { product: Product }) {
  const { session } = useAuth();
  const write = useCan(session?.user.role, "catalog.write");
  const [editSku, setEditSku] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();

  const columns = useMemo<ColumnDef<Variant, unknown>[]>(
    () =>
      [
        {
          id: "sku",
          header: "SKU",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: Variant } }) => row.original.sku,
        },
        {
          id: "color",
          header: "Kolor",
          cell: ({ row }: { row: { original: Variant } }) => COLOR_LABEL[row.original.color],
        },
        {
          id: "option",
          header: product.category === "podkladki" ? "Rozmiar" : "Przełącznik",
          cell: ({ row }: { row: { original: Variant } }) => optionLabel(row.original) || "-",
        },
        {
          id: "price",
          header: "Cena",
          meta: { numeric: true },
          cell: ({ row }: { row: { original: Variant } }) => (
            <span className="adm-liczba">{formatPLN(row.original.price_gr)}</span>
          ),
        },
        {
          id: "stock",
          header: "Stan",
          meta: { numeric: true },
          cell: ({ row }: { row: { original: Variant } }) => (
            <span className="adm-wiersz">
              <span className="adm-liczba">{row.original.stock}</span>
              {row.original.stock === 0 ? (
                <Badge variant="brak" />
              ) : row.original.stock <= 3 ? (
                <Badge variant="ostatnie-sztuki" />
              ) : null}
              <span className="tk-sr-only">{STOCK_LABEL[stockLevel(row.original.stock)]}</span>
            </span>
          ),
        },
        {
          id: "status",
          header: "Status",
          cell: ({ row }: { row: { original: Variant } }) =>
            row.original.status === "active" ? "Aktywny" : "Wyłączony",
        },
        {
          id: "akcje",
          header: "Akcje",
          cell: ({ row }: { row: { original: Variant } }) => (
            <Button
              variant="secondary"
              ref={(el) => {
                if (el) triggers.current.set(row.original.sku, el);
              }}
              aria-label={`${write.allowed ? "Edytuj" : "Zobacz"} wariant ${row.original.sku}`}
              onClick={() => setEditSku(row.original.sku)}
            >
              {write.allowed ? "Edytuj" : "Zobacz"}
            </Button>
          ),
        },
      ] as unknown as ColumnDef<Variant, unknown>[],
    [product.category, write.allowed],
  );

  const [defaultSku, setDefaultSku] = useState(product.default_variant_sku ?? "");
  const [defaultMsg, setDefaultMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => setDefaultSku(product.default_variant_sku ?? ""), [product.default_variant_sku]);

  const saveDefault = async () => {
    setDefaultMsg(null);
    try {
      const saved = await catalogApi.patch(product.id, product.version, {
        default_variant_sku: defaultSku,
      });
      qc.setQueryData(keys.product(product.id), saved);
      const w = saved.warnings.find((x) => x.code === "default_variant_out_of_stock");
      setDefaultMsg({
        text: `Zapisano. ${w ? w.message : "Sklep odświeży stronę w kilka sekund."}`,
        ok: !w,
      });
    } catch (e) {
      setDefaultMsg({ text: describeError(e, "ten produkt").text, ok: false });
    }
  };

  return (
    <div className="adm-stos">
      <div className="adm-wiersz">
        <p className="adm-licznik">{formatCount(product.variants.length, VARIANT_COUNT)}</p>
        <Button
          ref={addRef}
          variant="secondary"
          disabled={!write.allowed}
          aria-describedby={!write.allowed ? "powod-wariant-nowy" : undefined}
          onClick={() => setCreating(true)}
        >
          Dodaj wariant
        </Button>
        <DisabledReason id="powod-wariant-nowy" reason={write.reason} />
      </div>

      <DataTable
        caption="Warianty i ceny"
        columns={columns}
        data={product.variants}
        getRowId={(v) => v.sku}
      />

      <section className="adm-karta" aria-labelledby="domyslny">
        <h2 id="domyslny">Domyślny wariant</h2>
        <div className="adm-pole--wiersz">
          <Field
            as="select"
            label="Wariant pokazywany jako pierwszy"
            value={defaultSku}
            disabled={!write.allowed}
            onChange={(e) => setDefaultSku(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.sku} ({COLOR_LABEL[v.color]}, stan {v.stock})
              </option>
            ))}
          </Field>
          <div>
            <Button
              variant="secondary"
              disabled={!write.allowed || defaultSku === (product.default_variant_sku ?? "")}
              onClick={() => void saveDefault()}
            >
              Zapisz domyślny wariant
            </Button>
          </div>
        </div>
        {defaultMsg ? (
          <Alert variant={defaultMsg.ok ? "sukces" : "uwaga"}>{defaultMsg.text}</Alert>
        ) : null}
      </section>

      <Dialog
        open={editSku !== null}
        onClose={() => setEditSku(null)}
        title={editSku ? `Wariant ${editSku}` : "Wariant"}
        returnFocusRef={{
          get current() {
            return editSku ? (triggers.current.get(editSku) ?? null) : null;
          },
        }}
      >
        {editSku ? <VariantForm key={editSku} product={product} sku={editSku} /> : null}
      </Dialog>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Nowy wariant"
        returnFocusRef={addRef}
      >
        {creating ? (
          <VariantCreateForm product={product} onDone={() => setCreating(false)} />
        ) : null}
      </Dialog>
    </div>
  );
}

const createSchema = z.object({
  sku: variantCreateSchema.shape.sku,
  color: colorIdSchema,
  option: z.string(),
  price: z
    .string()
    .transform((s) => parseZlotyInput(s) ?? Number.NaN)
    .pipe(variantCreateSchema.shape.price_gr),
  stock: z
    .string()
    .transform((s) => (/^\s*\d+\s*$/.test(s) ? Number(s) : Number.NaN))
    .pipe(variantCreateSchema.shape.stock),
});
type CreateInput = z.input<typeof createSchema>;
type CreateOutput = z.output<typeof createSchema>;

/** B-111: nowy wariant. SKU wg wzoru docs/04 par. 3.1 (walidacja w kontrakcie), kolor i przelacznik lub rozmiar ze slownikow. */
export function VariantCreateForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const qc = useQueryClient();
  const isPad = product.category === "podkladki";
  const usesOption = product.options.includes("switch") || product.options.includes("size");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createSchema, {
      error: plError({
        sku: "SKU niezgodny ze wzorem, np. K-BZL75-GRF-PRG.",
        price: "Wpisz cenę w złotych, np. 749,00.",
        stock: "Wpisz całkowitą liczbę sztuk, np. 17.",
        color: "Wybierz kolor.",
      }),
    }),
    defaultValues: {
      sku: "",
      color: "grafit",
      option: usesOption ? (isPad ? "m" : "slizg") : "",
      price: "",
      stock: "0",
    },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "catalog.write");

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const detail = await catalogApi.createVariant(product.id, {
        sku: v.sku,
        color: v.color,
        ...(isPad
          ? { size: padSizeKeySchema.parse(v.option) }
          : usesOption
            ? { switch: switchIdSchema.parse(v.option) }
            : {}),
        price_gr: v.price,
        stock: v.stock,
        images_key: v.color,
      });
      qc.setQueryData(keys.product(product.id), detail);
      void qc.invalidateQueries({ queryKey: keys.productsAll });
      onDone();
    } catch (e) {
      const map = (p: string) =>
        p === "sku"
          ? ("sku" as const)
          : p === "price_gr"
            ? ("price" as const)
            : p === "stock"
              ? ("stock" as const)
              : null;
      if (applyServerErrors(e, setError, map) > 0) return;
      setFormError(describeError(e, "ten produkt").text);
    }
  });

  return (
    <form className="adm-formularz" onSubmit={onSubmit} noValidate aria-label="Nowy wariant">
      {formError ? <Alert variant="blad">{formError}</Alert> : null}
      <div className="adm-siatka">
        <Field
          label="SKU"
          hint="Wzór z docs/04, np. K-BZL75-GRF-PRG."
          disabled={!allowed}
          error={errors.sku?.message}
          {...register("sku")}
        />
        <Field
          as="select"
          label="Kolor"
          disabled={!allowed}
          error={errors.color?.message}
          {...register("color")}
        >
          {colorIdSchema.options.map((c) => (
            <option key={c} value={c}>
              {COLOR_LABEL[c]}
            </option>
          ))}
        </Field>
        {usesOption ? (
          <Field
            as="select"
            label={isPad ? "Rozmiar" : "Przełącznik"}
            disabled={!allowed}
            {...register("option")}
          >
            {(isPad ? padSizeKeySchema.options : switchIdSchema.options).map((o) => (
              <option key={o} value={o}>
                {isPad
                  ? PAD_SIZE_LABEL[o as keyof typeof PAD_SIZE_LABEL]
                  : SWITCH_LABEL[o as keyof typeof SWITCH_LABEL]}
              </option>
            ))}
          </Field>
        ) : null}
        <Field
          label="Cena (zł)"
          inputMode="decimal"
          disabled={!allowed}
          error={errors.price?.message}
          {...register("price")}
        />
        <Field
          label="Stan (szt.)"
          inputMode="numeric"
          disabled={!allowed}
          error={errors.stock?.message}
          {...register("stock")}
        />
      </div>
      <div className="adm-akcje">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!allowed}
          aria-describedby={!allowed ? "powod-nowy-wariant" : undefined}
        >
          Dodaj wariant
        </Button>
        <DisabledReason id="powod-nowy-wariant" reason={reason} />
      </div>
    </form>
  );
}
