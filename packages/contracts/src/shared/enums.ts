// Slowniki zamkniete z data/*.json i docs/16.
import { z } from "zod";

export const categoryIdSchema = z.enum(["klawiatury", "myszki", "podkladki"]);
export type CategoryId = z.infer<typeof categoryIdSchema>;

/** Klucz koloru ze slownika `data/colors.json` (150 pozycji: seria, paleta konfiguratora i kolekcja, ADR-0011). */
export const colorKeySchema = z.string().regex(/^[a-z0-9-]{2,40}$/);
export const colorIdSchema = colorKeySchema;
export const switchIdSchema = z.enum(["slizg", "prog", "trzask", "szept"]);
export const padSizeKeySchema = z.enum(["m", "l", "xl", "xxl"]);
export const profileIdSchema = z.enum(["fps", "gry", "programowanie", "biuro", "cisza"]);
export type ProfileId = z.infer<typeof profileIdSchema>;

export const badgeSchema = z.enum(["nowosc", "bestseller"]);
export const sortKeySchema = z.enum(["polecane", "cena-rosnaco", "cena-malejaco", "nowosci", "najlzejsze"]);

export const shippingMethodIdSchema = z.enum(["automat", "kurier", "odbior"]);
export const paymentTypeSchema = z.enum(["blik", "karta", "przelew-online", "przelew"]);

export const orderStatusSchema = z.enum([
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const roleSchema = z.enum(["owner", "editor", "viewer"]);
export type Role = z.infer<typeof roleSchema>;
