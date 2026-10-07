// F-177...F-179 (docs/16 §6.3): symulacja platnosci `{ outcome: "paid" | "failed" }`; zero danych kart i kodow BLIK.
import { ORDER_NUMBER, problem, proxyToApi } from "../../../../../lib/cart/server-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  const { number } = await params;
  if (!ORDER_NUMBER.test(number)) return problem(404, "not_found", "Nie znaleziono zamówienia.");
  return proxyToApi(request, `/v1/orders/${number}/payment/simulate`, "POST");
}
