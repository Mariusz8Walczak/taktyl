// Slowniki zamkniete z data/*.json i docs/16.
import { z } from "zod";

export const categoryIdSchema = z.enum(["klawiatury", "myszki", "podkladki"]);
export type CategoryId = z.infer<typeof categoryIdSchema>;

export const colorIdSchema = z.enum(["grafit", "mgla", "kobalt", "naturalny"]);
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
