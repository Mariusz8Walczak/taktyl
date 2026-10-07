// F-001, F-009 (docs/16 §2, GET /v1/shop-settings): ustawienia publiczne sklepu. Tag `shop-settings` (docs/14 §6).
import { publicShopSettingsSchema } from "@taktyl/contracts";
import type { PublicShopSettings } from "@taktyl/contracts";
import { cache } from "react";
import { apiGet } from "./client";
import { TAG } from "./tags";

/** Jedno wywolanie na zadanie (layout, stopka i strony dziela wynik); miedzy zadaniami dziala cache danych Next. */
export const getShopSettings = cache((): Promise<PublicShopSettings> =>
  apiGet("/v1/shop-settings", publicShopSettingsSchema, { tags: [TAG.shopSettings] }),
);
