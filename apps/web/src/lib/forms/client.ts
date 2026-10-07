// F-221, F-223 (docs/16 §2, WEB-002): wyslanie formularza przez route handler tego samego hosta (`/api/forms/*`),
// ktory przekazuje zadanie do POST /v1/forms/{contact,newsletter}. Wynik to maly, jawny typ; odpowiedz API
// mapowana na komunikaty w tonie docs/01. Dane osobowe nie trafiaja ani do logow, ani do pomiaru.
import { track } from "../track";

/** Zapas, gdy odpowiedz nie niesie tekstu (ten sam tekst co FORM_DEMO_NOTICE w contracts; bez importu zod do bundla). */
const FORM_DEMO_NOTICE = "W sklepie demonstracyjnym nie wysyłamy e-maili.";

export type FormId = "contact" | "newsletter";
export type FormFailure =
  | { ok: false; kind: "rate_limited" }
  | { ok: false; kind: "validation"; fields: string[] }
  | { ok: false; kind: "network" | "server" };
export type FormResult = { ok: true; message: string } | FormFailure;

/** docs/10: form_id to `kontakt` / `newsletter`. */
const LEAD_ID = { contact: "kontakt", newsletter: "newsletter" } as const;

export async function submitForm(form: FormId, body: Record<string, string>): Promise<FormResult> {
  let res: Response;
  try {
    res = await fetch(`/api/forms/${form}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* odpowiedz bez JSON-a: zostaje sam status */
  }
  if (res.status === 201) {
    const message = (json as { message?: unknown } | null)?.message;
    return { ok: true, message: typeof message === "string" ? message : FORM_DEMO_NOTICE };
  }
  if (res.status === 429) return { ok: false, kind: "rate_limited" };
  if (res.status === 400 || res.status === 422) {
    const errors = (json as { errors?: { path?: unknown }[] } | null)?.errors;
    const fields = Array.isArray(errors)
      ? errors.map((e) => String(e.path ?? "")).filter(Boolean)
      : [];
    return { ok: false, kind: "validation", fields };
  }
  return { ok: false, kind: "server" };
}

/** docs/10: `generate_lead` po potwierdzeniu wysylki (w demo: po walidacji i odpowiedzi 201), bez danych osobowych. */
export function trackLead(form: FormId): void {
  track("generate_lead", { form_id: LEAD_ID[form], value: 0, currency: "PLN" });
}

/** Komunikat nad formularzem dla bledu wysylki (ton: co zrobic dalej, bez przepraszania). */
export function failureText(f: FormFailure): string {
  switch (f.kind) {
    case "rate_limited":
      return "Zbyt wiele prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.";
    case "validation":
      return "Serwer nie przyjął formularza. Sprawdź wpisane dane i spróbuj ponownie.";
    case "network":
      return "Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.";
    default:
      return "Coś po naszej stronie nie zadziałało. Spróbuj ponownie za chwilę.";
  }
}
