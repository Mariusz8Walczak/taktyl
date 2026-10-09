// TAKTYL-70 (SEC-04, docs/14 par. 7 A05, docs/22): Content-Security-Policy sklepu, wyliczana przy budowie (next.config.mjs).
// Sklep rozmawia tylko z wlasnym hostem (route handlery /api/*), zdjecia i czcionki sa lokalne, wiec polityka jest waska.
// `script-src` zawiera 'unsafe-inline': Next 15 wstrzykuje inline skrypty hydratacji, a skrypty trybu zgody i paska demo oraz
// JSON-LD sa inline. Wersja z nonce wymusilaby renderowanie dynamiczne kazdej strony (koniec ISR i znacznikow, ADR-0003),
// wiec zostaje jako Q-09 w docs/decyzje.md. Reszta dyrektyw (object-src, base-uri, frame-ancestors, form-action) domyka
// wstrzykiwanie znacznikow, ramek i przechwytywanie formularzy.
// GTM (docs/10) jest dopuszczony tylko wtedy, gdy PUBLIC_GTM_ID jest ustawione przy budowie.

/** @param {{ gtm?: boolean }} [opts] */
export function buildCsp(opts = {}) {
  const gtm = opts.gtm === true;
  const googleScripts = gtm ? ["https://www.googletagmanager.com"] : [];
  const googleConnect = gtm
    ? [
        "https://www.googletagmanager.com",
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
      ]
    : [];
  const directives = {
    "default-src": ["'self'"],
    // ADR-0011: dekoder Draco konfiguratora 3D to WebAssembly uruchamiany w workerze z blob: (`worker-src`); `'unsafe-eval'` nadal zakazany.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...googleScripts],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...googleConnect],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...googleConnect],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
