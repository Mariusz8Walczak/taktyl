// F-150...F-157, F-170...F-180 (WEB-002, ADR-0007): przekazanie zadan koszyka i zamowien z przegladarki do API.
// Tylko serwer Next (INTERNAL_API_URL); przegladarka pyta ten sam host. Bez cache. Naglowki przekazywane wprost:
// Idempotency-Key, X-Order-Token, X-Forwarded-For (limity API sa liczone na adres klienta, nie serwera sklepu).
import { apiBaseUrl } from "../api/config";

const PASS_REQUEST_HEADERS = ["idempotency-key", "x-order-token", "x-forwarded-for"] as const;
const MAX_BODY = 64 * 1024;

export async function proxyToApi(
  request: Request,
  path: string,
  method: "GET" | "POST",
): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  for (const h of PASS_REQUEST_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers[h] = v;
  }
  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body.length > MAX_BODY) return problem(413, "validation_failed", "Zbyt duże żądanie.");
    headers["content-type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, { method, headers, body, cache: "no-store" });
  } catch {
    return problem(502, "internal_error", "API jest chwilowo niedostępne.");
  }
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
      ...(res.headers.get("retry-after")
        ? { "retry-after": res.headers.get("retry-after") as string }
        : {}),
    },
  });
}

export function problem(status: number, code: string, title: string): Response {
  return Response.json(
    { status, code, title },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export const ORDER_NUMBER = /^TK-\d{6}-[A-Z0-9]{4}$/;
