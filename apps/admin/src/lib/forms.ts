// docs/15 §13, docs/06 §5: wspolne narzedzia formularzy. Schematy Zod pochodza z @taktyl/contracts (jedne dla panelu i
// API); tu tylko polskie komunikaty bledow i mapowanie bledow serwera (422) na pola.
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api/client";

interface IssueLike {
  code?: string;
  path?: PropertyKey[];
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  format?: string;
  input?: unknown;
}

/**
 * Mapa komunikatow Zod po polsku. `overrides` (klucz = sciezka pola, np. "email") ma pierwszenstwo; reszta to ogolne
 * komunikaty wg rodzaju bledu. Uzycie: `zodResolver(schema, { error: plError({ email: "Wpisz adres e-mail." }) })`.
 */
export function plError(overrides: Record<string, string> = {}) {
  return (iss: IssueLike): string => {
    const path = (iss.path ?? []).join(".");
    // klucz moze zawierac * w miejscu indeksu tablicy, np. "methods.*.price"
    const own = overrides[path] ?? overrides[path.replace(/\.\d+(?=\.|$)/g, ".*")];
    if (own) return own;
    switch (iss.code) {
      case "invalid_type":
        return iss.input === undefined ? "Uzupełnij to pole." : "Wpisz poprawną wartość.";
      case "too_small":
        return iss.origin === "string"
          ? `Wpisz co najmniej ${String(iss.minimum)} znaków.`
          : `Wartość musi być nie mniejsza niż ${String(iss.minimum)}.`;
      case "too_big":
        return iss.origin === "string"
          ? `Wpisz najwyżej ${String(iss.maximum)} znaków.`
          : `Wartość musi być nie większa niż ${String(iss.maximum)}.`;
      case "invalid_format":
        return iss.format === "email"
          ? "Wpisz poprawny adres e-mail."
          : "Wpisz wartość w poprawnym formacie.";
      default:
        return "Wpisz poprawną wartość.";
    }
  };
}

/**
 * Bledy pol z odpowiedzi 422 -> RHF. `map` zamienia sciezke API na nazwe pola formularza (np. "price_gr" -> "price").
 * Zwraca liczbe przypisanych bledow; 0 oznacza, ze komunikat trzeba pokazac w tresci.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  map: (apiPath: string) => Path<T> | null = (p) => p as Path<T>,
): number {
  if (!(err instanceof ApiError) || err.status !== 422) return 0;
  let first = true;
  let count = 0;
  for (const e of err.fieldErrors) {
    const name = map(e.path);
    if (!name) continue;
    setError(name, { type: "server", message: e.message }, { shouldFocus: first });
    first = false;
    count += 1;
  }
  return count;
}
