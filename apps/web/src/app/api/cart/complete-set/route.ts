// F-069, F-156 (docs/05 §6): "Dokoncz set" w koszyku. Koszyk niesie tylko SKU, a `complete-set` wymaga sluga produktu,
// wiec serwer znajduje slug po nazwie (`/v1/search`, dokladne dopasowanie nazwy) i pyta `complete-set?sku=`.
import { completeSetResponseSchema, searchResponseSchema } from "@taktyl/contracts";
import { ApiError, TAG, apiGet } from "../../../../lib/api";

export const dynamic = "force-dynamic";
const SKU = /^[A-Z0-9-]{5,32}$/;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku") ?? "";
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!SKU.test(sku) || name.length < 1 || name.length > 80) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }
  try {
    const found = await apiGet("/v1/search", searchResponseSchema, {
      tags: [TAG.catalog],
      revalidate: false,
      query: { q: name, limit: 20 },
    });
    const card = found.products.find((p) => p.name === name);
    if (!card) return Response.json({ error: "not_found" }, { status: 404 });
    const set = await apiGet(`/v1/products/${card.slug}/complete-set`, completeSetResponseSchema, {
      tags: [TAG.catalog],
      revalidate: false,
      query: { sku },
    });
    return Response.json(set, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ApiError && error.status === 404 ? 404 : 502;
    return Response.json({ error: "complete_set_unavailable" }, { status });
  }
}
