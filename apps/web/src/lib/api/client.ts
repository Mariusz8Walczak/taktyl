// F-001, F-009 (docs/14 §4-5): klient odczytu API dla komponentow serwerowych. fetch z `next: { tags }`,
// odpowiedz zawsze parsowana schematem z @taktyl/contracts; blad kontraktu to ApiContractError, nie `any`.
import { problemSchema } from "@taktyl/contracts";
import { apiBaseUrl } from "./config";
import { ApiContractError, ApiError } from "./errors";
import { REVALIDATE_SECONDS } from "./tags";

/** Minimalny ksztalt schematu Zod (safeParse); dzieki temu web nie zalezy bezposrednio od zod. */
export interface Schema<T> {
  safeParse(
    input: unknown,
  ):
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
      };
}

export interface ApiGetOptions {
  /** Znaczniki z docs/14 §6 (patrz tags.ts). */
  tags: readonly string[];
  /** Domyslnie 300 s; `false` = bez cache (wycena, stany: `cache: 'no-store'`). */
  revalidate?: number | false;
  /** Parametry zapytania; undefined jest pomijane. */
  query?: Record<string, string | number | undefined>;
  /** Do testow. */
  baseUrl?: string;
}

function buildUrl(path: string, base: string, query?: ApiGetOptions["query"]): string {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(query ?? {}))
    if (v !== undefined) url.searchParams.set(k, String(v));
  return url.toString();
}

/** GET /v1/... z cache danych Next, parsowanie schematem. */
export async function apiGet<T>(
  path: string,
  schema: Schema<T>,
  { tags, revalidate = REVALIDATE_SECONDS, query, baseUrl }: ApiGetOptions,
): Promise<T> {
  const url = buildUrl(path, baseUrl ?? apiBaseUrl(), query);
  const init: RequestInit & { next?: { tags: string[]; revalidate?: number | false } } =
    revalidate === false
      ? { headers: { accept: "application/json" }, cache: "no-store" }
      : { headers: { accept: "application/json" }, next: { tags: [...tags], revalidate } };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new ApiError(`Nie mozna polaczyc sie z API (${path}).`, path, null, null, { cause });
  }

  if (!res.ok) {
    let problem = null;
    try {
      const parsed = problemSchema.safeParse(await res.json());
      if (parsed.success) problem = parsed.data;
    } catch {
      /* odpowiedz bledu bez JSON-a: zostaje sam status */
    }
    throw new ApiError(
      `API ${path} zwrocilo ${res.status}${problem ? `: ${problem.title}` : ""}.`,
      path,
      res.status,
      problem,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (cause) {
    throw new ApiContractError(path, ["odpowiedz nie jest poprawnym JSON-em"], { cause });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiContractError(
      path,
      parsed.error.issues.map((i) => `${i.path.map(String).join(".") || "(korzen)"}: ${i.message}`),
    );
  }
  return parsed.data;
}
