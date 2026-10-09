"use client";
// B-302, B-303, B-310 (docs/15 par. 9): opinie demonstracyjne. Lista produktow z liczba i srednia opinii, edycja zestawu
// 3-6 opinii (autor imie + inicjal, data do 6 miesiecy wstecz, ocena 3-5, wariant, tekst 1-4 zdania). Flaga demo zawsze true
// i bez kontrolki; etykieta "Opinie przykladowe - sklep demonstracyjny" jest stala i widoczna w podgladzie.
// PUT zastepuje zestaw (API nie ma wersji opinii). Znaczniki po zapisie: reviews:{slug}, product:{slug}.
import { zodResolver } from "@hookform/resolvers/zod";
import { reviewsPutSchema, type AdminProductReviews } from "@taktyl/contracts";
import { Alert, Button, Field, useToast } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { applyServerErrors, plError } from "../../lib/forms";
import { reviewsApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { REVIEW_COUNT, REVIEWS_PREVIEW_LABEL } from "../../lib/content-labels";
import {
  colorLabel,
  formatCount,
  PRODUCT_COUNT,
  shopProductUrl,
  SITE_URL,
  SWITCH_LABEL,
} from "../../lib/format";
import { keys, useProduct, useReviews } from "../../lib/queries";
import { issuesOf } from "../../lib/server-issues";
import { DataTable } from "../ui/data-table";
import { DisabledReason } from "../ui/disabled-reason";
import { IssueList, type Issue } from "../ui/issue-list";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { SaveBar } from "../ui/save-bar";
import { ShopNote } from "../ui/shop-note";

const avgFmt = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** B-303: "4,6 · 5 opinii" (srednia z 1 miejscem po przecinku i liczba, liczebnik przez Intl.PluralRules). */
export function reviewSummary(avg: number | null, count: number): string {
  if (count === 0 || avg === null) return "Brak opinii";
  return `${avgFmt.format(avg)} · ${formatCount(count, REVIEW_COUNT)}`;
}

// ---------------------------------------------------------------- lista

type Group = AdminProductReviews;

export function ReviewsList() {
  const query = useReviews();
  const columns = useMemo<ColumnDef<Group, unknown>[]>(
    () =>
      [
        {
          id: "name",
          header: "Produkt",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: Group } }) => (
            <Link className="tk-link" href={`/tresci/opinie/${row.original.product_id}`}>
              {row.original.name}
            </Link>
          ),
        },
        {
          id: "summary",
          header: "Średnia i liczba",
          cell: ({ row }: { row: { original: Group } }) =>
            reviewSummary(row.original.avg, row.original.count),
        },
      ] as unknown as ColumnDef<Group, unknown>[],
    [],
  );
  return (
    <div className="adm-strona">
      <QueryBoundary query={query} errorText="Nie udało się pobrać opinii.">
        {(data) => (
          <>
            <PageHeader
              title="Opinie przykładowe"
              count={formatCount(data.items.length, PRODUCT_COUNT)}
            />
            <nav aria-label="Okruszki">
              <Link className="tk-link" href="/tresci">
                Wróć do treści
              </Link>
            </nav>
            <p className="adm-powod">Etykieta w sklepie: {data.label}. Nie można jej wyłączyć.</p>
            {data.items.length === 0 ? (
              <p>Nie ma jeszcze opinii.</p>
            ) : (
              <DataTable
                caption="Opinie przykładowe według produktów"
                columns={columns}
                data={data.items}
                getRowId={(r) => r.product_id}
              />
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

// ---------------------------------------------------------------- edycja

const element = reviewsPutSchema.shape.items.element;
const schema = z.object({
  items: z
    .array(
      z.object({
        author: element.shape.author,
        date: element.shape.date,
        rating: element.shape.rating,
        variant_label: element.shape.variant_label,
        text: element.shape.text,
      }),
    )
    .min(3)
    .max(6),
});
type FormValues = z.input<typeof schema>;

const MESSAGES: Record<string, string> = {
  "items.*.author": "Wpisz imię i inicjał, np. „Ola K.”.",
  "items.*.date": "Wpisz datę opinii.",
  "items.*.rating": "Wybierz ocenę od 3 do 5.",
  "items.*.variant_label": "Wpisz wariant, którego dotyczy opinia.",
  "items.*.text": "Wpisz tekst opinii.",
  items: "Zestaw ma od 3 do 6 opinii.",
};

function ReviewsForm({ group, variantLabels }: { group: Group; variantLabels: string[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "content.write");
  const toValues = (g: Group): FormValues => ({
    items: g.items.map((i) => ({
      author: i.author,
      date: i.date,
      rating: i.rating,
      variant_label: i.variant_label,
      text: i.text,
    })),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema, { error: plError(MESSAGES) }),
    defaultValues: toValues(group),
  });
  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: "items",
    keyName: "key",
  });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const items = watch("items");

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setIssues([]);
    setSaving(true);
    try {
      const saved = await reviewsApi.put(group.product_id, {
        items: v.items.map((i) => ({ ...i, demo: true as const })),
      });
      qc.setQueryData(keys.reviews, (old: { label: string; items: Group[] } | undefined) =>
        old
          ? { ...old, items: old.items.map((g) => (g.product_id === saved.product_id ? saved : g)) }
          : old,
      );
      reset(toValues(saved));
      setSavedAt(new Date());
    } catch (e) {
      const mapped = applyServerErrors(
        e,
        setError as never,
        (p) =>
          (/^items\[(\d+)\]\.(\w+)$/.test(p)
            ? p.replace(/^items\[(\d+)\]\.(\w+)$/, "items.$1.$2")
            : null) as FieldPath<FormValues> | null,
      );
      if (mapped === 0) {
        const found = issuesOf(e);
        if (found.length > 0) setIssues(found);
        else setFormError(describeError(e, "opinie tego produktu").text);
      }
    } finally {
      setSaving(false);
    }
  });

  const removeAt = (index: number) => {
    const row = items[index];
    if (!row) return;
    remove(index);
    toast({
      message: "Usunięto opinię. Zapisz zestaw, aby zmiana trafiła do sklepu.",
      actionLabel: "Cofnij",
      onAction: () => insert(index, row),
    });
  };

  const disabled = !allowed;
  const count = items.length;
  const sum = items.reduce((s, i) => s + (Number(i.rating) || 0), 0);
  return (
    <form
      className="adm-formularz"
      noValidate
      onSubmit={onSubmit}
      aria-label="Opinie przykładowe produktu"
    >
      <SaveBar dirty={isDirty} savedAt={savedAt} />
      {formError ? <Alert variant="blad">{formError}</Alert> : null}
      <IssueList variant="blad" title="Popraw opinie przed zapisem" issues={issues} />
      {errors.items?.message || errors.items?.root?.message ? (
        <Alert variant="blad">{errors.items?.message ?? errors.items?.root?.message}</Alert>
      ) : null}
      <p className="adm-powod">
        Flaga demo jest zawsze włączona i nie można jej zmienić. Zestaw ma od 3 do 6 opinii, oceny
        od 3 do 5, a data sięga najwyżej 6 miesięcy wstecz.
      </p>
      <datalist id="warianty-opinii">
        {variantLabels.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <ol className="adm-lista adm-stos">
        {fields.map((f, i) => (
          <li key={f.key} className="adm-karta adm-stos" aria-label={`Opinia ${i + 1}`}>
            <h2>Opinia {i + 1}</h2>
            <div className="adm-siatka">
              <Field
                label="Autor (imię i inicjał)"
                disabled={disabled}
                error={errors.items?.[i]?.author?.message}
                {...register(`items.${i}.author`)}
              />
              <Field
                label="Data"
                type="date"
                disabled={disabled}
                error={errors.items?.[i]?.date?.message}
                {...register(`items.${i}.date`)}
              />
              <Field
                as="select"
                label="Ocena"
                disabled={disabled}
                error={errors.items?.[i]?.rating?.message}
                {...register(`items.${i}.rating`, { valueAsNumber: true })}
              >
                {[5, 4, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Field>
              <Field
                label="Wariant"
                list="warianty-opinii"
                disabled={disabled}
                error={errors.items?.[i]?.variant_label?.message}
                {...register(`items.${i}.variant_label`)}
              />
            </div>
            <Field
              as="textarea"
              label="Tekst (1–4 zdania)"
              rows={3}
              disabled={disabled}
              error={errors.items?.[i]?.text?.message}
              {...register(`items.${i}.text`)}
            />
            <div className="adm-akcje">
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || fields.length <= 3}
                aria-label={`Usuń opinię ${i + 1}`}
                onClick={() => removeAt(i)}
              >
                Usuń
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="adm-akcje">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || fields.length >= 6}
          onClick={() =>
            append({
              author: "",
              date: new Date().toISOString().slice(0, 10),
              rating: 5,
              variant_label: variantLabels[0] ?? "",
              text: "",
            })
          }
        >
          Dodaj opinię
        </Button>
        <Button
          type="submit"
          loading={saving}
          disabled={disabled}
          aria-describedby={disabled ? "powod-zapisu" : undefined}
        >
          Zapisz zestaw
        </Button>
        <DisabledReason id="powod-zapisu" reason={reason} />
      </div>

      <section className="adm-karta adm-stos" aria-labelledby="sek-podglad-opinii">
        <h2 id="sek-podglad-opinii">Podgląd: tak to wygląda w sklepie</h2>
        <p>
          <strong>{REVIEWS_PREVIEW_LABEL}</strong>
        </p>
        <p>{reviewSummary(count > 0 ? sum / count : null, count)}</p>
        <ul className="adm-lista adm-stos">
          {items.map((r, i) => (
            <li key={i}>
              <p>
                <strong>{r.author}</strong>, {r.date}, ocena {r.rating} z 5, {r.variant_label}
              </p>
              <p>{r.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </form>
  );
}

export function ReviewsEditor({ id }: { id: string }) {
  const query = useReviews();
  const product = useProduct(id);
  const labels = useMemo(() => {
    const out = new Set<string>();
    for (const v of product.data?.variants ?? []) {
      const color = colorLabel(v.color);
      out.add(color);
      if (v.switch) out.add(`${color} · ${SWITCH_LABEL[v.switch]}`);
      if (v.size) out.add(`${color} · ${v.size.toUpperCase()}`);
    }
    return [...out];
  }, [product.data]);
  return (
    <QueryBoundary query={query} errorText="Nie udało się pobrać opinii.">
      {(data) => {
        const group = data.items.find((g) => g.product_id === id);
        if (!group) {
          return (
            <div className="adm-stos">
              <h1 tabIndex={-1}>Nie znaleziono</h1>
              <Alert variant="info">Nie ma takiego produktu.</Alert>
              <Link className="tk-link" href="/tresci/opinie">
                Wróć do listy
              </Link>
            </div>
          );
        }
        return (
          <div className="adm-strona">
            <PageHeader
              title={`Opinie: ${group.name}`}
              count={reviewSummary(group.avg, group.count)}
            />
            <nav aria-label="Okruszki">
              <Link className="tk-link" href="/tresci/opinie">
                Wróć do listy opinii
              </Link>
            </nav>
            <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
              <ReviewsForm key={group.product_id} group={group} variantLabels={labels} />
              <ShopNote
                url={product.data ? shopProductUrl(product.data.category, group.slug) : SITE_URL}
                tags={[`reviews:${group.slug}`, `product:${group.slug}`]}
              />
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
