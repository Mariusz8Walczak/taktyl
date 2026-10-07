"use client";
// F-010, A-17 (wzorzec: okno dialogowe szablonu, docs/08 §6): lista skrotow klawiszowych z przelacznikiem
// "Wyłącz skróty" (WCAG 2.1.4). Wybor zapisuje sie w `taktyl.prefs.v1`. Okno ladowane leniwie z shortcuts-host.tsx.
import { Dialog, Kbd } from "@taktyl/ui";
import { useEffect, useId, useState } from "react";
import { SHORTCUTS } from "../../lib/shortcuts/shortcuts-list";
import { readPrefs, writePrefs } from "../../lib/shortcuts/prefs";

export default function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toggleId = useId();
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (open) setDisabled(!readPrefs().shortcuts);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Skróty klawiszowe" className="skroty">
      <dl className="skroty__lista">
        {SHORTCUTS.map((s) => (
          <div key={s.key} className="skroty__wiersz">
            <dt>
              <Kbd>{s.keycap}</Kbd>
            </dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
      <div className="skroty__przelacznik">
        <input
          id={toggleId}
          type="checkbox"
          className="skroty__pole"
          checked={disabled}
          aria-describedby={`${toggleId}-opis`}
          onChange={(e) => {
            setDisabled(e.target.checked);
            writePrefs({ shortcuts: !e.target.checked });
          }}
        />
        <div>
          <label htmlFor={toggleId} className="skroty__etykieta">
            Wyłącz skróty
          </label>
          <p id={`${toggleId}-opis`} className="skroty__opis">
            {disabled
              ? "Skróty są wyłączone. Listę znajdziesz w stopce strony, w odnośniku „Skróty klawiszowe”."
              : "Skróty jednoklawiszowe nie działają w polach tekstowych. Wyłączenie zapamiętujemy w tej przeglądarce."}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
