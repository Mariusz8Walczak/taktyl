"use client";
// B-102, B-104, ADR-0003, skill taktyl-admin-sklep-sync: pasek stanu zapisu u gory formularza ("Niezapisane zmiany" /
// "Zapisano 14:32") z informacja o skutku w sklepie i odnosnikiem "Zobacz w sklepie".
import { formatTime } from "../../lib/format";

export function SaveBar({
  dirty,
  savedAt,
  shopUrl,
}: {
  dirty: boolean;
  savedAt: Date | null;
  shopUrl?: string;
}) {
  const state = dirty
    ? " adm-pasek-zapisu--niezapisane"
    : savedAt
      ? " adm-pasek-zapisu--zapisano"
      : "";
  return (
    <div className={`adm-pasek-zapisu${state}`} role="status">
      {dirty ? (
        <span>Niezapisane zmiany</span>
      ) : savedAt ? (
        <>
          <span>Zapisano {formatTime(savedAt)}. Sklep odświeży stronę w kilka sekund.</span>
          {shopUrl ? (
            <a className="tk-link" href={shopUrl} target="_blank" rel="noreferrer">
              Zobacz w sklepie
            </a>
          ) : null}
        </>
      ) : (
        <span>Brak zmian do zapisania</span>
      )}
    </div>
  );
}
