// F-040, F-151...F-157, F-069 (docs/05 §6): strona /koszyk. Ustawienia sklepu (prog dostawy, kody, rabat setu) czyta serwer,
// koszyk i wycena zyja w wyspie klienckiej (koszyk jest w przegladarce, ADR-0007).
import type { Metadata } from "next";
import { Featured } from "../../components/home/featured";
import { CartPage } from "../../components/cart/cart-page";
import { getShopSettings } from "../../lib/api";
import "../../styles/home.css";

export const metadata: Metadata = { title: "Koszyk" };

export default async function CartRoute() {
  const settings = await getShopSettings();
  const paid = settings.shipping_methods.map((m) => m.price_gr).filter((p) => p > 0);
  return (
    <>
      <CartPage
        settings={{
          freeShippingThresholdGr: settings.free_shipping_threshold_gr,
          shippingFromGr: paid.length ? Math.min(...paid) : 0,
          codes: settings.discount_codes,
          setDiscountPercent: settings.set_discount.percent,
        }}
      />
      {/* docs/05 §6 pkt 6: pod lista "Polecane" (te same karty co na stronie glownej); "Dokoncz set" jest w wyspie */}
      <Featured />
    </>
  );
}
