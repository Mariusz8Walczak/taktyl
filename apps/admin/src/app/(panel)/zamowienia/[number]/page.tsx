// B-202..B-205 (TAKTYL-52): /zamowienia/{numer}.
import { OrderDetail } from "../../../../components/zamowienia/order-detail";

export const metadata = { title: "Zamówienie" };

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <OrderDetail number={number} />;
}
