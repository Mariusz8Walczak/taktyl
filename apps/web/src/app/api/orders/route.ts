// F-170...F-176 (docs/16 §6.2): utworzenie zamowienia (Idempotency-Key przekazywany do API).
import { proxyToApi } from "../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return proxyToApi(request, "/v1/orders", "POST");
}
