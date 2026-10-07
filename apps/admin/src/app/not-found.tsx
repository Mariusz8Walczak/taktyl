// docs/15 §4 `/404`: nieznany adres, odnosnik do pulpitu.
import Link from "next/link";
import { MAIN_ID } from "../components/skip-link";

export default function NotFound() {
  return (
    <main id={MAIN_ID} tabIndex={-1} className="adm-logowanie tresc">
      <h1>Nie ma takiej strony</h1>
      <p>Adres mógł się zmienić albo zawiera literówkę.</p>
      <p>
        <Link href="/" className="tk-link">
          Wróć do pulpitu
        </Link>
      </p>
    </main>
  );
}
