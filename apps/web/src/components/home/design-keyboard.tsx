"use client";
// F-250, audyt P0-3, A-05 (wybor stylu): sekcja "Zaprojektuj klawiaturę" na glownej. Model 3D (ModelPreview: render
// z manifestu do czasu aktywacji, scena po najechaniu kursorem albo "Obróć w 3D") i trzy gotowe style w kolorach serii.
// Wybor stylu przemalowuje model i zmienia adres "Otwórz w konfiguratorze" (stan w ?sku=). Wzorzec: lookbook z kartami
// wyboru (`home-setup-gear.html`, docs/08 §6) + kafel wyboru (radio) z probka koloru z colors.json.
import { ChoiceTile, ProductImage } from "@taktyl/ui";
import Link from "next/link";
import { useState } from "react";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import type { DesignSection } from "../../lib/home/design";
import { ModelPreview } from "../configurator/model-preview";

export function DesignKeyboard({ section }: { section: DesignSection }) {
  const [styleId, setStyleId] = useState(section.styles[0]?.id ?? "");
  const style = section.styles.find((s) => s.id === styleId) ?? section.styles[0];
  if (!style) return null;
  return (
    <section className="blok blok--projekt" aria-labelledby="projekt-tytul">
      <div className="kontener projekt">
        <div className="projekt__opis">
          <h2 id="projekt-tytul" className="blok__tytul">
            Zaprojektuj klawiaturę
          </h2>
          <p className="blok__wstep">
            Wybierz kolor obudowy, klawiszy i nadruków, a model 3D pokaże efekt od razu. Zacznij
            od jednego ze stylów i zmień, co chcesz, w konfiguratorze.
          </p>
          <fieldset className="projekt__style">
            <legend className="projekt__legenda">Styl: {section.productName}</legend>
            {section.styles.map((s) => (
              <ChoiceTile
                key={s.id}
                className="projekt__styl"
                name="projekt-styl"
                value={s.id}
                checked={s.id === style.id}
                onChange={() => setStyleId(s.id)}
                title={
                  <span className="projekt__tytul-stylu">
                    <span className="projekt__probki" aria-hidden="true">
                      {s.swatches.map((sw) => (
                        <span
                          key={sw}
                          className="projekt__probka"
                          style={{ backgroundColor: sw }}
                        />
                      ))}
                    </span>
                    {s.label}
                  </span>
                }
              />
            ))}
          </fieldset>
          <p className="projekt__akcje">
            <Link href={style.href} className="tk-btn tk-btn--glowny">
              Otwórz w konfiguratorze
            </Link>
            <Link href={section.productHref} className="tk-link">
              Zobacz {section.productName}
            </Link>
          </p>
        </div>
        <ModelPreview
          className="projekt__model"
          modelId={section.modelId}
          title={`Podgląd 3D: ${section.productName}, styl ${style.label}`}
          parts={style.parts}
          loadOnHover
          placeholder={
            <ProductImage
              entry={style.image}
              baseUrl={MEDIA_BASE_URL}
              productName={section.productName}
              colorName={style.label}
              sizes="(min-width: 992px) 45vw, 100vw"
            />
          }
        />
      </div>
    </section>
  );
}
