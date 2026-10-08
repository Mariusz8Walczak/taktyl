"use client";
// F-240 (baner zgod), F-242 (tryb zgody): wlasny komponent, szablon nie ma odpowiednika (docs/08 §6).
// - Okno ustawien: Dialog z @taktyl/ui (pulapka fokusu, Esc) z kategoriami; do stopki: "Ustawienia cookies".
// TAKTYL-77, TAKTYL-84: sam baner (dolny pasek) jest w consent-manager.tsx i renderuje sie na serwerze (stan domyslny
// w HTML, bez czekania na hydracje - LCP). Ten modul (Dialog z kategoriami) laduje sie leniwie, dopiero gdy
// uzytkownik otworzy ustawienia.
import { Button, Dialog } from "@taktyl/ui";
import { useId, useState } from "react";
import { NECESSARY_ONLY, readConsent, saveConsent } from "../../lib/consent/consent";
import type { ConsentChoice } from "../../lib/consent/consent";

export interface ConsentUiProps {
  gtmId?: string;
  /** Wywolywane po zapisie wyboru ("Zapisz wybor"): menedzer zamyka okno i baner. */
  onDecided: () => void;
  /** Wywolywane przy zamknieciu bez decyzji (Esc, przycisk zamkniecia). */
  onClose: () => void;
}

function Category({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="zgody__kategoria">
      <input
        id={id}
        type="checkbox"
        className="zgody__pole"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-opis`}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div>
        <label htmlFor={id} className="zgody__etykieta">
          {label}
        </label>
        <p id={`${id}-opis`} className="zgody__opis">
          {hint}
        </p>
      </div>
    </div>
  );
}

export default function ConsentUi({ gtmId, onDecided, onClose }: ConsentUiProps) {
  const [draft, setDraft] = useState<ConsentChoice>(() => {
    const record = readConsent();
    return record ? { analytics: record.analytics, marketing: record.marketing } : NECESSARY_ONLY;
  });
  const uid = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ustawienia cookies"
      footer={
        <Button
          variant="primary"
          onClick={() => {
            saveConsent(draft, gtmId);
            onDecided();
          }}
        >
          Zapisz wybór
        </Button>
      }
    >
      <p className="zgody__opis">
        Wybierz, na co się zgadzasz. Zmienisz to w każdej chwili w stopce: „Ustawienia cookies”.
      </p>
      <Category
        id={`${uid}-niezbedne`}
        label="Niezbędne"
        hint="Koszyk, wybór ustawień i ta decyzja. Bez nich sklep nie działa, więc nie można ich wyłączyć."
        checked
        disabled
      />
      <Category
        id={`${uid}-analityka`}
        label="Analityczne"
        hint="Pomiar ruchu i ścieżki zakupowej, bez danych osobowych."
        checked={draft.analytics}
        onChange={(analytics) => setDraft((d) => ({ ...d, analytics }))}
      />
      <Category
        id={`${uid}-marketing`}
        label="Marketingowe"
        hint="Dopasowanie reklam poza sklepem."
        checked={draft.marketing}
        onChange={(marketing) => setDraft((d) => ({ ...d, marketing }))}
      />
    </Dialog>
  );
}
