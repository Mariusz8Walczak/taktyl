// A-18 (docs/15 §13): szkielet ladowania - paski z animacja opacity; dla czytnika komunikat roli status.
import { VisuallyHidden } from "@taktyl/ui";

export function Skeleton({ rows = 5, label = "Wczytywanie" }: { rows?: number; label?: string }) {
  return (
    <div className="adm-szkielet" role="status" aria-busy="true">
      <VisuallyHidden>{label}</VisuallyHidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="adm-szkielet__wiersz" aria-hidden="true" />
      ))}
    </div>
  );
}
