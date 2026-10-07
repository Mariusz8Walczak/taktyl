// F-221 (docs/16 §2, WEB-002): przekazanie formularza kontaktowego z przegladarki do POST /v1/forms/contact.
// Bez cache, bez logowania tresci. Limit 5/min/IP liczy API (X-Forwarded-For przekazuje proxyToApi).
import { proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/forms/contact", "POST");
}
