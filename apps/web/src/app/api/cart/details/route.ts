// F-150, F-151, F-256 (audyt P1-4): opis pozycji koszyka (miniatura, nazwa wariantu, czesci konfiguracji) dla SKU
// z koszyka w przegladarce. Dane z tego samego zrodla co kreator i konfigurator (znaczniki product:{slug}, catalog);
// BEZ cen - cena pozycji zawsze z wyceny (`POST /api/cart/quote`, F-157).
import { createModel } from "../../../../lib/builder/catalog";
import { loadBuilderData } from "../../../../lib/builder/data";
import { cartSkuDetails } from "../../../../lib/cart/details";
import { getConfiguratorData } from "../../../../lib/configurator/data";

export const dynamic = "force-dynamic";
const SKU = /^[A-Z0-9.-]{5,120}$/;
const MAX = 50;

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("skus") ?? "";
  const skus = [...new Set(raw.split(",").filter(Boolean))];
  if (skus.length === 0 || skus.length > MAX || !skus.every((s) => SKU.test(s))) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }
  try {
    const [data, configurator] = await Promise.all([
      loadBuilderData(),
      skus.some((s) => s.includes("-CFG-"))
        ? getConfiguratorData().catch(() => null)
        : Promise.resolve(null),
    ]);
    const details = cartSkuDetails(skus, createModel(data), configurator);
    return Response.json(details, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return Response.json({ error: "details_unavailable" }, { status: 502 });
  }
}
