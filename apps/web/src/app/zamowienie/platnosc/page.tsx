// F-177 (docs/05 §7): `/zamowienie/platnosc?id=`. Zamowienie czyta wyspa kliencka tokenem z tej przegladarki.
import type { Metadata } from "next";
import { PaymentPage } from "../../../components/checkout/order-pages";
import { getShopSettings } from "../../../lib/api";
import { idParam, toOrderPageSettings } from "../../../lib/cart/order-page-settings";

export const metadata: Metadata = { title: "Płatność" };

export default async function Route({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const [{ id }, settings] = await Promise.all([searchParams, getShopSettings()]);
  return <PaymentPage number={idParam(id)} settings={toOrderPageSettings(settings)} />;
}
