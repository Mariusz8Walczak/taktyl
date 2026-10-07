// F-001..F-009, F-067, F-106, F-111, A-02 (hak), F-242 (docs/05 §2, TAKTYL-37): strona glowna. Komponent serwerowy:
// pierwszy ekran z DeskStage (gotowy set "Programista"), kafle kategorii, "Jak dziala set" (sekcja ciemna z liczbami
// wyliczonymi z danych), gotowe sety i polecane. Dane z API przez to samo zrodlo co kreator (znaczniki product:{slug},
// category:{k}, catalog, rules, presets, shop-settings), wiec zmiana w backpanelu odswieza strone (ADR-0003).
// Nie ma: karuzeli, opinii, logotypow, licznika czasu, okien (docs/05 §2). Stopka (sekcja ciemna) jest w layoucie.
import type { Metadata } from "next";
import "../styles/home.css";
import { CategoryTiles } from "../components/home/category-tiles";
import { Featured } from "../components/home/featured";
import { Hero } from "../components/home/hero";
import { HowItWorks } from "../components/home/how-it-works";
import { PresetCards } from "../components/home/preset-cards";
import { getCategories, getShopSettings } from "../lib/api";
import { createModel } from "../lib/builder/catalog";
import { loadBuilderData } from "../lib/builder/data";
import {
  buildCategoryTiles,
  buildHeroDesk,
  buildPresetCards,
  buildSetExample,
} from "../lib/home/view";
import { homeJsonLd } from "../lib/home/json-ld";
import { jsonLdString } from "../lib/json-ld";
import { absoluteUrl } from "../lib/site";

export const metadata: Metadata = {
  title: { absolute: "Taktyl: klawiatury, myszki i podkładki, set dopasowany do biurka" },
  description:
    "Złóż set, który pasuje do biurka i dłoni: klawiatura, myszka i podkładka z kontrolą wymiarów w kreatorze. Za komplet rabat. Sklep demonstracyjny.",
  alternates: { canonical: absoluteUrl("/") },
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  const [settings, categories, data] = await Promise.all([
    getShopSettings(),
    getCategories(),
    loadBuilderData(),
  ]);
  const model = createModel(data);
  const hero = buildHeroDesk(model);
  const percent = settings.set_discount.percent;

  return (
    <>
      <Hero settings={settings} desk={hero?.data ?? null} />
      <CategoryTiles tiles={buildCategoryTiles(categories, model)} />
      <HowItWorks percent={percent} example={buildSetExample(model)} />
      <PresetCards cards={buildPresetCards(model)} percent={percent} />
      <Featured />
      {homeJsonLd().map((ld) => (
        <script
          key={String(ld["@type"])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }}
        />
      ))}
    </>
  );
}
