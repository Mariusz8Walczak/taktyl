// F-202 (docs/05 §1): /konto/zamowienia - lista z `taktyl.orders.v1` i statusami z API (przez order_token).
import type { Metadata } from "next";
import { AccountGate } from "../../../components/account/account-gate";
import { OrdersList } from "../../../components/account/orders-list";
import { getShopSettings } from "../../../lib/api";

export const metadata: Metadata = { title: "Zamówienia" };

export default async function OrdersRoute() {
  const settings = await getShopSettings();
  return (
    <AccountGate current="zamowienia">
      <h2 className="konto__podtytul">Zamówienia</h2>
      <OrdersList timeZone={settings.timezone} />
    </AccountGate>
  );
}
