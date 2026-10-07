// F-223 (docs/16 §2, WEB-002): przekazanie zapisu do newslettera do POST /v1/forms/newsletter.
// Bez cache, bez logowania tresci. Limit 5/min/IP liczy API (osobny licznik niz kontakt).
import { proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/forms/newsletter", "POST");
}
