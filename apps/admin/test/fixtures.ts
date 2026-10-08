// Dane testowe backpanelu: ksztalty zgodne z kontraktami @taktyl/contracts (wartosci przykladowe, adresy tylko taktyl.example).
import type { AdminProductDetail } from "@taktyl/contracts";

export const NOW_ISO = "2026-10-07T12:00:00+02:00";

const mouseAttributes = {
  shape: "symetryczna",
  hand: "prawa" as const,
  hand_note: null,
  size: "M" as const,
  hand_cm: [17, 19] as [number, number],
  grips: ["palm", "claw"] as ("palm" | "claw")[],
  weight_g: 59,
  dims_mm: { w: 62, d: 118, h: 38 },
  connectivity: ["2.4ghz", "bt"] as ("2.4ghz" | "bt")[],
  dpi_max: 26000,
  polling_hz: 1000,
  battery: "do 80 h",
  sensor: "optyczny 26 000 DPI",
};

/** Myszka Wrobel: wariant w promocji (129 zl, najnizsza z 30 dni 139 zl), jeden wariant ze stanem 2. */
export function wrobel(overrides: Partial<AdminProductDetail> = {}): AdminProductDetail {
  const base: AdminProductDetail = {
    id: "m-wrobel",
    slug: "wrobel",
    category: "myszki",
    name: "Wróbel",
    brand: "Taktyl",
    short: "Lekka myszka dla małej i średniej dłoni, symetryczna.",
    description: null,
    options: ["color"],
    default_variant_sku: "M-WRB-GRF",
    badges: [],
    fit: { fps: 3, gry: 3, programowanie: 1, biuro: 1, cisza: 1 },
    in_box: ["Myszka", "Kabel USB-C", "Instrukcja"],
    gpsr: {
      manufacturer: "Taktyl (podmiot fikcyjny)",
      address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
      contact: "kontakt@taktyl.example",
      warnings: "Brak",
    },
    attributes: mouseAttributes,
    variants: [
      {
        sku: "M-WRB-GRF",
        color: "grafit",
        switch: null,
        size: null,
        price_gr: 12900,
        lowest_30d_gr: 13900,
        stock: 12,
        images_key: "grafit",
        status: "active",
        regular_price_gr: 14900,
        version: 3,
      },
      {
        sku: "M-WRB-MGL",
        color: "mgla",
        switch: null,
        size: null,
        price_gr: 12900,
        lowest_30d_gr: null,
        stock: 2,
        images_key: "mgla",
        status: "active",
        regular_price_gr: null,
        version: 1,
      },
    ],
    images: [],
    status: "active",
    version: 5,
    updated_at: NOW_ISO,
    warnings: [],
  } as AdminProductDetail;
  return { ...base, ...overrides } as AdminProductDetail;
}

export const priceHistory = {
  sku: "M-WRB-GRF",
  // API zwraca wpisy od najnowszego (TAKTYL-82)
  entries: [
    {
      price_gr: 12900,
      valid_from: "2026-10-05T12:00:00+02:00",
      valid_to: null,
      changed_by: "editor@taktyl.example",
      reason: null,
    },
    {
      price_gr: 13900,
      valid_from: "2026-07-09T12:00:00+02:00",
      valid_to: "2026-10-05T12:00:00+02:00",
      changed_by: null,
      reason: null,
    },
  ],
  lowest_30d_gr: 13900,
  window: { from: "2026-09-05T12:00:00+02:00", to: "2026-10-07T12:00:00+02:00" },
};

export function productRow(over: Record<string, unknown> = {}) {
  return {
    id: "m-wrobel",
    slug: "wrobel",
    category: "myszki",
    name: "Wróbel",
    status: "active",
    variant_count: 2,
    from_price_gr: 12900,
    total_stock: 14,
    missing_images: 2,
    badges: [],
    on_sale: true,
    version: 5,
    updated_at: NOW_ISO,
    ...over,
  };
}

export function orderDetail(over: Record<string, unknown> = {}) {
  return {
    number: "TK-261007-AB12",
    status: "paid",
    currency: "PLN",
    created_at: NOW_ISO,
    items: [
      {
        group_id: null,
        sku: "M-WRB-GRF",
        name: "Wróbel",
        variant_label: "Grafit",
        qty: 1,
        unit_price_gr: 12900,
        set_discount_gr: 0,
        coupon_discount_gr: 0,
      },
      {
        group_id: "set-1",
        sku: "K-BZL75-GRF-PRG",
        name: "Bazalt 75",
        variant_label: "Grafit, Próg",
        qty: 1,
        unit_price_gr: 74900,
        set_discount_gr: 7490,
        coupon_discount_gr: 0,
      },
    ],
    items_gr: 87800,
    set_discount_gr: 7490,
    coupon_discount_gr: 0,
    shipping_gr: 1299,
    total_gr: 81609,
    coupon_code: null,
    shipping_method: "kurier",
    payment: { type: "blik", status: "paid", attempts: 1 },
    eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
    contact: { email: "j***@taktyl.example", phone: "+48 *** *** 123" },
    shipping_address: { name: "J*** P***", street: "***", postcode: "**-***", city: "***" },
    invoice: null,
    internal_note: null,
    notes: [],
    allowed_transitions: ["processing", "cancelled"],
    history: [
      { from: null, to: "pending_payment", actor: "system", note: null, at: NOW_ISO },
      {
        from: "pending_payment",
        to: "paid",
        actor: "system",
        note: "Symulacja płatności",
        at: NOW_ISO,
      },
    ],
    ...over,
  };
}

export function settings(over: Record<string, unknown> = {}) {
  return {
    currency: "PLN",
    locale: "pl-PL",
    timezone: "Europe/Warsaw",
    free_shipping_threshold_gr: 30000,
    set_discount: { percent: 10, categories: ["klawiatury", "myszki", "podkladki"] },
    dispatch_cutoff_hour: 14,
    shipping_methods: [
      {
        id: "automat",
        label: "Automat paczkowy",
        price_gr: 999,
        eta_business_days: 1,
        fields: ["email", "phone", "point"],
        address: null,
        active: true,
      },
      {
        id: "kurier",
        label: "Kurier",
        price_gr: 1299,
        eta_business_days: 1,
        fields: ["email", "phone", "name", "street", "postcode", "city"],
        address: null,
        active: true,
      },
      {
        id: "odbior",
        label: "Odbiór osobisty",
        price_gr: 0,
        eta_business_days: 1,
        fields: ["email", "phone", "name"],
        address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
        active: true,
      },
    ],
    payment_methods: [
      { id: "blik", label: "BLIK", active: true },
      { id: "karta", label: "Karta płatnicza", active: true },
      { id: "przelew-online", label: "Przelew online", active: false },
    ],
    discount_codes: [
      {
        code: "TAKTYL10",
        type: "percent",
        value: 10,
        scope: "non-set",
        label: "Rabat 10%",
        active: true,
        valid_from: null,
        valid_to: null,
      },
    ],
    pickup_points: [
      {
        id: "WAW-001",
        city: "Warszawa",
        label: "Automat Warszawa 1 (adres fikcyjny, 00-000)",
        active: true,
      },
      {
        id: "KRK-001",
        city: "Kraków",
        label: "Automat Kraków 1 (adres fikcyjny, 00-000)",
        active: true,
      },
    ],
    returns_days: 30,
    statutory_withdrawal_days: 14,
    payment_simulation: true,
    demo: {
      label: "Taktyl to sklep demonstracyjny. Nic tu nie jest prawdziwe.",
      email_domain: "taktyl.example",
      phone: "+48 22 000 00 00",
    },
    company: { name: "Taktyl (podmiot fikcyjny)" },
    version: 4,
    updated_at: NOW_ISO,
    ...over,
  };
}
