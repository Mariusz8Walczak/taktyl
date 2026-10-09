// F-253 (ADR-0011): wycena konfiguracji bez cache; przekazanie do `POST /v1/configurator/quote`. Cena zawsze z API.
import { proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/configurator/quote", "POST");
}
