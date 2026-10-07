// docs/15 par. 3, ADR-0006: powod nieaktywnej kontrolki (viewer nie zapisuje) - tekst przy przycisku, powiazany aria-describedby.
export function DisabledReason({ id, reason }: { id: string; reason: string | null }) {
  if (!reason) return null;
  return (
    <p id={id} className="adm-powod">
      {reason}
    </p>
  );
}
