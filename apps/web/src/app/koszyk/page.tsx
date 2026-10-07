// F-151...F-157 (docs/05 §6): strona /koszyk. Ustawienia sklepu (prog dostawy, kody, rabat setu) czyta serwer,
// koszyk i wycena zyja w wyspie klienckiej (koszyk jest w przegladarce, ADR-0007).
import type { Metadata } from "next";
import { CartPage } from "../../components/cart/cart-page";
import { getShopSettings } from "../../lib/api";

export const metadata: Metadata = { title: "Koszyk" };

export default async function CartRoute() {
  const settings = await getShopSettings();
  const paid = settings.shipping_methods.map((m) => m.price_gr).filter((p) => p > 0);
  return (
    <CartPage
      settings={{
        freeShippingThresholdGr: settings.free_shipping_threshold_gr,
        shippingFromGr: paid.length ? Math.min(...paid) : 0,
        codes: settings.discount_codes,
        setDiscountPercent: settings.set_discount.percent,
      }}
    />
  );
}
