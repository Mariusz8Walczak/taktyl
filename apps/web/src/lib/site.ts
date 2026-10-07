// F-244: adres serwisu do adresow kanonicznych i danych strukturalnych. PUBLIC_SITE_URL ustawia budowa/proxy;
// zapas to adres lokalny z docs/14. Bez koncowego ukosnika.
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.PUBLIC_SITE_URL ?? "http://taktyl.localhost").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
