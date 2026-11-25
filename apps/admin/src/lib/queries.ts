"use client";
// TanStack Query: klucze i hooki odczytu (stan serwera). Mutacje wstawiaja odpowiedz API do cache (jeden obiekt
// produktu po kazdym zapisie, API-011), wiec ekran odswieza sie bez dodatkowego zapytania.
import type {
  StatsRangeQuery,
  adminMessageListQuerySchema,
  auditListQuerySchema,
  mediaListQuerySchema,
  adminOrderListQuerySchema,
  adminProductListQuerySchema,
} from "@taktyl/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import {
  auditApi,
  catalogApi,
  dashboardApi,
  mediaApi,
  contentApi,
  faqApi,
  messagesApi,
  ordersApi,
  reviewsApi,
  settingsApi,
  statsApi,
} from "./api/endpoints";

export type ProductListParams = Partial<z.output<typeof adminProductListQuerySchema>>;
export type OrderListParams = Partial<z.output<typeof adminOrderListQuerySchema>>;

export type MessageListParams = Partial<z.output<typeof adminMessageListQuerySchema>>;

export type MediaListParams = Partial<z.output<typeof mediaListQuerySchema>>;
export type AuditListParams = Partial<z.output<typeof auditListQuerySchema>>;

export const keys = {
  products: (p: ProductListParams) => ["products", p] as const,
  productsAll: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  priceHistory: (sku: string) => ["price-history", sku] as const,
  stockMovements: (sku: string) => ["stock-movements", sku] as const,
  orders: (p: OrderListParams) => ["orders", p] as const,
  order: (n: string) => ["order", n] as const,
  settings: ["settings"] as const,
  content: (type: string) => ["content", type] as const,
  faq: ["faq"] as const,
  media: (p: MediaListParams) => ["media", p] as const,
  mediaAll: ["media"] as const,
  dashboard: ["dashboard"] as const,
  audit: (p: AuditListParams) => ["audit", p] as const,
  reviews: ["reviews"] as const,
  messages: (p: MessageListParams) => ["messages", p] as const,
  sales: (q: StatsRangeQuery) => ["stats", "sales", q] as const,
  traffic: (q: StatsRangeQuery) => ["stats", "traffic", q] as const,
  operations: ["stats", "operations"] as const,
  system: ["system"] as const,
  search: (q: string) => ["search", q] as const,
  colors: ["colors"] as const,
};

export const useProducts = (params: ProductListParams) =>
  useQuery({
    queryKey: keys.products(params),
    queryFn: () => catalogApi.list(params),
    placeholderData: keepPreviousData,
  });
export const useProduct = (id: string) =>
  useQuery({ queryKey: keys.product(id), queryFn: () => catalogApi.get(id) });
export const usePriceHistory = (sku: string | null) =>
  useQuery({
    queryKey: keys.priceHistory(sku ?? ""),
    queryFn: () => catalogApi.priceHistory(sku as string),
    enabled: sku !== null,
  });
export const useOrders = (params: OrderListParams) =>
  useQuery({
    queryKey: keys.orders(params),
    queryFn: () => ordersApi.list(params),
    placeholderData: keepPreviousData,
  });
export const useOrder = (number: string) =>
  useQuery({ queryKey: keys.order(number), queryFn: () => ordersApi.get(number) });
export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => settingsApi.get() });
export const useContent = (type: "page" | "guide") =>
  useQuery({ queryKey: keys.content(type), queryFn: () => contentApi.list(type) });
export const useFaq = () => useQuery({ queryKey: keys.faq, queryFn: () => faqApi.get() });
export const useReviews = () =>
  useQuery({ queryKey: keys.reviews, queryFn: () => reviewsApi.list() });
export const useMessages = (params: MessageListParams) =>
  useQuery({
    queryKey: keys.messages(params),
    queryFn: () => messagesApi.list(params),
    placeholderData: keepPreviousData,
  });
export const useMedia = (params: MediaListParams) =>
  useQuery({
    queryKey: keys.media(params),
    queryFn: () => mediaApi.list(params),
    placeholderData: keepPreviousData,
  });
export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => dashboardApi.get() });
export const useAudit = (params: AuditListParams) =>
  useQuery({
    queryKey: keys.audit(params),
    queryFn: () => auditApi.list(params),
    placeholderData: keepPreviousData,
  });

/** B-610..B-617: sprzedaz w zakresie (poprzednie dane zostaja na ekranie przy zmianie zakresu). */
export const useSalesStats = (q: StatsRangeQuery) =>
  useQuery({
    queryKey: keys.sales(q),
    queryFn: () => statsApi.sales(q),
    placeholderData: keepPreviousData,
  });
/** B-620 */
export const useTrafficStats = (q: StatsRangeQuery) =>
  useQuery({
    queryKey: keys.traffic(q),
    queryFn: () => statsApi.traffic(q),
    placeholderData: keepPreviousData,
  });
/** B-618, B-625: operacje i liczniki menu (odswiezane co minute). */
export const useOperations = (enabled = true) =>
  useQuery({
    queryKey: keys.operations,
    queryFn: () => statsApi.operations(),
    refetchInterval: 60_000,
    enabled,
  });
/** B-623 */
export const useSystem = () =>
  useQuery({ queryKey: keys.system, queryFn: () => statsApi.system() });
/** B-626 */
export const useAdminSearch = (q: string) =>
  useQuery({
    queryKey: keys.search(q),
    queryFn: () => statsApi.search(q),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
export const useColors = () =>
  useQuery({ queryKey: keys.colors, queryFn: () => statsApi.colors(), staleTime: 3_600_000 });
