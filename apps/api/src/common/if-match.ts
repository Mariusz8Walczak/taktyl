// B-100..B-115 (docs/16 par. 1, API-011): optymistyczna wspolbieznosc admina. `PATCH` wymaga `If-Match: "<version>"`;
// brak naglowka = 428, niepoprawny format = 422, rozjazd wersji = 412 (code `conflict`).
import { ifMatchSchema } from "@taktyl/contracts";
import { AppException } from "./app-exception.js";

const field = (code: string, message: string) => [{ path: "If-Match", code, message }];

/** Zwraca numer wersji z naglowka; `required=false` dopuszcza brak naglowka (zwraca undefined). */
export function parseIfMatch(header: string | undefined, required: boolean): number | undefined {
  if (header === undefined || header === "") {
    if (!required) return undefined;
    throw new AppException(
      428,
      "validation_failed",
      "Brakuje naglowka If-Match z wersja zasobu.",
      field("precondition_required", 'Wyslij If-Match: "<version>" z ostatniego odczytu.'),
    );
  }
  const parsed = ifMatchSchema.safeParse(header.trim());
  if (!parsed.success) {
    throw new AppException(
      422,
      "validation_failed",
      "Niepoprawny naglowek If-Match.",
      field("invalid_if_match", 'Oczekiwano If-Match: "<version>".'),
    );
  }
  return parsed.data;
}

export const preconditionFailed = (): AppException =>
  new AppException(
    412,
    "conflict",
    "Zasob zmienil sie od ostatniego odczytu. Wczytaj zmiany i sprobuj ponownie.",
    field("version_mismatch", "Wersja zasobu jest inna niz w If-Match."),
  );

/** Wartosc naglowka ETag dla wersji zasobu. */
export const etagOf = (version: number): string => `"${version}"`;
