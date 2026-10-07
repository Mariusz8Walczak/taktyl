"use client";
// Blad w layoucie glownym (np. API niedostepne albo odpowiedz niezgodna z kontraktem): czytelny komunikat zamiast
// pustej strony. Layout nie dziala, wiec komponent sam dostarcza <html> i zaleznosci stylu.
import "@taktyl/tokens/tokens.css";
import "@taktyl/tokens/taktyl.css";
import "@taktyl/ui/ui.css";
import "../styles/rozmiary.css";
import "../styles/baza.css";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ślad w konsoli przeglądarki, żeby błąd nie był cichy
    console.error(error);
  }, [error]);
  return (
    <html lang="pl">
      <body>
        <main className="kontener strona" role="alert">
          <h1 className="naglowek-strony">Nie udało się wczytać sklepu</h1>
          <p className="wstep">
            Nie mamy teraz połączenia z danymi sklepu. Spróbuj ponownie za chwilę.
          </p>
          <button type="button" className="przycisk-tekstowy" onClick={reset}>
            Spróbuj ponownie
          </button>
        </main>
      </body>
    </html>
  );
}
