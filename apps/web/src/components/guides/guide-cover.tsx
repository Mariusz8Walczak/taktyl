// F-220 (docs/09 §7): grafika artykulu 1200 x 675 od czlowieka, public/img/poradnik/{slug}.webp (+ @2x). Dekoracja
// (alt=""), tytul niesie naglowek. Brak pliku dla nowego sluga = pusty obraz, wiec tylko dla czterech znanych poradnikow.
const KNOWN = new Set([
  "jak-wybrac-przelaczniki",
  "rozmiary-klawiatur",
  "jak-dobrac-mysz-do-dloni",
  "jaka-podkladka",
]);

export function GuideCover({ slug, loading = "eager" }: { slug: string; loading?: "eager" | "lazy" }) {
  if (!KNOWN.has(slug)) return null;
  return (
    <img
      className="poradnik-okladka"
      src={`/img/poradnik/${slug}.webp`}
      srcSet={`/img/poradnik/${slug}.webp 1200w, /img/poradnik/${slug}@2x.webp 2400w`}
      sizes="(min-width: 768px) 720px, 100vw"
      width={1200}
      height={675}
      alt=""
      loading={loading}
      decoding="async"
    />
  );
}
