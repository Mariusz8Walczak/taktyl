// Prosty komunikat 404 (docs/05 §1 "/404"); pelne 404 z kategoriami i wyszukiwarka robi TAKTYL-32.
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">Nie ma takiej strony</h1>
      <p className="wstep">Adres mógł się zmienić albo zawiera literówkę.</p>
      <p>
        <Link href="/" className="tk-link">
          Wróć na stronę główną
        </Link>
      </p>
    </div>
  );
}
