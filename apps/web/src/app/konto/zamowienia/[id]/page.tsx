// F-202 (docs/05 §1): /konto/zamowienia/{id} - szczegoly zamowienia. Zamowienie czyta wyspa tokenem z tej przegladarki.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountGate } from "../../../../components/account/account-gate";
import { OrderDetailView } from "../../../../components/account/order-detail";
import { getShopSettings } from "../../../../lib/api";
import { toOrderPageSettings } from "../../../../lib/cart/order-page-settings";
import { ORDER_NUMBER } from "../../../../lib/cart/server-proxy";

export const metadata: Metadata = { title: "Szczegóły zamówienia" };

export default async function OrderRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, settings] = await Promise.all([params, getShopSettings()]);
  if (!ORDER_NUMBER.test(id)) notFound();
  return (
    <AccountGate current="zamowienia">
      <OrderDetailView number={id} settings={toOrderPageSettings(settings)} />
    </AccountGate>
  );
}
