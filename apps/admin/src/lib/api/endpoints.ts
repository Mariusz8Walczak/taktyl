// B-001, B-100..B-115, B-200..B-205, B-400..B-408: typowane wywolania API admina (docs/16 §3). Kazde wywolanie
// ma schemat odpowiedzi z @taktyl/contracts; mutacje niosa X-CSRF-Token (client.ts) i If-Match tam, gdzie wymaga tego API.
import {
  adminOrderDetailSchema,
  adminOrderListSchema,
  adminProductDetailSchema,
  adminProductListSchema,
  adminSettingsSchema,
  priceHistoryResponseSchema,
  sessionResponseSchema,
  stockMovementsResponseSchema,
  type adminOrderListQuerySchema,
  type adminProductListQuerySchema,
  type orderNoteRequestSchema,
  type orderTransitionRequestSchema,
  type productCreateSchema,
  type productPatchSchema,
  type setPriceRequestSchema,
  type setStockRequestSchema,
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
