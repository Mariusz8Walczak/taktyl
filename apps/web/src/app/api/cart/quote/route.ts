// F-150...F-157 (docs/16 §6.1): wycena koszyka bez cache; przekazanie do `POST /v1/cart/quote`.
import { proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/cart/quote", "POST");
}
