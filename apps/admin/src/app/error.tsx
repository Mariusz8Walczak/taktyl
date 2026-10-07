"use client";
// Blad renderowania strony panelu: komunikat w tresci i "Spróbuj ponownie" (docs/15 §7.1).
import { Alert, Button } from "@taktyl/ui";
import { useEffect } from "react";
import { MAIN_ID } from "../components/skip-link";

export default function ErrorPage({
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
    <main id={MAIN_ID} tabIndex={-1} className="adm-logowanie tresc">
      <h1>Coś poszło nie tak</h1>
      <Alert variant="blad">Nie udało się wyświetlić tej strony. Spróbuj ponownie.</Alert>
      <div>
        <Button onClick={reset}>Spróbuj ponownie</Button>
      </div>
    </main>
  );
}
