// F-001, F-067, F-106, A-02 (hak) (docs/05 §2 pkt 3, docs/01 §2.2; wzorzec: pierwszy ekran - wlasny uklad na siatce
// szablonu `home-setup-gear.html`, docs/08 §6). Lewo: H1, podtytul, dwa przyciski i pasek warunkow (liczby z ustawien
// sklepu); prawo: DeskStage z gotowym setem. Jeden przycisk glowny na ekranie; bez karuzeli, bez ikon (D-010).
import type { PublicShopSettings } from "@taktyl/contracts";
import { applyNbsp } from "@taktyl/domain";
import Link from "next/link";
import { BUILDER_HERO_HREF } from "../../lib/home/view";
import { ConditionsBar } from "../conditions-bar";
import { HeroDesk, type HeroDeskData } from "./hero-desk";

export function Hero({
  settings,
  desk,
}: {
  settings: PublicShopSettings;
  desk: HeroDeskData | null;
}) {
  return (
    <section className="hero" aria-labelledby="hero-tytul">
      <div className="kontener hero__siatka">
        <div className="hero__tekst">
          <h1 id="hero-tytul" className="naglowek-strony hero__h1">
            {applyNbsp("Złóż set, który pasuje do biurka i dłoni.")}
          </h1>
          <p className="wstep hero__podtytul">
            {applyNbsp(
              `Wybierz klawiaturę, myszkę i podkładkę. Sprawdzimy wymiary, zanim zapłacisz, a za komplet odejmiemy ${settings.set_discount.percent}%.`,
            )}
          </p>
          <div className="hero__akcje">
            <Link href={BUILDER_HERO_HREF} className="tk-btn tk-btn--glowny">
              Zbuduj set
            </Link>
            <a href="#gotowe-sety" className="tk-btn tk-btn--poboczny">
              Gotowe sety
            </a>
          </div>
          <div className="hero__warunki">
            <ConditionsBar settings={settings} />
          </div>
        </div>
        {desk ? (
          <div className="hero__scena-kolumna">
            <HeroDesk data={desk} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
