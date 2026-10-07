// B-607 (TAKTYL-50): pulpit - skroty do najczestszych zadan jako odnosniki tekstowe. Liczby i ostatnie zmiany (B-600..B-606)
// dojda z endpointem pulpitu (w API go jeszcze nie ma, docs/16 §3.5).
import Link from "next/link";
import { PageHeader } from "../../components/ui/page-header";

export const metadata = { title: "Pulpit" };

export default function DashboardPage() {
  return (
    <div className="adm-strona">
      <PageHeader title="Pulpit" />
      <section className="adm-karta" aria-labelledby="skroty">
        <h2 id="skroty">Najczęstsze zadania</h2>
        <ul className="adm-lista">
          <li>
            <Link className="tk-link" href="/produkty">
              Produkty: ceny, stany i plakietki
            </Link>
          </li>
          <li>
            <Link className="tk-link" href="/zamowienia">
              Zamówienia: statusy i notatki
            </Link>
          </li>
          <li>
            <Link className="tk-link" href="/ustawienia">
              Ustawienia sklepu
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
