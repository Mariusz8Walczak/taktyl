// B-621 (ADR-0012, docs/10, docs/16 par. 2): kolektor zdarzen pomiaru POST /v1/events.
// Nazwy i parametry zdarzen BEZ ZMIAN z docs/10 (regula 9). Sklep wysyla je dopiero po zgodzie na analityke.
// Zero danych osobowych (docs/10 par. 1 pkt 5): klucze osobowe i adresy e-mail w parametrach = 422.
import { z } from "zod";
import { dateTimeSchema } from "../shared/primitives";

/** docs/10 par. 4 (handlowe, GA4) i par. 5 (kreator i sklep). Lista jest ostateczna: zmiana nazwy = nowe zdarzenie. */
export const ANALYTICS_EVENT_NAMES = [
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_wishlist",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "search",
  "set_builder_start",
  "set_profile_select",
  "set_step_complete",
  "set_fit_warning",
  "set_suggestion_apply",
  "set_complete",
  "set_share",
  "set_save",
  "set_add_to_cart",
  "filter_apply",
  "compare_add",
  "shortcut_use",
  "payment_failed",
  "generate_lead",
  "return_request",
] as const;
export const analyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

/** Maks. 20 zdarzen w jednej paczce (sklep wysyla je partiami). */
export const EVENTS_BATCH_MAX = 20;
/** Parametry jednego zdarzenia po serializacji do JSON (items[] z kilkoma pozycjami miesci sie z zapasem). */
export const EVENT_PARAMS_MAX_CHARS = 4000;

/** Klucze, ktore niosa dane osobowe (docs/10 par. 1 pkt 5): nigdy w pomiarze. `item_name` to nazwa produktu, nie osoby. */
const PERSONAL_KEY =
  /^(?:e-?mail|phone|tel|telefon|name|first_name|last_name|full_name|imie|nazwisko|address|adres|street|ulica|postcode|postal_code|kod_pocztowy|city|miasto|nip|ip|ip_address|user_agent)$/i;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Pierwsze naruszenie zasady "zero danych osobowych" w drzewie parametrow (sciezka) albo null. */
export function findPersonalData(value: unknown, path = "params", depth = 0): string | null {
  if (depth > 6) return path;
  if (typeof value === "string") return EMAIL_LIKE.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findPersonalData(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (PERSONAL_KEY.test(k)) return `${path}.${k}`;
      const hit = findPersonalData(v, `${path}.${k}`, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

export const analyticsParamsSchema = z
  .record(z.string().min(1).max(40), z.unknown())
  .superRefine((params, ctx) => {
    if (JSON.stringify(params).length > EVENT_PARAMS_MAX_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: `parametry: maks. ${EVENT_PARAMS_MAX_CHARS} znakow`,
      });
    }
    const hit = findPersonalData(params);
    if (hit) ctx.addIssue({ code: "custom", message: `dane osobowe w pomiarze: ${hit}` });
  });

export const analyticsEventSchema = z.strictObject({
  name: analyticsEventNameSchema,
  params: analyticsParamsSchema,
  /** Chwila zdarzenia u klienta (ISO 8601). Serwer odrzuca czas sprzed 48 h i z przyszlosci (> 10 min). */
  ts: dateTimeSchema,
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

/** Anonimowy identyfikator sesji (losowy, bez powiazania z osoba); nie jest to identyfikator klienta ani urzadzenia. */
export const analyticsSessionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, "session_id: 8-64 znaki [A-Za-z0-9_-]");

/** POST /v1/events (body). */
export const eventsBatchSchema = z.strictObject({
  session_id: analyticsSessionIdSchema,
  events: z.array(analyticsEventSchema).min(1).max(EVENTS_BATCH_MAX),
});
export type EventsBatch = z.infer<typeof eventsBatchSchema>;

/** 202: liczba zapisanych zdarzen. */
export const eventsAcceptedSchema = z.object({ accepted: z.int().min(0) });
export type EventsAccepted = z.infer<typeof eventsAcceptedSchema>;
