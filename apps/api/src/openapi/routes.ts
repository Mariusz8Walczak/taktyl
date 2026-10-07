// B-231 (docs/16 par. 2): rejestr udokumentowanych endpointow. Schematy to schematy z @taktyl/contracts (zrodlo prawdy);
// test sprawdza, ze rejestr pokrywa dokladnie trasy zarejestrowane w Nest (w obie strony).
import {
  adminUserSchema,
  auditListQuerySchema,
  auditListSchema,
  categoriesResponseSchema,
  colorsResponseSchema,
  completeSetQuerySchema,
  completeSetResponseSchema,
  createUserRequestSchema,
  facetsQuerySchema,
  facetsResponseSchema,
  listingQuerySchema,
  listingResponseSchema,
  loginRequestSchema,
  orderCreatedSchema,
  orderDetailSchema,
  orderListSchema,
  orderRequestSchema,
  paymentSimulateRequestSchema,
  paymentSimulateResponseSchema,
  pickupPointsQuerySchema,
  pickupPointsResponseSchema,
  presetsResponseSchema,
  productQuerySchema,
  productSchema,
  publicShopSettingsSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  rulesSchema,
  searchQuerySchema,
  searchResponseSchema,
  sessionResponseSchema,
  shippingEstimateQuerySchema,
  shippingEstimateResponseSchema,
  switchesResponseSchema,
  updateUserRequestSchema,
  updateUserResponseSchema,
  usersResponseSchema,
  type Role,
} from "@taktyl/contracts";
import type { z } from "zod";

export interface HeaderDoc {
  name: string;
  required: boolean;
  description: string;
}

export interface RouteDoc {
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Sciezka w stylu OpenAPI, z prefiksem /v1 (poza health). */
  path: string;
  summary: string;
  tag: string;
  /** Funkcje i zadania z docs/16 par. 2 (kolumna ID). */
  ids: string[];
  query?: z.ZodType;
  body?: z.ZodType;
  pathParams?: Record<string, string>;
  headers?: HeaderDoc[];
  /** Kod odpowiedzi sukcesu, schemat odpowiedzi. */
  success: { status: number; schema?: z.ZodType; description: string };
  /** Dodatkowe kody bledow poza wspolnymi (docs/16 par. 2). */
  errors?: { status: number; code: string }[];
  noStore?: boolean;
  /** orderToken = X-Order-Token (publiczne zamowienia); session = ciasteczko sesji backpanelu (+ X-CSRF-Token przy mutacji). */
  security?: "orderToken" | "session";
  /** Minimalna rola trasy admina (docs/16 par. 1.2). */
  role?: Role;
}

/** B-003: naglowek CSRF wymagany przy kazdej mutacji admina (dokladany w builderze). */
export const CSRF_HEADER: HeaderDoc = {
  name: "X-CSRF-Token",
  required: true,
  description: "Token CSRF zwrocony w csrf_token odpowiedzi logowania lub GET /v1/admin/auth/me.",
};

const ORDER_TOKEN: HeaderDoc = {
  name: "X-Order-Token",
  required: true,
  description:
    "Token zamowienia zwrocony w POST /v1/orders (lista zamowien przyjmuje kilka tokenow po przecinku).",
};

export const ROUTES: RouteDoc[] = [
  {
    method: "get",
    path: "/health",
    summary: "Liveness",
    tag: "health",
    ids: ["B-230"],
    success: { status: 200, description: "Proces zyje." },
  },
  {
    method: "get",
    path: "/health/ready",
    summary: "Readiness: baza, migracje, kolejka outbox",
    tag: "health",
    ids: ["B-230"],
    success: { status: 200, description: "Gotowe do ruchu." },
    errors: [{ status: 503, code: "internal_error" }],
  },
  {
    method: "get",
    path: "/ready",
    summary: "Readiness (alias /health/ready)",
    tag: "health",
    ids: ["B-230"],
    success: { status: 200, description: "Gotowe do ruchu." },
    errors: [{ status: 503, code: "internal_error" }],
  },
  {
    method: "get",
    path: "/v1/categories",
    summary: "Kategorie z liczba modeli i cena od",
    tag: "katalog",
    ids: ["F-020", "F-002"],
    success: { status: 200, schema: categoriesResponseSchema, description: "Kategorie." },
  },
  {
    method: "get",
    path: "/v1/products",
    summary: "Lista produktow kategorii z filtrami, sortowaniem i kursorem",
    tag: "katalog",
    ids: ["F-020", "F-021", "F-022", "F-023", "F-024", "F-025", "F-026"],
    query: listingQuerySchema,
    success: { status: 200, schema: listingResponseSchema, description: "Strona listingu." },
    errors: [{ status: 404, code: "not_found" }],
  },
  {
    method: "get",
    path: "/v1/products/{slug}",
    summary: "Pelny produkt (?sku= wybiera wariant)",
    tag: "katalog",
    ids: ["F-060", "F-078"],
    pathParams: { slug: "Slug produktu, np. granit-tkl" },
    query: productQuerySchema,
    success: { status: 200, schema: productSchema, description: "Produkt." },
    errors: [{ status: 404, code: "not_found" }],
  },
  {
    method: "get",
    path: "/v1/products/{slug}/complete-set",
    summary: "Propozycja Dokoncz set",
    tag: "katalog",
    ids: ["F-069"],
    pathParams: { slug: "Slug produktu" },
    query: completeSetQuerySchema,
    success: {
      status: 200,
      schema: completeSetResponseSchema,
      description: "Set z cena po rabacie.",
    },
    errors: [{ status: 404, code: "not_found" }],
  },
  {
    method: "get",
    path: "/v1/facets",
    summary: "Facety kategorii z licznikami",
    tag: "katalog",
    ids: ["F-021", "F-029"],
    query: facetsQuerySchema,
    success: { status: 200, schema: facetsResponseSchema, description: "Facety." },
    errors: [{ status: 404, code: "not_found" }],
  },
  {
    method: "get",
    path: "/v1/search",
    summary: "Wyszukiwanie produktow, kategorii i poradnikow",
    tag: "katalog",
    ids: ["F-005", "F-006", "F-007"],
    query: searchQuerySchema,
    success: { status: 200, schema: searchResponseSchema, description: "Wyniki." },
  },
  {
    method: "get",
    path: "/v1/switches",
    summary: "Przelaczniki",
    tag: "slowniki",
    ids: ["F-062", "F-074"],
    success: { status: 200, schema: switchesResponseSchema, description: "Przelaczniki." },
  },
  {
    method: "get",
    path: "/v1/colors",
    summary: "Kolory z probkami",
    tag: "slowniki",
    ids: ["F-062", "F-115"],
    success: { status: 200, schema: colorsResponseSchema, description: "Kolory." },
  },
  {
    method: "get",
    path: "/v1/rules",
    summary: "Profile i reguly dopasowania",
    tag: "slowniki",
    ids: ["F-101", "F-104"],
    success: { status: 200, schema: rulesSchema, description: "Reguly." },
  },
  {
    method: "get",
    path: "/v1/presets",
    summary: "Gotowe sety z cena liczona na biezaco",
    tag: "katalog",
    ids: ["F-111"],
    success: { status: 200, schema: presetsResponseSchema, description: "Presety." },
  },
  {
    method: "get",
    path: "/v1/shop-settings",
    summary: "Ustawienia publiczne sklepu",
    tag: "ustawienia",
    ids: ["F-001", "F-009", "F-073", "F-153"],
    success: { status: 200, schema: publicShopSettingsSchema, description: "Ustawienia." },
  },
  {
    method: "get",
    path: "/v1/shipping-estimate",
    summary: "Termin wysylki i dostawy",
    tag: "ustawienia",
    ids: ["F-065"],
    query: shippingEstimateQuerySchema,
    success: { status: 200, schema: shippingEstimateResponseSchema, description: "Termin." },
    errors: [{ status: 404, code: "not_found" }],
  },
  {
    method: "get",
    path: "/v1/pickup-points",
    summary: "Punkty odbioru",
    tag: "ustawienia",
    ids: ["F-172"],
    query: pickupPointsQuerySchema,
    success: { status: 200, schema: pickupPointsResponseSchema, description: "Punkty." },
  },
  {
    method: "post",
    path: "/v1/cart/quote",
    summary: "Wycena koszyka bez cache",
    tag: "koszyk",
    ids: ["F-150", "F-151", "F-152", "F-153", "F-154", "F-155", "F-156", "F-157", "F-024"],
    body: quoteRequestSchema,
    success: { status: 200, schema: quoteResponseSchema, description: "Wycena." },
    noStore: true,
  },
  {
    method: "post",
    path: "/v1/orders",
    summary: "Utworzenie zamowienia pending_payment",
    tag: "zamowienia",
    ids: ["F-170", "F-171", "F-172", "F-173", "F-174", "F-175", "F-176", "F-180"],
    body: orderRequestSchema,
    headers: [
      {
        name: "Idempotency-Key",
        required: true,
        description: "UUID; ten sam klucz i cialo = ta sama odpowiedz (24 h).",
      },
    ],
    success: { status: 201, schema: orderCreatedSchema, description: "Zamowienie utworzone." },
    errors: [{ status: 409, code: "out_of_stock | price_changed | idempotency_conflict" }],
    noStore: true,
  },
  {
    method: "get",
    path: "/v1/orders",
    summary: "Lista zamowien dla konta demo",
    tag: "zamowienia",
    ids: ["F-201", "F-202"],
    headers: [ORDER_TOKEN],
    success: {
      status: 200,
      schema: orderListSchema,
      description: "Zamowienia wlascicieli tokenow.",
    },
    errors: [{ status: 401, code: "unauthorized" }],
    noStore: true,
    security: "orderToken",
  },
  {
    method: "get",
    path: "/v1/orders/{number}",
    summary: "Odczyt zamowienia wlasciciela tokenu",
    tag: "zamowienia",
    ids: ["F-178", "F-202"],
    pathParams: { number: "Numer TK-RRMMDD-XXXX" },
    headers: [ORDER_TOKEN],
    success: { status: 200, schema: orderDetailSchema, description: "Zamowienie." },
    errors: [
      { status: 401, code: "unauthorized" },
      { status: 404, code: "not_found" },
    ],
    noStore: true,
    security: "orderToken",
  },
  {
    method: "post",
    path: "/v1/orders/{number}/payment/simulate",
    summary: "Symulacja platnosci (paid | failed)",
    tag: "zamowienia",
    ids: ["F-177", "F-178", "F-179"],
    pathParams: { number: "Numer TK-RRMMDD-XXXX" },
    headers: [ORDER_TOKEN],
    body: paymentSimulateRequestSchema,
    success: {
      status: 200,
      schema: paymentSimulateResponseSchema,
      description: "Wynik symulacji.",
    },
    errors: [
      { status: 404, code: "not_found" },
      { status: 409, code: "invalid_transition | out_of_stock" },
    ],
    noStore: true,
    security: "orderToken",
  },

  // ---- B-001..B-013 (TAKTYL-45): uwierzytelnianie, uzytkownicy, dziennik zmian --------------------------------------
  {
    method: "post",
    path: "/v1/admin/auth/login",
    summary: "Logowanie e-mailem i haslem (ustawia ciasteczko sesji)",
    tag: "admin: sesja",
    ids: ["B-001", "B-002", "B-004"],
    body: loginRequestSchema,
    success: { status: 200, schema: sessionResponseSchema, description: "Sesja i token CSRF." },
    errors: [
      { status: 401, code: "unauthorized (jednolity komunikat)" },
      { status: 429, code: "rate_limited (blokada po 5 probach, Retry-After)" },
    ],
    noStore: true,
  },
  {
    method: "post",
    path: "/v1/admin/auth/demo-viewer",
    summary: "Sesja roli viewer bez hasla (tylko DEMO_MODE=true)",
    tag: "admin: sesja",
    ids: ["B-007"],
    success: { status: 200, schema: sessionResponseSchema, description: "Sesja viewer." },
    errors: [{ status: 404, code: "not_found (gdy tryb demo wylaczony)" }],
    noStore: true,
  },
  {
    method: "post",
    path: "/v1/admin/auth/logout",
    summary: "Wylogowanie (uniewaznienie sesji po stronie serwera)",
    tag: "admin: sesja",
    ids: ["B-009"],
    success: { status: 204, description: "Sesja zakonczona." },
    security: "session",
    role: "viewer",
    noStore: true,
  },
  {
    method: "get",
    path: "/v1/admin/auth/me",
    summary: "Biezacy uzytkownik, rola i token CSRF",
    tag: "admin: sesja",
    ids: ["B-001"],
    success: { status: 200, schema: sessionResponseSchema, description: "Sesja." },
    security: "session",
    role: "viewer",
    noStore: true,
  },
  {
    method: "get",
    path: "/v1/admin/auth/session",
    summary: "Alias GET /v1/admin/auth/me",
    tag: "admin: sesja",
    ids: ["B-001"],
    success: { status: 200, schema: sessionResponseSchema, description: "Sesja." },
    security: "session",
    role: "viewer",
    noStore: true,
  },
  {
    method: "get",
    path: "/v1/admin/users",
    summary: "Lista kont backpanelu",
    tag: "admin: uzytkownicy",
    ids: ["B-013"],
    success: { status: 200, schema: usersResponseSchema, description: "Konta." },
    security: "session",
    role: "owner",
    noStore: true,
  },
  {
    method: "post",
    path: "/v1/admin/users",
    summary: "Nowe konto (owner, editor lub viewer z haslem poczatkowym)",
    tag: "admin: uzytkownicy",
    ids: ["B-013"],
    body: createUserRequestSchema,
    success: { status: 201, schema: adminUserSchema, description: "Konto utworzone." },
    errors: [{ status: 409, code: "conflict (duplikat e-maila)" }],
    security: "session",
    role: "owner",
    noStore: true,
  },
  {
    method: "patch",
    path: "/v1/admin/users/{id}",
    summary: "Zmiana roli, dezaktywacja, reset hasla (haslo tymczasowe zwracane raz)",
    tag: "admin: uzytkownicy",
    ids: ["B-013"],
    pathParams: { id: "Identyfikator konta" },
    body: updateUserRequestSchema,
    success: { status: 200, schema: updateUserResponseSchema, description: "Konto po zmianie." },
    errors: [
      { status: 404, code: "not_found" },
      { status: 409, code: "conflict (ostatni owner)" },
    ],
    security: "session",
    role: "owner",
    noStore: true,
  },
  {
    method: "get",
    path: "/v1/admin/audit",
    summary: "Dziennik zmian z filtrami (uzytkownik, encja, zakres dat); viewer bez pol osobowych",
    tag: "admin: dziennik",
    ids: ["B-011", "B-012"],
    query: auditListQuerySchema,
    success: { status: 200, schema: auditListSchema, description: "Strona dziennika." },
    security: "session",
    role: "viewer",
    noStore: true,
  },
];
