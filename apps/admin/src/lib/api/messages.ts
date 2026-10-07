// B-001, B-003, B-004, docs/15 §7.2, §8.2: komunikaty po polsku skladane przez klienta z kodu bledu (docs/16 §1).
import { pluralize } from "@taktyl/domain";
import { ApiError } from "./client";

const MINUTE_FORMS = { one: "minutę", few: "minuty", many: "minut" } as const;

export interface UserMessage {
  /** Tekst do wyswietlenia w tresci. */
  text: string;
  /** Kod: konflikt wersji (412), wymaga przycisku "Wczytaj zmiany". */
  conflict: boolean;
}

export function conflictMessage(noun: string): string {
  return `Ktoś zmienił ${noun}. Odśwież i spróbuj ponownie.`;
}

/** Minuty do okna blokady, zaokraglone w gore (B-004: "Spróbuj za 15 minut"). */
export function lockMinutes(err: ApiError): number {
  return err.retryAfterSeconds ? Math.max(1, Math.ceil(err.retryAfterSeconds / 60)) : 15;
}

export function describeError(err: unknown, noun = "ten zasób"): UserMessage {
  if (!(err instanceof ApiError)) {
    return { text: "Nie udało się połączyć z serwerem. Spróbuj ponownie.", conflict: false };
  }
  if (err.status === 412) return { text: conflictMessage(noun), conflict: true };
  switch (err.code) {
    case "csrf_invalid":
      return { text: "Odśwież stronę i spróbuj ponownie.", conflict: false };
    case "forbidden":
      return { text: "Nie masz uprawnień do tej zmiany.", conflict: false };
    case "rate_limited":
      return {
        text: `Za dużo prób. Spróbuj za ${lockMinutes(err)} ${pluralize(lockMinutes(err), MINUTE_FORMS)}.`,
        conflict: false,
      };
    case "invalid_transition":
      return {
        text: "Z tego statusu nie da się przejść do wybranego. Odśwież stronę.",
        conflict: false,
      };
    case "not_found":
      return { text: "Nie znaleziono tego zasobu. Mógł zostać usunięty.", conflict: false };
    case "conflict":
      return {
        text: err.problem?.detail ?? "Ta zmiana koliduje z istniejącymi danymi.",
        conflict: false,
      };
    case "validation_failed":
      if (err.status === 428)
        return { text: "Odśwież stronę i spróbuj ponownie.", conflict: false };
      return { text: "Popraw zaznaczone pola i zapisz ponownie.", conflict: false };
    default:
      return { text: "Coś poszło nie tak po stronie serwera. Spróbuj ponownie.", conflict: false };
  }
}
