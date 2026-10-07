// B-006 (docs/15 §3, ADR-0006): macierz uprawnien po stronie UI. Autorytatywny jest guard w API; UI tylko wylacza kontrolki
// i mowi dlaczego (viewer nie zapisuje, ustawienia tylko owner).
import type { Role } from "@taktyl/contracts";

export type Action =
  | "catalog.read"
  | "catalog.write"
  | "catalog.delete"
  | "orders.read"
  | "orders.write"
  | "content.write"
  | "media.write"
  | "settings.read"
  | "settings.write"
  | "audit.read"
  | "users.manage";

const MIN_ROLE: Record<Action, readonly Role[]> = {
  "catalog.read": ["owner", "editor", "viewer"],
  "catalog.write": ["owner", "editor"],
  "catalog.delete": ["owner"],
  "orders.read": ["owner", "editor", "viewer"],
  "orders.write": ["owner", "editor"],
  "content.write": ["owner", "editor"],
  "media.write": ["owner", "editor"],
  "settings.read": ["owner", "editor", "viewer"],
  "settings.write": ["owner"],
  "audit.read": ["owner", "editor", "viewer"],
  "users.manage": ["owner"],
};

export function can(role: Role | null | undefined, action: Action): boolean {
  return role ? MIN_ROLE[action].includes(role) : false;
}

/** Powod wyswietlany przy nieaktywnej kontrolce; null, gdy akcja jest dozwolona. */
export function denyReason(role: Role | null | undefined, action: Action): string | null {
  if (can(role, action)) return null;
  if (action === "settings.write") return "Tylko właściciel zmienia ustawienia sklepu.";
  if (role === "viewer") return "Konto viewer jest tylko do odczytu. Nic nie zmienisz.";
  return "Nie masz uprawnień do tej zmiany.";
}

/** Hook z docs/15 §3: `useCan(role, action)` zwraca decyzje i powod. */
export function useCan(
  role: Role | null | undefined,
  action: Action,
): { allowed: boolean; reason: string | null } {
  return { allowed: can(role, action), reason: denyReason(role, action) };
}
