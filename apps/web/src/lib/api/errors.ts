// Bledy klienta API (docs/16 §1: problem+json). Kazdy ma czytelny komunikat; nic nie jest polykane po cichu.
import type { Problem } from "@taktyl/contracts";

/** Odpowiedz HTTP inna niz 2xx albo brak polaczenia z API. */
export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    message: string,
    readonly path: string,
    readonly status: number | null,
    readonly problem: Problem | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Odpowiedz 2xx, ktorej ksztalt nie zgadza sie ze schematem z @taktyl/contracts. */
export class ApiContractError extends Error {
  override readonly name = "ApiContractError";
  constructor(
    readonly path: string,
    /** Linie "sciezka: komunikat" z walidacji schematu. */
    readonly issues: readonly string[],
    options?: { cause?: unknown },
  ) {
    super(
      `Odpowiedz API ${path} nie zgadza sie z kontraktem (${issues.length} ${issues.length === 1 ? "problem" : "problemow"}): ${issues
        .slice(0, 5)
        .join("; ")}`,
      options,
    );
  }
}
