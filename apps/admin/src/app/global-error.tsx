"use client";
// Blad w layoucie glownym: layout nie dziala, wiec komponent sam dostarcza <html>.
import "@taktyl/tokens/tokens.css";
import "@taktyl/tokens/taktyl.css";
import "@taktyl/ui/ui.css";
import "../styles/rozmiary.css";
import "../styles/baza.css";
import "../styles/uklad.css";
import "../styles/komponenty.css";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="pl">
      <body>
        <main className="adm-logowanie" role="alert">
          <h1>Nie udało się wczytać backpanelu</h1>
          <p>Spróbuj ponownie za chwilę.</p>
          <button type="button" className="tk-link tk-link--przycisk" onClick={reset}>
            Spróbuj ponownie
          </button>
        </main>
      </body>
    </html>
  );
}
