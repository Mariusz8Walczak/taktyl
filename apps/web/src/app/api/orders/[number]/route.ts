// F-178 (docs/16 §2): odczyt zamowienia wlasciciela tokenu (X-Order-Token przekazywany do API).
import { ORDER_NUMBER, problem, proxyToApi } from "../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const { number } = await params;
  if (!ORDER_NUMBER.test(number)) return problem(404, "not_found", "Nie znaleziono zamówienia.");
  return proxyToApi(request, `/v1/orders/${number}`, "GET");
}
