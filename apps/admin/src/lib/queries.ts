"use client";
// TanStack Query: klucze i hooki odczytu (stan serwera). Mutacje wstawiaja odpowiedz API do cache (jeden obiekt
// produktu po kazdym zapisie, API-011), wiec ekran odswieza sie bez dodatkowego zapytania.
import type { adminOrderListQuerySchema, adminProductListQuerySchema } from "@taktyl/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { catalogApi, ordersApi, settingsApi } from "./api/endpoints";

export type ProductListParams = Partial<z.output<typeof adminProductListQuerySchema>>;
export type OrderListParams = Partial<z.output<typeof adminOrderListQuerySchema>>;

export const keys = {
  products: (p: ProductListParams) => ["products", p] as const,
  productsAll: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  priceHistory: (sku: string) => ["price-history", sku] as const,
  stockMovements: (sku: string) => ["stock-movements", sku] as const,
  orders: (p: OrderListParams) => ["orders", p] as const,
  order: (n: string) => ["order", n] as const,
  settings: ["settings"] as const,
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
