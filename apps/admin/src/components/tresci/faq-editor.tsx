"use client";
// B-307 (docs/15 par. 9): FAQ - lista pytan z kolejnoscia. Zmiana kolejnosci wylacznie przyciskami "Przesun w gore" i
// "Przesun w dol" (bez przeciagania), dodawanie i usuwanie pytan; usuniecie to zmiana w formularzu z "Cofnij" w toascie
// (bez confirm), trafia do sklepu dopiero po "Zapisz". PUT calej listy, znacznik content:faq.
import { zodResolver } from "@hookform/resolvers/zod";
import { faqPutSchema, type AdminFaqItem } from "@taktyl/contracts";
import { Alert, Button, Field, useToast } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { faqApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { SHOP_FAQ_URL } from "../../lib/content-labels";
import { plError } from "../../lib/forms";
import { keys, useFaq } from "../../lib/queries";
import { issuesOf } from "../../lib/server-issues";
import { DisabledReason } from "../ui/disabled-reason";
import { IssueList, type Issue } from "../ui/issue-list";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { SaveBar } from "../ui/save-bar";
import { ShopNote } from "../ui/shop-note";

const itemShape = faqPutSchema.shape.items.element.shape;
const schema = z.object({
  items: z.array(
    z.object({
      sid: z.string().optional(),
      question: itemShape.question,
      answer_md: itemShape.answer_md,
      status: itemShape.status,
    }),
  ),
});
type FormValues = z.input<typeof schema>;
type Row = FormValues["items"][number];

const MESSAGES: Record<string, string> = {
  "items.*.question": "Wpisz pytanie (5–200 znaków).",
  "items.*.answer_md": "Wpisz odpowiedź (5–3000 znaków).",
};

const toRow = (i: AdminFaqItem): Row => ({
  sid: i.id,
  question: i.question,
  answer_md: i.answer_md,
  status: i.status,
});

const STATUS_LABEL = { published: "Zatwierdzone", draft: "Szkic", archived: "Zarchiwizowane" };

function FaqForm({ initial }: { initial: AdminFaqItem[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "content.write");
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema, { error: plError(MESSAGES) }),
    defaultValues: { items: initial.map(toRow) },
  });
  const { fields, move, remove, insert, append } = useFieldArray({
    control,
    name: "items",
    keyName: "key",
  });
  const [announce, setAnnounce] = useState("");
  const [focusTarget, setFocusTarget] = useState<{ index: number; dir: "up" | "down" } | null>(
    null,
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const li = listRef.current?.children[focusTarget.index];
    const btn = li?.querySelector<HTMLButtonElement>(`[data-faq-move="${focusTarget.dir}"]`);
    const other = li?.querySelector<HTMLButtonElement>("[data-faq-move]:not([disabled])");
    (btn && !btn.disabled ? btn : other)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  const moveItem = (from: number, to: number) => {
    move(from, to);
    setAnnounce(`Pytanie przesunięte na pozycję ${to + 1} z ${fields.length}.`);
    setFocusTarget({ index: to, dir: to > from ? "down" : "up" });
  };

  const removeItem = (index: number) => {
    const removed = fields[index];
    if (!removed) return;
    const row: Row = {
      sid: removed.sid,
      question: removed.question,
      answer_md: removed.answer_md,
      status: removed.status,
    };
    remove(index);
    setAnnounce(`Usunięto pytanie ${index + 1}.`);
    toast({
      message: "Usunięto pytanie. Zapisz listę, aby zmiana trafiła do sklepu.",
      actionLabel: "Cofnij",
      onAction: () => insert(index, row),
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setIssues([]);
    setSaving(true);
    try {
      const saved = await faqApi.put({
        items: values.items.map((i) => ({
          ...(i.sid ? { id: i.sid } : {}),
          question: i.question,
          answer_md: i.answer_md,
          status: i.status ?? "published",
        })),
      });
      qc.setQueryData(keys.faq, saved);
      reset({ items: saved.items.map(toRow) });
      setWarnings(saved.warnings.map((w) => ({ path: w.code, message: w.message })));
      setSavedAt(new Date());
    } catch (e) {
      const found = issuesOf(e);
      if (found.length > 0) setIssues(found);
      else setFormError(describeError(e, "listę pytań").text);
    } finally {
      setSaving(false);
    }
  });

  const disabled = !allowed;
  return (
    <div className="adm-strona">
      <PageHeader title="FAQ" count={`Pytań: ${fields.length}`} />
      <nav aria-label="Okruszki">
        <Link className="tk-link" href="/tresci">
          Wróć do treści
        </Link>
      </nav>
      <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
        <form className="adm-formularz" noValidate onSubmit={onSubmit} aria-label="Lista pytań FAQ">
          <SaveBar dirty={isDirty} savedAt={savedAt} shopUrl={SHOP_FAQ_URL} />
          {formError ? <Alert variant="blad">{formError}</Alert> : null}
          <IssueList variant="blad" title="Popraw pytania przed zapisem" issues={issues} />
          <IssueList variant="uwaga" title="Ostrzeżenia" issues={warnings} />
          <p className="tk-sr-only" role="status" aria-live="polite">
            {announce}
          </p>
          {fields.length === 0 ? <p>Nie ma jeszcze pytań. Dodaj pierwsze.</p> : null}
          <ol className="adm-lista adm-stos" ref={listRef}>
            {fields.map((f, i) => (
              <li key={f.key} className="adm-karta adm-stos" aria-label={`Pytanie ${i + 1}`}>
                <h2>Pytanie {i + 1}</h2>
                <Field
                  label="Pytanie"
                  disabled={disabled}
                  error={errors.items?.[i]?.question?.message}
                  {...register(`items.${i}.question`)}
                />
                <Field
                  as="textarea"
                  label="Odpowiedź (Markdown, podzbiór)"
                  rows={4}
                  disabled={disabled}
                  error={errors.items?.[i]?.answer_md?.message}
                  {...register(`items.${i}.answer_md`)}
                />
                <Field
                  as="select"
                  label="Status"
                  disabled={disabled}
                  error={errors.items?.[i]?.status?.message}
                  {...register(`items.${i}.status`)}
                >
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Field>
                <div className="adm-akcje">
                  <Button
                    type="button"
                    variant="secondary"
                    data-faq-move="up"
                    disabled={disabled || i === 0}
                    aria-label={`Przesuń w górę: pytanie ${i + 1}`}
                    onClick={() => moveItem(i, i - 1)}
                  >
                    Przesuń w górę
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-faq-move="down"
                    disabled={disabled || i === fields.length - 1}
                    aria-label={`Przesuń w dół: pytanie ${i + 1}`}
                    onClick={() => moveItem(i, i + 1)}
                  >
                    Przesuń w dół
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    aria-label={`Usuń pytanie ${i + 1}`}
                    onClick={() => removeItem(i)}
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
              disabled={disabled || fields.length >= 50}
              onClick={() => append({ question: "", answer_md: "", status: "draft" })}
            >
              Dodaj pytanie
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={disabled}
              aria-describedby={disabled ? "powod-zapisu" : undefined}
            >
              Zapisz listę
            </Button>
            <DisabledReason id="powod-zapisu" reason={reason} />
          </div>
        </form>
        <ShopNote url={SHOP_FAQ_URL} tags={["content:faq"]} />
      </div>
    </div>
  );
}

export function FaqEditor() {
  const query = useFaq();
  return (
    <QueryBoundary query={query} errorText="Nie udało się pobrać pytań FAQ.">
      {(data) => <FaqForm initial={data.items} />}
    </QueryBoundary>
  );
}
