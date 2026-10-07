"use client";
// F-060, A-13 (pominiete, P1) (wzorzec: galeria `product-detail`, docs/08 §3): zdjecie glowne wybranego wariantu
// + miniatury. Na telefonie ujecia przewijane gestem (scroll-snap), na komputerze jedno ujecie wybierane miniatura.
// Zdjecia tylko z manifestu (docs/09); brak zdjecia = placeholder o tych samych wymiarach. Miniatura to przycisk
// z aria-label ("Pokaż ujęcie: widok z góry") i widocznym podpisem, obraz w miniaturze ma alt="".
import { ProductImage } from "@taktyl/ui";
import { useRef, useState } from "react";
import { MEDIA_BASE_URL, packshotsFor, toManifestEntry } from "../../lib/catalog/images";
import { useProduct } from "./product-context";

const MAIN_SIZES = "(min-width: 992px) 58vw, 100vw";
const THUMB_SIZES = "20vw";

export function Gallery() {
  const { variant } = useProduct();
  // Zmiana koloru = nowy komplet ujec: stan galerii zaczyna od pierwszego
  return <GalleryShots key={variant.images_key} />;
}

function GalleryShots() {
  const { product, variant, colorLabel } = useProduct();
  const shots = packshotsFor(product.images, product.id, variant.images_key);
  const [active, setActive] = useState(0);
  const slidesRef = useRef<HTMLUListElement>(null);

  function show(i: number) {
    setActive(i);
    const el = slidesRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
    }
  }

  function onScroll() {
    const el = slidesRef.current;
    if (!el || el.clientWidth === 0 || el.scrollWidth <= el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active && i >= 0 && i < shots.length) setActive(i);
  }

  if (shots.length === 0) return <div className="galeria" />;

  return (
    <div className="galeria">
      <ul
        ref={slidesRef}
        className="lista galeria__slajdy"
        onScroll={onScroll}
        aria-label="Zdjęcia produktu"
      >
        {shots.map((shot, i) => (
          <li
            key={shot.key}
            className={i === active ? "galeria__slajd is-aktywny" : "galeria__slajd"}
          >
            <ProductImage
              entry={toManifestEntry(shot)}
              baseUrl={MEDIA_BASE_URL}
              productName={product.name}
              colorName={colorLabel}
              sizes={MAIN_SIZES}
              priority={i === 0}
            />
          </li>
        ))}
      </ul>
      {shots.length > 1 ? (
        <ul className="lista galeria__miniatury">
          {shots.map((shot, i) => {
            const opis = shot.description ?? shot.shot ?? "ujęcie";
            return (
              <li key={shot.key}>
                <button
                  type="button"
                  className="galeria__miniatura"
                  aria-label={`Pokaż ujęcie: ${opis}`}
                  aria-pressed={i === active}
                  onClick={() => show(i)}
                >
                  <ProductImage
                    entry={toManifestEntry(shot)}
                    baseUrl={MEDIA_BASE_URL}
                    productName={product.name}
                    colorName={colorLabel}
                    sizes={THUMB_SIZES}
                    decorative
                    className="galeria__obraz-miniatury"
                  />
                  <span className="galeria__podpis" aria-hidden="true">
                    {opis}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
