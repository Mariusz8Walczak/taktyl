// F-177...F-179: ustawienia sklepu potrzebne stronom platnosci i statusow (etykiety metod, adres odbioru, strefa).
import type { PublicShopSettings } from "@taktyl/contracts";
import type { OrderPageSettings } from "../../components/checkout/order-pages";

export function toOrderPageSettings(s: PublicShopSettings): OrderPageSettings {
  return {
    paymentLabels: Object.fromEntries(s.payment_methods.map((p) => [p.id, p.label])),
    shippingLabels: Object.fromEntries(s.shipping_methods.map((m) => [m.id, m.label])),
    shippingAddresses: Object.fromEntries(s.shipping_methods.map((m) => [m.id, m.address])),
    timeZone: s.timezone,
    demoLabel: s.demo.label,
  };
}

/** Parametr `?id=` z adresu: pierwszy element, tylko tekst. */
export function idParam(id: string | string[] | undefined): string | null {
  const v = Array.isArray(id) ? id[0] : id;
  return v ? v.slice(0, 32) : null;
}
