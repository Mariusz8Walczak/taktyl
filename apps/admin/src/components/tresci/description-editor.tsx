"use client";
// B-300, B-301, B-310 (docs/15 par. 9): opis produktu - tekst w akapitach (pusta linia), licznik slow 60-120 i akapitow 2-3
// na zywo, zakazane slowa podswietlone w podgladzie, ostrzezenia z API po zapisie. Ostrzezenia NIE blokuja zapisu (docs/16
// par. 3.4); marka spoza Taktyl = 422 pod polem. PUT z If-Match = wersja produktu; 412 -> "Wczytaj zmiany".
// Znacznik po zapisie: product:{slug}.
import { zodResolver } from "@hookform/resolvers/zod";
import { descriptionPutSchema, type AdminProductDetail } from "@taktyl/contracts";
import {
  countWords,
  DESCRIPTION_PARAGRAPHS,
  DESCRIPTION_WORDS,
  segmentForbidden,
  splitParagraphs,
} from "@taktyl/domain";
import { Alert, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { catalogApi, descriptionApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { PARAGRAPH_COUNT, WORD_COUNT } from "../../lib/content-labels";
import { plError } from "../../lib/forms";
import { formatCount, shopProductUrl } from "../../lib/format";
import { keys, useProduct } from "../../lib/queries";
import { issuesOf } from "../../lib/server-issues";
import { DisabledReason } from "../ui/disabled-reason";
import { IssueList, type Issue } from "../ui/issue-list";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { SaveBar } from "../ui/save-bar";
import { ShopNote } from "../ui/shop-note";

interface FormValues {
  description: string;
}

const base = zodResolver(descriptionPutSchema, {
  error: plError({ description: "Opis może mieć najwyżej 3000 znaków." }),
});
const resolver: Resolver<FormValues> = async (values, ctx, opts) => {
  const result = await base(
    { description: values.description.trim() === "" ? null : values.description } as never,
    ctx,
    opts as never,
  );
  return Object.keys(result.errors).length > 0 ? (result as never) : { values, errors: {} };
};

/** Podglad opisu: akapity z podswietlonymi zakazanymi slowami (<mark> + tekst, kolor nie jest jedynym nosnikiem). */
export function HighlightedText({ text }: { text: string }) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return <p className="adm-powod">Brak tekstu do podglądu.</p>;
  return (
    <div className="adm-podglad" role="region" aria-label="Podgląd opisu">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {segmentForbidden(p).map((s, j) =>
            s.forbidden ? (
              <mark key={j} className="adm-zakazane">
                <span className="tk-sr-only">Zakazane słowo: </span>
                {s.text}
              </mark>
            ) : (
              <span key={j}>{s.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function Editor({ product }: { product: AdminProductDetail }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "content.write");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver,
    defaultValues: { description: product.description ?? "" },
  });
  const [formError, setFormError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const text = watch("description");
  const words = countWords(text);
  const paragraphs = splitParagraphs(text).length;
  const wordsOk = words >= DESCRIPTION_WORDS.min && words <= DESCRIPTION_WORDS.max;
  const paragraphsOk =
    paragraphs >= DESCRIPTION_PARAGRAPHS.min && paragraphs <= DESCRIPTION_PARAGRAPHS.max;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    setSaving(true);
    try {
      const saved = await descriptionApi.put(product.id, product.version, {
        description: v.description.trim() === "" ? null : v.description,
      });
      const next = { ...product, description: saved.description, version: saved.version };
      qc.setQueryData(keys.product(product.id), next);
      reset({ description: saved.description ?? "" });
      setWarnings(
        saved.warnings.map((w) => ({
          path: w.code,
          message:
            w.code === "description_forbidden_words" && w.details
              ? `Zakazane słowa: ${w.details.join(", ")}. Usuń je lub zastąp opisem z atrybutów.`
              : w.message,
        })),
      );
      setSavedAt(new Date());
    } catch (e) {
      const found = issuesOf(e);
      if (found.length > 0) {
        setError(
          "description",
          { type: "server", message: found[0]?.message },
          { shouldFocus: true },
        );
      } else {
        setFormError(describeError(e, "ten produkt"));
      }
    } finally {
      setSaving(false);
    }
  });

  const reload = async () => {
    const fresh = await catalogApi.get(product.id);
    qc.setQueryData(keys.product(product.id), fresh);
    reset({ description: fresh.description ?? "" });
    setFormError(null);
  };

  const disabled = !allowed;
  const url = shopProductUrl(product.category, product.slug);
  return (
    <div className="adm-strona">
      <PageHeader title={`Opis: ${product.name}`} />
      <nav aria-label="Okruszki">
        <Link className="tk-link" href="/tresci/opisy">
          Wróć do listy opisów
        </Link>
      </nav>
      <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
        <form className="adm-formularz" noValidate onSubmit={onSubmit} aria-label="Opis produktu">
          <SaveBar dirty={isDirty} savedAt={savedAt} shopUrl={url} />
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
          <IssueList
            variant="uwaga"
            title="Ostrzeżenia z zapisu (nie blokują zapisu)"
            issues={warnings}
          />
          <section className="adm-karta" aria-labelledby="sek-opis">
            <h2 id="sek-opis">Opis</h2>
            <Field
              as="textarea"
              label="Opis produktu"
              rows={12}
              hint="Akapity rozdziel pustą linią. Opisuj tylko to, co wynika z atrybutów produktu. Bez obrazów i znaczników HTML."
              disabled={disabled}
              error={errors.description?.message}
              aria-describedby="licznik-opisu"
              {...register("description")}
            />
            <p id="licznik-opisu" className="adm-powod" role="status">
              {formatCount(words, WORD_COUNT)}
              {wordsOk
                ? ` (w zakresie ${DESCRIPTION_WORDS.min}–${DESCRIPTION_WORDS.max}). `
                : ` (zalecane ${DESCRIPTION_WORDS.min}–${DESCRIPTION_WORDS.max}). `}
              {formatCount(paragraphs, PARAGRAPH_COUNT)}
              {paragraphsOk
                ? ` (w zakresie ${DESCRIPTION_PARAGRAPHS.min}–${DESCRIPTION_PARAGRAPHS.max}). `
                : ` (zalecane ${DESCRIPTION_PARAGRAPHS.min}–${DESCRIPTION_PARAGRAPHS.max}). `}
              Ostrzeżenia nie blokują zapisu.
            </p>
          </section>
          <section className="adm-karta" aria-labelledby="sek-podglad">
            <h2 id="sek-podglad">Podgląd</h2>
            <p className="adm-powod">Zakazane słowa są podświetlone i oznaczone tekstem.</p>
            <HighlightedText text={text} />
          </section>
          <div className="adm-akcje">
            <Button
              type="submit"
              loading={saving}
              disabled={disabled}
              aria-describedby={disabled ? "powod-zapisu" : undefined}
            >
              Zapisz opis
            </Button>
            <DisabledReason id="powod-zapisu" reason={reason} />
          </div>
        </form>
        <ShopNote url={url} tags={[`product:${product.slug}`]} />
      </div>
    </div>
  );
}

export function DescriptionEditor({ id }: { id: string }) {
  const query = useProduct(id);
  return (
    <QueryBoundary
      query={query}
      errorText="Nie udało się pobrać produktu."
      notFoundText="Nie ma takiego produktu."
    >
      {(product) => <Editor key={product.id} product={product} />}
    </QueryBoundary>
  );
}
