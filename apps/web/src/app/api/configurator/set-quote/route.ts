// F-255 (ADR-0011): wycena wlasnego setu bez cache; przekazanie do `POST /v1/configurator/set-quote`.
import { proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/configurator/set-quote", "POST");
}
