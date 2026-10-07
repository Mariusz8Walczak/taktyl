"use client";
// B-304, B-305, B-306, B-310 (docs/15 par. 9.1): edycja strony informacyjnej / prawnej albo artykulu poradnika.
// Pola: tytul, wstep, tresc (Markdown ograniczony), profil kreatora (poradnik), flaga demo (nieusuwalna po wlaczeniu).
// Pasek walidatora pod edytorem (slowa, bledy z API z numerem linii), podglad "Tak to wyglada w sklepie" z baner "Wzor tresci...".
// Zapis: PATCH z If-Match (412 -> "Wczytaj zmiany"), "Zatwierdz" = status published, "Zapisz szkic" = draft.
// Znaczniki po zapisie: content:{slug} (+ content:guide, catalog dla poradnika) - docs/15 par. 9.1.
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contentPatchSchema,
  profileIdSchema,
  type AdminContent,
  type ProfileId,
} from "@taktyl/contracts";
import { countWords, GUIDE_WORDS } from "@taktyl/domain";
import { Alert, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { contentApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import {
  CONTENT_STATUS_LABEL,
  DEMO_NOTICE_TEXT,
  PROFILE_LABEL,
  WORD_COUNT,
  shopContentUrl,
} from "../../lib/content-labels";
import { plError } from "../../lib/forms";
import { formatCount } from "../../lib/format";
import { MarkdownPreview } from "../../lib/markdown-preview";
import { keys, useContent } from "../../lib/queries";
import { issuesOf } from "../../lib/server-issues";
import { DisabledReason } from "../ui/disabled-reason";
import { IssueList, type Issue } from "../ui/issue-list";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import { SaveBar } from "../ui/save-bar";
import { ShopNote } from "../ui/shop-note";

interface FormValues {
  title: string;
  lead: string;
  body_md: string;
  guide_profile: ProfileId | "";
  demo_notice: boolean;
}

const MESSAGES = {
  title: "Wpisz tytuł (2–160 znaków).",
  body_md: "Treść jest za długa (najwyżej 50 000 znaków).",
};

const defaultsOf = (c: AdminContent): FormValues => ({
  title: c.title,
  lead: c.lead ?? "",
  body_md: c.body_md,
  guide_profile: c.guide_profile ?? "",
  demo_notice: c.demo_notice,
});

/** Walidacja kontraktem (contentPatchSchema) na wartosciach znormalizowanych do ksztaltu API. */
const base = zodResolver(contentPatchSchema, { error: plError(MESSAGES) });
const resolver: Resolver<FormValues> = async (values, ctx, opts) => {
  const result = await base(
    {
      title: values.title,
      lead: values.lead.trim() === "" ? null : values.lead,
      body_md: values.body_md,
      guide_profile: values.guide_profile === "" ? null : values.guide_profile,
      demo_notice: values.demo_notice,
    } as never,
    ctx,
    opts as never,
  );
  // Formularz zachowuje wartosci wpisane przez uzytkownika (puste pole = "", nie null); kontrakt tylko waliduje.
  return Object.keys(result.errors).length > 0 ? (result as never) : { values, errors: {} };
};

/** Slowa artykulu liczone z tekstu bez skladni Markdown (jak walidator w API). */
export function plainWords(md: string): number {
  return countWords(
    md
      .replace(/<[^>]*>/g, " ")
      .replace(/[#>*_`|-]+/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
  );
}

function Editor({ item, type }: { item: AdminContent; type: "page" | "guide" }) {
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
  } = useForm<FormValues>({ resolver, defaultValues: defaultsOf(item) });

  const [formError, setFormError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState<"published" | "draft" | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const body = watch("body_md");
  const title = watch("title");
  const demoNotice = watch("demo_notice");
  const profile = watch("guide_profile");
  const words = type === "guide" ? plainWords(body) : countWords(body);
  const wordsOk = type !== "guide" || (words >= GUIDE_WORDS.min && words <= GUIDE_WORDS.max);
  const noticeLocked = item.demo_notice;

  const save = (status: "published" | "draft") =>
    handleSubmit(async (v) => {
      setFormError(null);
      setIssues([]);
      if (type === "guide" && status === "published" && v.guide_profile === "") {
        setError(
          "guide_profile",
          { type: "validate", message: "Wybierz profil kreatora dla odnośnika na końcu artykułu." },
          { shouldFocus: true },
        );
        return;
      }
      const patch: Record<string, unknown> = {};
      if (v.title !== item.title) patch["title"] = v.title;
      const lead = v.lead.trim() === "" ? null : v.lead;
      if (lead !== item.lead) patch["lead"] = lead;
      if (v.body_md !== item.body_md) patch["body_md"] = v.body_md;
      const gp = v.guide_profile === "" ? null : v.guide_profile;
      if (type === "guide" && gp !== item.guide_profile) patch["guide_profile"] = gp;
      if (v.demo_notice !== item.demo_notice) patch["demo_notice"] = v.demo_notice;
      if (status !== item.status) patch["status"] = status;
      if (Object.keys(patch).length === 0) {
        setFormError({ text: "Brak zmian do zapisania.", conflict: false });
        return;
      }
      setSaving(status);
      try {
        const saved = await contentApi.patch(item.id, item.version, patch as never);
        const { warnings: w, ...row } = saved;
        qc.setQueryData(keys.content(type), (old: { items: AdminContent[] } | undefined) =>
          old ? { items: old.items.map((x) => (x.id === row.id ? row : x)) } : old,
        );
        reset(defaultsOf(row));
        setWarnings(w.map((x) => ({ path: x.code, message: x.message })));
        setSavedAt(new Date());
      } catch (e) {
        const found = issuesOf(e);
        if (found.length > 0) {
          setIssues(found);
          const first = found[0]?.path;
          if (first === "body_md" || first === "title" || first === "lead") {
            setError(first, { type: "server", message: found[0]?.message }, { shouldFocus: true });
          }
        } else {
          setFormError(describeError(e, "tę treść"));
        }
      } finally {
        setSaving(null);
      }
    });

  const reload = async () => {
    const fresh = await contentApi.list(type);
    qc.setQueryData(keys.content(type), fresh);
    const row = fresh.items.find((x) => x.id === item.id);
    if (row) reset(defaultsOf(row));
    setFormError(null);
    setIssues([]);
  };

  const disabled = !allowed;
  const listHref = type === "page" ? "/tresci/strony" : "/tresci/poradnik";
  const tags =
    type === "guide"
      ? [`content:${item.slug}`, "content:guide", "catalog"]
      : [`content:${item.slug}`];

  return (
    <div className="adm-strona">
      <PageHeader title={item.title}>
        <p className="adm-licznik">
          Adres: /{type === "guide" ? `poradnik/${item.slug}` : item.slug}, status:{" "}
          {CONTENT_STATUS_LABEL[item.status].toLowerCase()}
        </p>
      </PageHeader>
      <nav aria-label="Okruszki">
        <Link className="tk-link" href={listHref}>
          {type === "page" ? "Wróć do listy stron" : "Wróć do listy poradników"}
        </Link>
      </nav>
      <div className="adm-dwie-kolumny adm-dwie-kolumny--prawa">
        <form
          className="adm-formularz"
          noValidate
          aria-label="Edycja treści"
          onSubmit={(e) => e.preventDefault()}
        >
          <SaveBar dirty={isDirty} savedAt={savedAt} shopUrl={shopContentUrl(type, item.slug)} />
          {formError ? (
            <div ref={alertRef} tabIndex={-1}>
              <Alert variant={formError.conflict ? "blad" : "info"}>
                {formError.text}{" "}
                {formError.conflict ? (
                  <Button variant="secondary" onClick={() => void reload()}>
                    Wczytaj zmiany
                  </Button>
                ) : null}
              </Alert>
            </div>
          ) : null}
          <IssueList variant="blad" title="Popraw treść przed zapisem" issues={issues} />
          <IssueList variant="uwaga" title="Ostrzeżenia walidatora" issues={warnings} />

          <section className="adm-karta" aria-labelledby="sek-tresc">
            <h2 id="sek-tresc">Treść</h2>
            <Field
              label="Tytuł"
              disabled={disabled}
              error={errors.title?.message}
              {...register("title")}
            />
            <Field
              as="textarea"
              label="Wstęp"
              rows={2}
              hint="Krótko, jedno lub dwa zdania. Pokazywany na liście."
              disabled={disabled}
              error={errors.lead?.message}
              {...register("lead")}
            />
            {type === "guide" ? (
              <Field
                as="select"
                label="Profil kreatora"
                hint="Końcowy odnośnik artykułu prowadzi do kreatora z tym profilem. Wymagany do zatwierdzenia."
                disabled={disabled}
                error={errors.guide_profile?.message}
                {...register("guide_profile")}
              >
                <option value="">Wybierz profil</option>
                {profileIdSchema.options.map((p) => (
                  <option key={p} value={p}>
                    {PROFILE_LABEL[p]}
                  </option>
                ))}
              </Field>
            ) : null}
            <Field
              as="textarea"
              label="Treść (Markdown, podzbiór)"
              rows={18}
              hint="Nagłówki ##, listy, cytat, pogrubienie, kursywa, kod i odnośniki. Obrazy i HTML są usuwane przy zapisie. Esc wychodzi z pola, Tab przechodzi dalej."
              disabled={disabled}
              error={errors.body_md?.message}
              aria-describedby="walidator"
              {...register("body_md")}
            />
            <p id="walidator" className="adm-powod" role="status">
              Liczba słów: {formatCount(words, WORD_COUNT)}
              {type === "guide"
                ? wordsOk
                  ? `. W zakresie ${GUIDE_WORDS.min}–${GUIDE_WORDS.max}.`
                  : `. Potrzeba ${GUIDE_WORDS.min}–${GUIDE_WORDS.max}.`
                : "."}
            </p>
            <label className="adm-radio">
              <input
                type="checkbox"
                disabled={disabled || noticeLocked}
                aria-describedby="demo-opis"
                {...register("demo_notice")}
              />
              <span>Wzór treści dla sklepu demonstracyjnego (flaga demo)</span>
            </label>
            <p id="demo-opis" className="adm-powod">
              {noticeLocked
                ? "Flaga jest włączona i nie da się jej zdjąć. Sklep zawsze dokłada nagłówek ze wzorem treści."
                : "Po włączeniu flagi nie da się jej zdjąć. Strony prawne muszą ją mieć."}
            </p>
          </section>

          <div className="adm-akcje">
            <Button
              type="button"
              loading={saving === "published"}
              disabled={disabled || saving !== null}
              aria-describedby={disabled ? "powod-zapisu" : undefined}
              onClick={() => void save("published")()}
            >
              Zatwierdź
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={saving === "draft"}
              disabled={disabled || saving !== null}
              aria-describedby={disabled ? "powod-zapisu" : undefined}
              onClick={() => void save("draft")()}
            >
              Zapisz szkic
            </Button>
            <DisabledReason id="powod-zapisu" reason={reason} />
          </div>

          <section className="adm-karta" aria-labelledby="sek-podglad">
            <h2 id="sek-podglad">Podgląd: tak to wygląda w sklepie</h2>
            <p className="adm-powod">
              Tylko do odczytu. Odnosi się do tego, co wpisano w polach powyżej.
            </p>
            {demoNotice ? <Alert variant="info">{DEMO_NOTICE_TEXT}</Alert> : null}
            <h3>{title}</h3>
            <MarkdownPreview markdown={body} label="Podgląd treści" />
            {type === "guide" && profile ? (
              <p>Na końcu artykułu: odnośnik do kreatora z profilem „{PROFILE_LABEL[profile]}”.</p>
            ) : null}
          </section>
        </form>
        <ShopNote url={shopContentUrl(type, item.slug)} tags={tags} />
      </div>
    </div>
  );
}

export function ContentEditor({ type, slug }: { type: "page" | "guide"; slug: string }) {
  const query = useContent(type);
  return (
    <QueryBoundary query={query} errorText="Nie udało się pobrać treści.">
      {(data) => {
        const item = data.items.find((x) => x.slug === slug);
        return item ? (
          <Editor key={item.id} item={item} type={type} />
        ) : (
          <div className="adm-stos">
            <h1 tabIndex={-1}>Nie znaleziono</h1>
            <Alert variant="info">Nie ma takiej treści.</Alert>
            <Link
              className="tk-link"
              href={type === "page" ? "/tresci/strony" : "/tresci/poradnik"}
            >
              Wróć do listy
            </Link>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
