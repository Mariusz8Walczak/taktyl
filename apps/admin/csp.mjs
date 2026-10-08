// TAKTYL-70 (SEC-04, docs/14 par. 7 A05, docs/22): Content-Security-Policy backpanelu, wyliczana przy budowie.
// Panel nie laduje niczego z zewnatrz; zdjecia produktow (podglad w ekranie Media) pochodza z hosta sklepu (/media),
// dlatego `img-src` zawiera origin PUBLIC_SITE_URL. `script-src` ma 'unsafe-inline' z powodu skryptow hydratacji Next
// (nonce: Q-09 w docs/decyzje.md). Dyrektywy object-src, base-uri, form-action i frame-ancestors sa zamkniete.

/** @param {{ siteUrl?: string }} [opts] */
export function buildCsp(opts = {}) {
  let siteOrigin = "";
  try {
    if (opts.siteUrl) siteOrigin = new globalThis.URL(opts.siteUrl).origin;
  } catch {
    siteOrigin = "";
  }
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(siteOrigin ? [siteOrigin] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
