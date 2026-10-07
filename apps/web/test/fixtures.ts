// Ustawienia publiczne zgodne z data/shop.json i contracts (walidowane w api-client.test.ts).
import type { PublicShopSettings } from "@taktyl/contracts";

export const SHOP_SETTINGS: PublicShopSettings = {
  currency: "PLN",
  locale: "pl-PL",
  timezone: "Europe/Warsaw",
  free_shipping_threshold_gr: 29900,
  set_discount: { percent: 10, categories: ["klawiatury", "myszki", "podkladki"] },
  dispatch_cutoff_hour: 14,
  shipping_methods: [
    {
      id: "automat",
      label: "Automat paczkowy",
      price_gr: 1299,
      eta_business_days: 1,
      fields: ["email", "phone", "point"],
      address: null,
    },
    {
      id: "kurier",
      label: "Kurier",
      price_gr: 1699,
      eta_business_days: 1,
      fields: ["email", "phone", "name", "street", "postcode", "city"],
      address: null,
    },
    {
      id: "odbior",
      label: "Odbiór osobisty (Warszawa)",
      price_gr: 0,
      eta_business_days: 0,
      fields: ["email", "phone", "name"],
      address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
    },
  ],
  payment_methods: [
    { id: "blik", label: "BLIK" },
    { id: "karta", label: "Karta płatnicza" },
    { id: "przelew-online", label: "Szybki przelew" },
    { id: "przelew", label: "Przelew tradycyjny" },
  ],
  discount_codes: [{ code: "TAKTYL10", label: "−10% na produkty spoza setów" }],
  pickup_points: [
    {
      id: "WAW-001",
      city: "Warszawa",
      label: "WAW-001 · przy stacji metra (lokalizacja fikcyjna)",
    },
  ],
  returns_days: 30,
  statutory_withdrawal_days: 14,
  payment_simulation: true,
  demo: {
    label: "Taktyl to sklep demonstracyjny. Nie realizujemy zamówień i nie pobieramy płatności.",
    email_domain: "taktyl.example",
    phone: "+48 22 000 00 00",
  },
  company: {},
};
