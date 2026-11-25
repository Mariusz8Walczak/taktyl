// F-244, F-078 (audyt P1-14): JEDNA zmienna adresu serwisu (PUBLIC_SITE_URL) dla adresow kanonicznych, Open Graph
// (metadataBase w layout.tsx) i danych strukturalnych. Musi zawierac port, gdy proxy nie stoi na 80
// (np. http://taktyl.localhost:8188). Czytana przy zadaniu (strony sa dynamiczne), wiec wystarczy .env stosu.
// Zapas to adres lokalny z docs/14. Bez koncowego ukosnika.
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.PUBLIC_SITE_URL ?? "http://taktyl.localhost").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Adres bezwzgledny pliku z wolumenu media (proxy: /media/*), np. do og:image i JSON-LD `image`. */
export function absoluteMediaUrl(file: string): string {
  return absoluteUrl(`/media/${file.replace(/^\/+/, "")}`);
}
