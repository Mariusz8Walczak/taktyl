// I-014 (docs/24): narzedzia MCP front office. Cienkie nakladki na publiczne API /v1 (docs/16 §2): zadnej logiki biznesowej,
// zadnego dostepu do bazy, zadnych sciezek backpanelu. Odpowiedzi walidowane schematami z @taktyl/contracts.
// Wszystkie narzedzia sa tylko do odczytu (takze wycena koszyka); zapisujace sa w osobnej grupie za flaga ALLOW_ORDERS.
import {
  categoriesResponseSchema,
  colorsResponseSchema,
  configuratorDataSchema,
  configuratorQuoteSchema,
  completeSetResponseSchema,
  contentPageSchema,
  facetsResponseSchema,
  faqSchema,
  guideListSchema,
  listingResponseSchema,
  orderCreatedSchema,
  orderDetailSchema,
  orderListSchema,
  paymentSimulateResponseSchema,
  pickupPointsResponseSchema,
  presetsResponseSchema,
  productSchema,
  publicShopSettingsSchema,
  quoteResponseSchema,
  reviewsResponseSchema,
  rulesSchema,
  searchResponseSchema,
  shippingEstimateResponseSchema,
  switchesResponseSchema,
} from "@taktyl/contracts";
import {
  categoryParam,
  defineTool,
  orderNumberParam,
  queryRecord,
  seg,
  skuParam,
  slugParam,
  type ApiClient,
  type Tool,
} from "@taktyl/mcp-core";
import { z } from "zod";

const FILTER_HELP =
  'Filtry jak w adresie sklepu (docs/04 §6), wartosci po przecinku: rozmiar, przelacznik, lacznosc, obudowa, kolor, waga, ksztalt, reka, typ, powierzchnia, hotswap=1, dostepnosc=1, cena=OD-DO (w GROSZACH), dlon=19.5. Przyklad: {"rozmiar":"75,tkl","cena":"30000-70000"}.';

const filters = queryRecord.optional().describe(FILTER_HELP);

/** Narzedzia tylko do odczytu (plus wycena koszyka, ktora niczego nie zapisuje). */
export function readTools(api: ApiClient): Tool[] {
  return [
    defineTool({
      name: "list_categories",
      title: "Kategorie sklepu",
      description:
        "Kategorie (klawiatury, myszki, podkladki): nazwa, H1, wstep, liczba modeli, cena od.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/categories", { schema: categoriesResponseSchema }),
    }),
    defineTool({
      name: "list_products",
      title: "Lista produktow kategorii",
      description:
        "Karty produktow kategorii z filtrami, sortowaniem i kursorem (Pokaz wiecej). Ceny w groszach. " +
        FILTER_HELP,
      risk: "read",
      inputSchema: {
        category: categoryParam,
        filters,
        sort: z
          .enum(["polecane", "cena-rosnaco", "cena-malejaco", "nowosci", "najlzejsze"])
          .optional()
          .describe("Sortowanie; najlzejsze tylko dla myszek. Domyslnie polecane."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(48)
          .optional()
          .describe("Liczba kart (1-48, domyslnie 12)."),
        cursor: z
          .string()
          .min(1)
          .max(512)
          .optional()
          .describe("next_cursor z poprzedniej odpowiedzi."),
      },
      run: (i) =>
        api.get("/v1/products", {
          query: {
            category: i.category,
            sort: i.sort,
            limit: i.limit,
            cursor: i.cursor,
            ...(i.filters ?? {}),
          },
          schema: listingResponseSchema,
        }),
    }),
    defineTool({
      name: "get_product",
      title: "Szczegoly produktu",
      description:
        "Pelny produkt: atrybuty, warianty (SKU, cena w groszach, stan, najnizsza cena z 30 dni przy promocji), zdjecia, plakietki, zawartosc zestawu, GPSR. Parametr sku wybiera wariant.",
      risk: "read",
      inputSchema: { slug: slugParam, sku: skuParam.optional() },
      run: (i) =>
        api.get(`/v1/products/${seg(i.slug)}`, { query: { sku: i.sku }, schema: productSchema }),
    }),
    defineTool({
      name: "get_complete_set",
      title: "Propozycja Dokoncz set",
      description:
        "Dla produktu proponuje dwie pozostale kategorie dobrane wg dopasowania do profilu oraz cene setu z rabatem (w groszach).",
      risk: "read",
      inputSchema: {
        slug: slugParam,
        sku: skuParam.optional(),
        profile: z
          .string()
          .regex(/^[a-z-]{2,30}$/)
          .optional()
          .describe("Profil z get_rules, np. gry, programowanie."),
      },
      run: (i) =>
        api.get(`/v1/products/${seg(i.slug)}/complete-set`, {
          query: { sku: i.sku, profile: i.profile },
          schema: completeSetResponseSchema,
        }),
    }),
    defineTool({
      name: "get_facets",
      title: "Facety kategorii",
      description:
        "Dostepne filtry kategorii z licznikami przy wartosciach liczonymi z aktywnymi filtrami (wartosci z zerem wynikow maja disabled=true). " +
        FILTER_HELP,
      risk: "read",
      inputSchema: { category: categoryParam, filters },
      run: (i) =>
        api.get("/v1/facets", {
          query: { category: i.category, ...(i.filters ?? {}) },
          schema: facetsResponseSchema,
        }),
    }),
    defineTool({
      name: "search_catalog",
      title: "Wyszukiwanie",
      description:
        "Wyszukuje produkty, kategorie i poradniki (normalizacja polskich znakow i synonimy; np. 'lupek' znajduje 'Lupek').",
      risk: "read",
      inputSchema: {
        q: z.string().trim().min(1).max(80).describe("Fraza, 1-80 znakow."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maks. liczba produktow (domyslnie 8)."),
      },
      run: (i) =>
        api.get("/v1/search", { query: { q: i.q, limit: i.limit }, schema: searchResponseSchema }),
    }),
    defineTool({
      name: "list_switches",
      title: "Przelaczniki",
      description: "Slownik przelacznikow (nazwa, typ, opis) uzywany w wariantach klawiatur.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/switches", { schema: switchesResponseSchema }),
    }),
    defineTool({
      name: "list_colors",
      title: "Kolory",
      description: "Slownik kolorow wariantow z etykieta i probka (swatch).",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/colors", { schema: colorsResponseSchema }),
    }),
    defineTool({
      name: "get_rules",
      title: "Reguly kreatora setu",
      description:
        "Profile uzytkownika, strefy myszki i reguly dopasowania wraz z komunikatami (dla kreatora Zbuduj set).",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/rules", { schema: rulesSchema }),
    }),
    defineTool({
      name: "list_presets",
      title: "Gotowe sety",
      description: "Gotowe sety z cena policzona na biezaco: suma, rabat, razem (grosze).",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/presets", { schema: presetsResponseSchema }),
    }),
    defineTool({
      name: "quote_cart",
      title: "Wycena koszyka",
      description:
        'Wycena koszyka po stronie serwera (niczego nie zapisuje): ceny, rabat setu, kod rabatowy, dostawa, razem i problemy (brak towaru, zmiana ceny). Pozycje to tylko SKU i ilosci; ceny zawsze liczy serwer. Przyklad items: [{"type":"item","sku":"M-PST-GRF","qty":1}] albo set: {"type":"set","id":"s1","qty":1,"skus":[klawiatura,myszka,podkladka]}.',
      risk: "read",
      inputSchema: {
        items: z
          .array(
            z.union([
              z.object({
                type: z.literal("item"),
                sku: skuParam,
                qty: z.number().int().min(1).max(10),
              }),
              z.object({
                type: z.literal("set"),
                id: z.string().min(1).max(64),
                qty: z.number().int().min(1).max(10),
                profile: z
                  .string()
                  .regex(/^[a-z-]{2,30}$/)
                  .nullable()
                  .optional(),
                skus: z.array(skuParam).length(3),
              }),
            ]),
          )
          .min(1)
          .max(50),
        coupon: z
          .string()
          .regex(/^[A-Z0-9_-]{1,32}$/)
          .nullable()
          .optional()
          .describe("Kod rabatowy, np. TAKTYL10."),
        shipping_method: z
          .string()
          .regex(/^[a-z0-9_-]{2,30}$/)
          .nullable()
          .optional()
          .describe("Id metody dostawy z get_shop_settings."),
      },
      run: async (i) =>
        (await api.request("POST", "/v1/cart/quote", { body: i, schema: quoteResponseSchema }))
          .data,
    }),
    defineTool({
      name: "get_configurator",
      title: "Slowniki konfiguratora",
      description:
        "Slowniki konfiguratora kolorow 3D (ADR-0011): kolory, wykonczenia, przelaczniki, palety czesci, 26 modeli z lista czesci i nadruki podkladek. Czesci i palety okreslaja, co mozna podac w quote_configuration.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/configurator", { schema: configuratorDataSchema }),
    }),
    defineTool({
      name: "quote_configuration",
      title: "Wycena konfiguracji wlasnej",
      description:
        'Wycena i kod (SKU) konfiguracji wlasnej produktu (niczego nie zapisuje). Cena = model bazowy + doplaty za wykonczenie, liczona przez serwer. Wejscie: {"model":"k-kwarc-60","parts":{"obudowa":{"color":"turkus","finish":"polysk"}},"switch":"prog"}; pominiete czesci maja wartosci domyslne, nadruk klawiszy mozna ustawic na color:"auto". Zwrocony kod mozna wstawic do quote_cart jako SKU pozycji (pozycja na zamowienie, bez stanu).',
      risk: "read",
      inputSchema: {
        model: z.string().regex(/^[a-z0-9_-]{2,40}$/),
        parts: z
          .record(
            z.string().regex(/^[a-z0-9_-]{1,40}$/),
            z.object({
              color: z.string().regex(/^[a-z0-9-]{2,40}$/),
              finish: z.string().nullable(),
            }),
          )
          .default({}),
        print: z
          .string()
          .regex(/^[a-z0-9-]{2,40}$/)
          .nullable()
          .optional(),
        switch: z
          .string()
          .regex(/^[a-z0-9-]{2,40}$/)
          .nullable()
          .optional(),
      },
      run: async (i) =>
        (
          await api.request("POST", "/v1/configurator/quote", {
            body: {
              model: i.model,
              parts: i.parts,
              print: i.print ?? null,
              switch: i.switch ?? null,
            },
            schema: configuratorQuoteSchema,
          })
        ).data,
    }),
    defineTool({
      name: "get_shop_settings",
      title: "Ustawienia sklepu",
      description:
        "Ustawienia publiczne: prog darmowej dostawy, rabat setu, metody dostawy i platnosci, punkty odbioru, dni na zwrot, etykieta demo. Sklep jest demonstracyjny.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/shop-settings", { schema: publicShopSettingsSchema }),
    }),
    defineTool({
      name: "get_shipping_estimate",
      title: "Termin wysylki i dostawy",
      description: "Termin wysylki i dostawy dla metody dostawy (strefa Europe/Warsaw).",
      risk: "read",
      inputSchema: {
        method: z
          .string()
          .regex(/^[a-z0-9_-]{2,30}$/)
          .describe("Id metody z get_shop_settings, np. kurier."),
      },
      run: (i) =>
        api.get("/v1/shipping-estimate", {
          query: { method: i.method },
          schema: shippingEstimateResponseSchema,
        }),
    }),
    defineTool({
      name: "list_pickup_points",
      title: "Punkty odbioru",
      description: "Fikcyjne punkty odbioru; opcjonalny filtr miasta.",
      risk: "read",
      inputSchema: { city: z.string().trim().min(1).max(60).optional() },
      run: (i) =>
        api.get("/v1/pickup-points", {
          query: { city: i.city },
          schema: pickupPointsResponseSchema,
        }),
    }),
    defineTool({
      name: "get_info_page",
      title: "Strona informacyjna lub prawna",
      description:
        "Tresc strony informacyjnej lub prawnej (wzor dla sklepu demonstracyjnego) po slugu, np. regulamin.",
      risk: "read",
      inputSchema: { slug: slugParam },
      run: (i) => api.get(`/v1/content/pages/${seg(i.slug)}`, { schema: contentPageSchema }),
    }),
    defineTool({
      name: "list_guides",
      title: "Lista poradnikow",
      description: "Opublikowane poradniki (slug, tytul, lead, profil), najnowsze pierwsze.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/content/guides", { schema: guideListSchema }),
    }),
    defineTool({
      name: "get_guide",
      title: "Poradnik",
      description: "Pelny artykul poradnika po slugu (Markdown po sanityzacji).",
      risk: "read",
      inputSchema: { slug: slugParam },
      run: (i) => api.get(`/v1/content/guides/${seg(i.slug)}`, { schema: contentPageSchema }),
    }),
    defineTool({
      name: "get_faq",
      title: "FAQ",
      description: "Opublikowane pytania i odpowiedzi w ustalonej kolejnosci.",
      risk: "read",
      inputSchema: {},
      run: () => api.get("/v1/content/faq", { schema: faqSchema }),
    }),
    defineTool({
      name: "get_product_reviews",
      title: "Opinie o produkcie",
      description: "Opinie przykladowe (demonstracyjne) produktu: srednia, liczba i lista.",
      risk: "read",
      inputSchema: { slug: slugParam },
      run: (i) => api.get(`/v1/products/${seg(i.slug)}/reviews`, { schema: reviewsResponseSchema }),
    }),
  ];
}

const orderTokenParam = z
  .string()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9_.~-]+$/)
  .describe(
    "order_token zwrocony przy zakladaniu zamowienia (jedyny dowod dostepu do zamowienia).",
  );

/**
 * Narzedzia zapisujace (zalozenie zamowienia, symulacja platnosci). Domyslnie WYLACZONE (TAKTYL_MCP_ALLOW_ORDERS=true):
 * otwarty endpoint nie moze pozwalac kazdemu zakladac zamowien. Dane osobowe trafiaja do API wylacznie z wywolania.
 */
export function orderTools(api: ApiClient): Tool[] {
  return [
    defineTool({
      name: "create_order",
      title: "Zalozenie zamowienia (demo)",
      description:
        "Zaklada zamowienie demonstracyjne (status pending_payment) i zwraca order_token. Wymaga klucza idempotencji (UUID); to samo zadanie z tym samym kluczem zwraca ten sam wynik. Dane kontaktowe i adres podaje wywolujacy (tylko adresy @taktyl.example i dane fikcyjne). Sklep nie przyjmuje danych kart ani kodow BLIK. Ciało `order` jak w POST /v1/orders (docs/16 §2): items, contact, shipping, invoice?, payment_type, consents {terms:true}, expected_total_gr (suma z quote_cart).",
      risk: "write",
      idempotent: true,
      inputSchema: {
        idempotency_key: z.uuid().describe("Klucz idempotencji (UUID v4)."),
        order: z.record(z.string(), z.unknown()).describe("Cialo zamowienia jak w docs/16 §2."),
      },
      run: async (i) =>
        (
          await api.request("POST", "/v1/orders", {
            body: i.order,
            headers: { "idempotency-key": i.idempotency_key },
            schema: orderCreatedSchema,
          })
        ).data,
    }),
    defineTool({
      name: "get_order",
      title: "Odczyt zamowienia po tokenie",
      description: "Odczyt zamowienia wlasciciela tokenu: pozycje, kwoty, status i historia.",
      risk: "read",
      inputSchema: { number: orderNumberParam, order_token: orderTokenParam },
      run: (i) =>
        api.get(`/v1/orders/${seg(i.number)}`, {
          headers: { "x-order-token": i.order_token },
          schema: orderDetailSchema,
        }),
    }),
    defineTool({
      name: "list_orders",
      title: "Lista zamowien po tokenach",
      description: "Lista zamowien dla jednego lub wielu tokenow (konto demo).",
      risk: "read",
      inputSchema: { order_tokens: z.array(orderTokenParam).min(1).max(20) },
      run: (i) =>
        api.get("/v1/orders", {
          headers: { "x-order-token": i.order_tokens.join(",") },
          schema: orderListSchema,
        }),
    }),
    defineTool({
      name: "simulate_payment",
      title: "Symulacja platnosci (demo)",
      description:
        "Symuluje wynik platnosci zamowienia demonstracyjnego: paid (zmniejsza stany magazynowe, ustawia status paid) albo failed. To nie jest prawdziwa platnosc.",
      risk: "write",
      idempotent: false,
      inputSchema: {
        number: orderNumberParam,
        order_token: orderTokenParam,
        outcome: z.enum(["paid", "failed"]),
      },
      run: async (i) =>
        (
          await api.request("POST", `/v1/orders/${seg(i.number)}/payment/simulate`, {
            body: { outcome: i.outcome },
            headers: { "x-order-token": i.order_token },
            schema: paymentSimulateResponseSchema,
          })
        ).data,
    }),
  ];
}

export function buildTools(api: ApiClient, allowOrders: boolean): Tool[] {
  return allowOrders ? [...readTools(api), ...orderTools(api)] : readTools(api);
}
