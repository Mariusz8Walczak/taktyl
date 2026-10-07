// F-005 (docs/16 §2, GET /v1/search): przekazanie podpowiedzi do API z serwera Next. Przegladarka nie woluje API
// wprost (WEB-002), wiec pole wyszukiwania pyta ten adres tej samej domeny. Bez cache: wynik zalezy od wpisanego tekstu.
import { searchResponseSchema } from "@taktyl/contracts";
import { ApiError, TAG, apiGet } from "../../../lib/api";

export const dynamic = "force-dynamic";

const MAX_QUERY = 80;
const LIMIT = 6;

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > MAX_QUERY) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }
  try {
    const data = await apiGet("/v1/search", searchResponseSchema, {
      tags: [TAG.catalog],
      revalidate: false,
      query: { q, limit: LIMIT },
    });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ApiError && error.status === 422 ? 400 : 502;
    return Response.json({ error: "search_unavailable" }, { status });
  }
}
