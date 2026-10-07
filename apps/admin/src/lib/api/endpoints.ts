// B-001, B-100..B-115, B-200..B-205, B-400..B-408: typowane wywolania API admina (docs/16 §3). Kazde wywolanie
// ma schemat odpowiedzi z @taktyl/contracts; mutacje niosa X-CSRF-Token (client.ts) i If-Match tam, gdzie wymaga tego API.
import {
  adminContentListSchema,
  adminContentResponseSchema,
  adminFaqSchema,
  adminMessageListSchema,
  adminOrderDetailSchema,
  adminOrderListSchema,
  adminProductDetailSchema,
  adminProductListSchema,
  adminProductReviewsSchema,
  adminReviewListSchema,
  adminSettingsSchema,
  descriptionResponseSchema,
  priceHistoryResponseSchema,
  sessionResponseSchema,
  stockMovementsResponseSchema,
  type adminMessageListQuerySchema,
  type adminOrderListQuerySchema,
  type adminProductListQuerySchema,
  type contentPatchSchema,
  type descriptionPutSchema,
  type faqPutSchema,
  type orderNoteRequestSchema,
  type orderTransitionRequestSchema,
  type productCreateSchema,
  type productPatchSchema,
  type setPriceRequestSchema,
  type setStockRequestSchema,
  type reviewsPutSchema,
  type settingsPatchSchema,
  type variantCreateSchema,
  type variantPatchSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { apiRequest, setCsrfToken } from "./client";

const A = "/v1/admin";

type Input<S extends z.ZodType> = z.input<S>;

export const authApi = {
  async me() {
    const r = await apiRequest({ path: `${A}/auth/me`, schema: sessionResponseSchema });
    setCsrfToken(r.data.csrf_token);
    return r.data;
  },
  async login(email: string, password: string) {
    const r = await apiRequest({
      method: "POST",
      path: `${A}/auth/login`,
      body: { email, password },
      schema: sessionResponseSchema,
    });
    setCsrfToken(r.data.csrf_token);
    return r.data;
  },
  async demoViewer() {
    const r = await apiRequest({
      method: "POST",
      path: `${A}/auth/demo-viewer`,
      schema: sessionResponseSchema,
    });
    setCsrfToken(r.data.csrf_token);
    return r.data;
  },
  async logout() {
    await apiRequest({ method: "POST", path: `${A}/auth/logout`, schema: null });
    setCsrfToken(null);
  },
};

export const catalogApi = {
  list: (query: Partial<z.output<typeof adminProductListQuerySchema>>) =>
    apiRequest({ path: `${A}/products`, query, schema: adminProductListSchema }).then(
      (r) => r.data,
    ),
  get: (id: string) =>
    apiRequest({
      path: `${A}/products/${encodeURIComponent(id)}`,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  create: (body: Input<typeof productCreateSchema>) =>
    apiRequest({
      method: "POST",
      path: `${A}/products`,
      body,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  patch: (id: string, version: number, body: Input<typeof productPatchSchema>) =>
    apiRequest({
      method: "PATCH",
      path: `${A}/products/${encodeURIComponent(id)}`,
      body,
      ifMatch: version,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  createVariant: (productId: string, body: Input<typeof variantCreateSchema>) =>
    apiRequest({
      method: "POST",
      path: `${A}/products/${encodeURIComponent(productId)}/variants`,
      body,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  patchVariant: (sku: string, version: number, body: Input<typeof variantPatchSchema>) =>
    apiRequest({
      method: "PATCH",
      path: `${A}/variants/${encodeURIComponent(sku)}`,
      body,
      ifMatch: version,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  /** B-104: cena w groszach; `version` wariantu opcjonalnie (If-Match), wtedy 412 przy konflikcie. */
  setPrice: (sku: string, body: Input<typeof setPriceRequestSchema>, version?: number) =>
    apiRequest({
      method: "PUT",
      path: `${A}/variants/${encodeURIComponent(sku)}/price`,
      body,
      ifMatch: version,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  priceHistory: (sku: string) =>
    apiRequest({
      path: `${A}/variants/${encodeURIComponent(sku)}/price-history`,
      schema: priceHistoryResponseSchema,
    }).then((r) => r.data),
  setStock: (sku: string, body: Input<typeof setStockRequestSchema>, version?: number) =>
    apiRequest({
      method: "PUT",
      path: `${A}/variants/${encodeURIComponent(sku)}/stock`,
      body,
      ifMatch: version,
      schema: adminProductDetailSchema,
    }).then((r) => r.data),
  stockMovements: (sku: string) =>
    apiRequest({
      path: `${A}/variants/${encodeURIComponent(sku)}/stock-movements`,
      schema: stockMovementsResponseSchema,
    }).then((r) => r.data),
};

export const ordersApi = {
  list: (query: Partial<z.output<typeof adminOrderListQuerySchema>>) =>
    apiRequest({ path: `${A}/orders`, query, schema: adminOrderListSchema }).then((r) => r.data),
  get: (number: string) =>
    apiRequest({
      path: `${A}/orders/${encodeURIComponent(number)}`,
      schema: adminOrderDetailSchema,
    }).then((r) => r.data),
  transition: (number: string, body: Input<typeof orderTransitionRequestSchema>) =>
    apiRequest({
      method: "POST",
      path: `${A}/orders/${encodeURIComponent(number)}/transition`,
      body,
      schema: adminOrderDetailSchema,
    }).then((r) => r.data),
  addNote: (number: string, body: Input<typeof orderNoteRequestSchema>) =>
    apiRequest({
      method: "POST",
      path: `${A}/orders/${encodeURIComponent(number)}/note`,
      body,
      schema: adminOrderDetailSchema,
    }).then((r) => r.data),
};

export const settingsApi = {
  /** Zwraca ustawienia z wersja (ETag) do If-Match. */
  get: () => apiRequest({ path: `${A}/settings`, schema: adminSettingsSchema }).then((r) => r.data),
  patch: (version: number, body: Input<typeof settingsPatchSchema>) =>
    apiRequest({
      method: "PATCH",
      path: `${A}/settings`,
      body,
      ifMatch: version,
      schema: adminSettingsSchema,
    }).then((r) => r.data),
};

/** B-304, B-305: strony informacyjne i artykuly poradnika. PATCH wymaga If-Match (wersja tresci), 412 przy konflikcie. */
export const contentApi = {
  list: (type: "page" | "guide") =>
    apiRequest({ path: `${A}/content`, query: { type }, schema: adminContentListSchema }).then(
      (r) => r.data,
    ),
  patch: (id: string, version: number, body: Input<typeof contentPatchSchema>) =>
    apiRequest({
      method: "PATCH",
      path: `${A}/content/${encodeURIComponent(id)}`,
      body,
      ifMatch: version,
      schema: adminContentResponseSchema,
    }).then((r) => r.data),
};

/** B-307: FAQ jako cala uporzadkowana lista (PUT zastepuje liste; kolejnosc = kolejnosc tablicy). */
export const faqApi = {
  get: () => apiRequest({ path: `${A}/faq`, schema: adminFaqSchema }).then((r) => r.data),
  put: (body: Input<typeof faqPutSchema>) =>
    apiRequest({ method: "PUT", path: `${A}/faq`, body, schema: adminFaqSchema }).then(
      (r) => r.data,
    ),
};

/** B-300, B-301: opis produktu; If-Match = wersja produktu. Ostrzezenia w odpowiedzi nie blokuja zapisu. */
export const descriptionApi = {
  put: (productId: string, version: number, body: Input<typeof descriptionPutSchema>) =>
    apiRequest({
      method: "PUT",
      path: `${A}/products/${encodeURIComponent(productId)}/description`,
      body,
      ifMatch: version,
      schema: descriptionResponseSchema,
    }).then((r) => r.data),
};

/** B-302, B-303: opinie demo (zestaw 3-6 opinii na produkt, PUT zastepuje zestaw). */
export const reviewsApi = {
  list: () =>
    apiRequest({ path: `${A}/reviews`, schema: adminReviewListSchema }).then((r) => r.data),
  put: (productId: string, body: Input<typeof reviewsPutSchema>) =>
    apiRequest({
      method: "PUT",
      path: `${A}/products/${encodeURIComponent(productId)}/reviews`,
      body,
      schema: adminProductReviewsSchema,
    }).then((r) => r.data),
};

/** B-308, B-309: zgloszenia z formularzy. Viewer dostaje dane zamaskowane juz z API. */
export const messagesApi = {
  list: (query: Partial<z.output<typeof adminMessageListQuerySchema>>) =>
    apiRequest({ path: `${A}/messages`, query, schema: adminMessageListSchema }).then(
      (r) => r.data,
    ),
  setHandled: (id: string, handled: boolean) =>
    apiRequest({
      method: "PATCH",
      path: `${A}/messages/${encodeURIComponent(id)}`,
      body: { handled },
      schema: null,
    }).then(() => undefined),
  remove: (id: string) =>
    apiRequest({
      method: "DELETE",
      path: `${A}/messages/${encodeURIComponent(id)}`,
      schema: null,
    }).then(() => undefined),
};
