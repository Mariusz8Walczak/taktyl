// F-100, F-104, F-105 (docs/05 §2 pkt 5, docs/01 §2.3; wzorzec: sekcja "ikonka + tekst" z szablonu, docs/08 §6, bez
// ikon - D-010): sekcja ciemna .sekcja--mod. Trzy kroki to SEKWENCJA, wiec numeracja jest uzasadniona (<ol>).
// Pod spodem dowod bez zmyslania: przyklad z liczbami WYLICZONYMI z danych i regul (lib/home/view.ts).
import { applyNbsp } from "@taktyl/domain";
import Link from "next/link";
import { BUILDER_HERO_HREF, exampleSentences, type SetExample } from "../../lib/home/view";

const STEPS = [
  {
    title: "Wybierz klawiaturę",
    text: "Podajemy jej szerokość w centymetrach, bo od niej zależy rozmiar podkładki.",
  },
  {
    title: "Dobierz myszkę do dłoni",
    text: "Każda myszka ma zakres długości dłoni, dla którego ją zaprojektowano.",
  },
  {
    title: "Dopasuj podkładkę do biurka",
    text: "Kreator liczy, czy podkładka mieści klawiaturę i ruch myszki, i proponuje większy rozmiar, gdy czegoś brakuje.",
  },
] as const;

export function HowItWorks({ percent, example }: { percent: number; example: SetExample | null }) {
  return (
    <section className="sekcja--mod jak" aria-labelledby="jak-tytul">
      <div className="kontener jak__wnetrze">
        <h2 id="jak-tytul" className="blok__tytul">
          Jak działa set
        </h2>
        <p className="jak__wstep">
          {applyNbsp(`Za komplet klawiatury, myszki i podkładki odejmujemy ${percent}%.`)}
        </p>
        <ol className="lista jak__kroki">
          {STEPS.map((s) => (
            <li key={s.title} className="jak__krok">
              <h3 className="jak__krok-tytul">{applyNbsp(s.title)}</h3>
              <p className="jak__krok-tekst">{applyNbsp(s.text)}</p>
            </li>
          ))}
        </ol>
        {example ? (
          <p className="jak__przyklad" data-testid="przyklad-setu">
            {applyNbsp(exampleSentences(example).join(" "))}
          </p>
        ) : null}
        <div className="jak__akcje">
          <Link href={BUILDER_HERO_HREF} className="tk-btn tk-btn--glowny">
            Zbuduj set
          </Link>
        </div>
      </div>
    </section>
  );
}
