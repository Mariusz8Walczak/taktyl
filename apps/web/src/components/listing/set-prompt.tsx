// F-020, docs/05 §3 pkt 8: wstawka po 6. karcie (klawiatury i podkladki) - jeden wiersz na pelna szerokosc siatki
// z przyciskiem do kreatora. Wzorzec: baner w siatce produktow szablonu (docs/08 §3).
export function SetPrompt() {
  return (
    <li className="siatka__wstawka">
      <p className="siatka__wstawka-tekst">
        Nie wiesz, co pasuje? Zbuduj set — sprawdzimy wymiary.
      </p>
      <a href="/zbuduj-set" className="tk-btn tk-btn--poboczny">
        Zbuduj set
      </a>
    </li>
  );
}
