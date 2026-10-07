// docs/11 pulapka 10: kazdy odczyt i zapis storage w try/catch (tryb prywatny, zablokowane dane witryny),
// z zapasem w pamieci, zeby strona dzialala mimo wyjatku.
export type StorageKind = "local" | "session";

const memory: Record<StorageKind, Map<string, string>> = { local: new Map(), session: new Map() };

function area(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // sam dostep do window.localStorage moze rzucic (SecurityError)
  }
}

export function readItem(kind: StorageKind, key: string): string | null {
  try {
    const s = area(kind);
    if (s) {
      const v = s.getItem(key);
      if (v !== null) return v;
    }
  } catch {
    /* zapas ponizej */
  }
  return memory[kind].get(key) ?? null;
}

export function writeItem(kind: StorageKind, key: string, value: string): void {
  memory[kind].set(key, value);
  try {
    area(kind)?.setItem(key, value);
  } catch {
    /* zostaje zapas w pamieci */
  }
}

export function removeItem(kind: StorageKind, key: string): void {
  memory[kind].delete(key);
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* nic wiecej do zrobienia */
  }
}

/** Do testow: czysci zapas w pamieci. */
export function resetMemoryStorage(): void {
  memory.local.clear();
  memory.session.clear();
}
