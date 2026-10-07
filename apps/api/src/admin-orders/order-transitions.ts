// B-203, B-205 (docs/16 par. 5, docs/18 E): maszyna stanow zamowienia dla przejsc recznych (editor, owner).
// `paid` i `payment_failed` ustawia wylacznie system (symulacja platnosci), wiec nie ma ich wsrod celow.
// Nazwy statusow jak w bazie i kontrakcie (angielskie); polskie nazwy z docs/18 sa etykietami interfejsu.
import type { OrderStatus } from "@taktyl/contracts";

export type AdminTransitionTarget = "processing" | "shipped" | "delivered" | "cancelled";

/** Dozwolone przejscia reczne ze statusu (docs/16 par. 5). Niewymienione = 409 invalid_transition. */
export const ADMIN_TRANSITIONS: Readonly<Record<OrderStatus, readonly AdminTransitionTarget[]>> = {
  pending_payment: ["cancelled"],
  payment_failed: ["cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function allowedAdminTransitions(from: string): readonly AdminTransitionTarget[] {
  return ADMIN_TRANSITIONS[from as OrderStatus] ?? [];
}

export const isAdminTransitionAllowed = (from: string, to: string): boolean =>
  (allowedAdminTransitions(from) as readonly string[]).includes(to);

/** Zwrot stanow tylko wtedy, gdy stan byl zdjety (od `paid`): `paid`, `processing` -> `cancelled`. */
export const restocksOnCancel = (from: string): boolean => from === "paid" || from === "processing";

/** Minimalna dlugosc powodu anulowania (docs/15 par. 8.2). */
export const CANCEL_REASON_MIN = 5;
