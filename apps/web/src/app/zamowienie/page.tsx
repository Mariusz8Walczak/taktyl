// F-170...F-176 (docs/05 §7): strona /zamowienie. Ustawienia (metody dostawy i platnosci, punkty odbioru, etykieta demo)
// czyta serwer; formularz i wycena zyja w wyspie klienckiej (koszyk jest w przegladarce, ADR-0007).
import type { Metadata } from "next";
import { CheckoutForm } from "../../components/checkout/checkout-form";
import { getShopSettings } from "../../lib/api";

export const metadata: Metadata = { title: "Zamówienie" };

export default async function CheckoutRoute() {
  const s = await getShopSettings();
  return (
    <CheckoutForm
      settings={{
        shippingMethods: s.shipping_methods.map((m) => ({
          id: m.id,
          label: m.label,
          priceGr: m.price_gr,
          fields: m.fields,
          address: m.address,
        })),
        paymentMethods: s.payment_methods,
        pickupPoints: s.pickup_points,
        demoLabel: s.demo.label,
        demoEmailDomain: s.demo.email_domain,
      }}
    />
  );
}
