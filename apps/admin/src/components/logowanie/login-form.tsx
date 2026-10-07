"use client";
// B-001, B-002, B-004, B-007 (docs/15 §6.1): formularz logowania. Schemat z @taktyl/contracts (loginRequestSchema),
// komunikat bledu bez enumeracji, limit prob z powodem przy nieaktywnym przycisku, wygasniecie sesji z komunikatem.
import { loginRequestSchema } from "@taktyl/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ApiError } from "../../lib/api/client";
import { authApi } from "../../lib/api/endpoints";
import { lockMinutes } from "../../lib/api/messages";
import { pluralize } from "@taktyl/domain";
import { plError } from "../../lib/forms";
import { SESSION_KEY, safeNext, useAuth } from "../../lib/auth/session";

type Values = z.input<typeof loginRequestSchema>;

const MESSAGES = { email: "Wpisz adres e-mail.", password: "Wpisz hasło." };

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { session } = useAuth();
  const next = safeNext(params.get("next"));
  const reason = params.get("powod");

  const [error, setError] = useState<string | null>(null);
  const [lockedFor, setLockedFor] = useState<number | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(loginRequestSchema, { error: plError(MESSAGES) }),
    defaultValues: { email: "", password: "" },
  });

  // Juz zalogowany: wracamy tam, dokad szlismy.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const finish = (data: Awaited<ReturnType<typeof authApi.login>>) => {
    qc.setQueryData(SESSION_KEY, data);
    router.replace(next);
  };

  const onError = (e: unknown) => {
    if (e instanceof ApiError && e.code === "rate_limited") {
      const min = lockMinutes(e);
      setLockedFor(min);
      setError(
        `Za dużo prób. Spróbuj za ${min} ${pluralize(min, { one: "minutę", few: "minuty", many: "minut" })}.`,
      );
    } else if (e instanceof ApiError && e.status === 401) {
      setError("Nieprawidłowy e-mail lub hasło.");
    } else {
      setError("Nie udało się zalogować. Spróbuj ponownie.");
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      finish(await authApi.login(values.email, values.password));
    } catch (e) {
      onError(e);
    }
  });

  const demo = async () => {
    setError(null);
    setDemoBusy(true);
    try {
      finish(await authApi.demoViewer());
    } catch (e) {
      onError(e);
    } finally {
      setDemoBusy(false);
    }
  };

  const locked = lockedFor !== null;

  return (
    <>
      <h1>Zaloguj się do backpanelu</h1>
      {reason === "wygasla" && !error ? (
        <Alert variant="uwaga">Sesja wygasła. Zaloguj się ponownie.</Alert>
      ) : null}
      {reason === "wylogowano" && !error ? <Alert variant="info">Wylogowano.</Alert> : null}
      {error ? (
        <div ref={alertRef} tabIndex={-1}>
          <Alert variant="blad">{error}</Alert>
        </div>
      ) : null}
      <form className="adm-formularz" onSubmit={onSubmit} noValidate>
        <Field
          label="E-mail"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register("email")}
        />
        <Field
          label="Hasło"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="adm-stos">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={locked}
            aria-describedby={locked ? "powod-blokady" : undefined}
          >
            Zaloguj się
          </Button>
          {locked ? (
            <p id="powod-blokady" className="adm-powod">
              Przycisk jest nieaktywny, bo przekroczono limit prób logowania.
            </p>
          ) : null}
        </div>
      </form>
      {demoMode ? (
        <div className="adm-stos">
          <Button variant="secondary" type="button" loading={demoBusy} onClick={demo}>
            Wejdź jako viewer
          </Button>
          <p className="adm-powod">Tylko do odczytu. Nic nie zmienisz.</p>
        </div>
      ) : null}
    </>
  );
}
