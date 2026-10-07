"use client";
// F-240: link w stopce "Ustawienia cookies" ponownie otwiera ustawienia zgod (akcja, wiec <button>).
import { openConsentSettings } from "../../lib/consent/consent";

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="stopka__link stopka__link--przycisk"
      onClick={openConsentSettings}
    >
      Ustawienia cookies
    </button>
  );
}
