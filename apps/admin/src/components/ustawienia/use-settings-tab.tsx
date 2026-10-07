"use client";
// B-400..B-408: wspolna logika zakladki ustawien - formularz RHF + schemat z contracts, zapis PATCH /settings z If-Match
// (wersja calych ustawien), 412 z "Wczytaj zmiany", bledy 422 przypisane do pol, komunikat o skutku w sklepie.
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { ApiError } from "../../lib/api/client";
import { settingsApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { useCan } from "../../lib/can";
import { plError } from "../../lib/forms";
import { SITE_URL } from "../../lib/format";
import { keys } from "../../lib/queries";
import type { AdminSettings } from "../../lib/settings-form";
import { DisabledReason } from "../ui/disabled-reason";

export interface SettingsTabOptions<TIn extends FieldValues, TOut> {
  settings: AdminSettings;
  schema: z.ZodType<TOut, TIn>;
  defaults: (s: AdminSettings) => TIn;
  toBody: (v: TOut, s: AdminSettings) => Record<string, unknown>;
  messages: Record<string, string>;
  /** Sciezki API (np. `shipping_methods[0].price_gr`) -> sciezki formularza. */
  exact?: Record<string, string>;
  rename?: Record<string, string>;
}

/** `a[0].b_gr` -> `x.0.b`: indeksy jako segmenty, nazwy przez slownik zakladki. */
export function toFormPath(
  apiPath: string,
  exact: Record<string, string>,
  rename: Record<string, string>,
): string {
  if (exact[apiPath]) return exact[apiPath];
  return apiPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((seg) => rename[seg] ?? seg)
    .join(".");
}

export interface SettingsTab<TIn extends FieldValues, TOut> {
  form: UseFormReturn<TIn, unknown, TOut>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  allowed: boolean;
  reason: string | null;
  saving: boolean;
  savedAt: Date | null;
  error: { text: string; conflict: boolean } | null;
  reload: () => Promise<void>;
}

export function useSettingsTab<TIn extends FieldValues, TOut>(
  opts: SettingsTabOptions<TIn, TOut>,
): SettingsTab<TIn, TOut> {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { allowed, reason } = useCan(session?.user.role, "settings.write");
  const form = useForm<TIn, unknown, TOut>({
    resolver: zodResolver(opts.schema as never, { error: plError(opts.messages) }) as never,
    defaultValues: opts.defaults(opts.settings) as DefaultValues<TIn>,
  });
  const [error, setErr] = useState<SettingsTab<TIn, TOut>["error"]>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const settingsRef = useRef(opts.settings);
  settingsRef.current = opts.settings;

  // Po wczytaniu nowszych ustawien (inna wersja) formularz startuje od nowych wartosci.
  const version = opts.settings.version;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    form.reset(opts.defaults(settingsRef.current) as DefaultValues<TIn>);
  }, [version]);

  const onSubmit = form.handleSubmit(async (values) => {
    setErr(null);
    const current = settingsRef.current;
    try {
      const saved = await settingsApi.patch(current.version, opts.toBody(values, current) as never);
      qc.setQueryData(keys.settings, saved);
      form.reset(opts.defaults(saved) as DefaultValues<TIn>);
      setSavedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.fieldErrors.length > 0) {
        let first = true;
        let assigned = 0;
        for (const fe of e.fieldErrors) {
          const name = toFormPath(fe.path, opts.exact ?? {}, opts.rename ?? {}) as Path<TIn>;
          form.setError(name, { type: "server", message: fe.message }, { shouldFocus: first });
          first = false;
          assigned += 1;
        }
        if (assigned > 0) {
          setErr({ text: "Popraw zaznaczone pola i zapisz ponownie.", conflict: false });
          return;
        }
      }
      setErr(describeError(e, "ustawienia sklepu"));
    }
  });

  const reload = async () => {
    const fresh = await settingsApi.get();
    qc.setQueryData(keys.settings, fresh);
    form.reset(opts.defaults(fresh) as DefaultValues<TIn>);
    setErr(null);
  };

  return {
    form,
    onSubmit: onSubmit as SettingsTab<TIn, TOut>["onSubmit"],
    allowed,
    reason,
    saving: form.formState.isSubmitting,
    savedAt,
    error,
    reload,
  };
}

/** Obudowa zakladki: pasek komunikatow, tresc, przycisk "Zapisz" (nieaktywny z powodem poza wlascicielem). */
export function TabShell<TIn extends FieldValues, TOut>({
  tab,
  label,
  children,
}: {
  tab: SettingsTab<TIn, TOut>;
  label: string;
  children: ReactNode;
}) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab.error) alertRef.current?.focus();
  }, [tab.error]);
  return (
    <form className="adm-formularz" onSubmit={tab.onSubmit} noValidate aria-label={label}>
      {!tab.allowed ? (
        <Alert variant="info">Tylko właściciel zmienia ustawienia sklepu.</Alert>
      ) : null}
      {tab.error ? (
        <div ref={alertRef} tabIndex={-1}>
          <Alert variant="blad">
            {tab.error.text}{" "}
            {tab.error.conflict ? (
              <Button variant="secondary" onClick={() => void tab.reload()}>
                Wczytaj zmiany
              </Button>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {tab.savedAt && !tab.form.formState.isDirty && !tab.error ? (
        <Alert variant="sukces">
          Zapisano. Sklep odświeży stronę w kilka sekund.{" "}
          <a className="tk-link" href={SITE_URL} target="_blank" rel="noreferrer">
            Zobacz w sklepie
          </a>
        </Alert>
      ) : null}
      {children}
      <div className="adm-akcje">
        <Button
          type="submit"
          loading={tab.saving}
          disabled={!tab.allowed}
          aria-describedby={!tab.allowed ? "powod-ustawienia" : undefined}
        >
          Zapisz
        </Button>
        <DisabledReason id="powod-ustawienia" reason={tab.reason} />
      </div>
    </form>
  );
}
