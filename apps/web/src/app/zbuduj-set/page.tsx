// F-100...F-115 (docs/03, docs/05 §5): strona kreatora /zbuduj-set. Komponent serwerowy pobiera katalog, reguly, sety
// i ustawienia z API (znaczniki product:{slug}, category:{k}, catalog, rules, presets, shop-settings), a wynik
// wejscia z adresu (np. ?preset=programista) jest renderowany juz po stronie serwera (cena, "Pasuje").
// Wzorzec ukladu: zakladki szablonu + przyklejone podsumowanie (docs/08 §6). Stan i adres: wyspa `Builder`.
import type { Metadata } from "next";
import "../../styles/builder.css";
import { PageHero } from "../../components/page-hero";
import { Builder } from "../../components/builder/builder";
import { loadBuilderData } from "../../lib/builder/data";

export const metadata: Metadata = {
  title: "Zbuduj set",
  description:
    "Złóż klawiaturę, myszkę i podkładkę, zobacz je w skali na biurku i sprawdź, czy pasują. Za komplet rabat.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Pierwsze wartosci parametrow jako ciag zapytania: serwer i przegladarka odtwarzaja stan z tego samego wejscia. */
function toQuery(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined) q.set(k, first);
  }
  return q.toString();
}

export default async function BuilderPage({ searchParams }: Props) {
  const [sp, data] = await Promise.all([searchParams, loadBuilderData()]);
  return (
    <div className="kontener strona strona--kreator">
      <PageHero slug="zbuduj-set" title="Zbuduj set">
        <p className="wstep kreator__wstep">
          Wybierz klawiaturę, myszkę i podkładkę. Pokażemy je w skali na biurku i sprawdzimy, czy
          się mieszczą. Rabat za set obejmuje komplet.
        </p>
      </PageHero>
      <Builder data={data} initialSearch={toQuery(sp)} />
      {/* F-255 (ADR-0011): osobna sciezka obok gotowych setow i kreatora. */}
      <aside className="kreator__wlasny" aria-labelledby="kreator-wlasny-tytul">
        <h2 id="kreator-wlasny-tytul">Nic nie pasuje? Stwórz własny set</h2>
        <p>Własne kolory każdej części, podgląd całości na biurku w 3D i rabat za komplet.</p>
        <a className="przycisk-tekstowy" href="/stworz-set">
          Stwórz własny set
        </a>
      </aside>
    </div>
  );
}
