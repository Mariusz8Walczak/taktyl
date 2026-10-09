// F-001, F-002, F-004, F-009, F-241, F-244, F-245 (TAKTYL-23): uklad bazowy sklepu.
// Kolejnosc CSS (docs/06 §6): tokens.css -> taktyl.css -> style komponentow @taktyl/ui -> style ukladu; wszystko
// w jednym arkuszu globalne.css (TAKTYL-84: mniej plikow CSS blokujacych render).
import "../styles/globalne.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ConsentManager } from "../components/consent/consent-manager";
import { DemoBar } from "../components/layout/demo-bar";
import { DemoBarScript } from "../components/layout/demo-bar-script";
import { Footer } from "../components/layout/footer";
import { Header } from "../components/layout/header";
import { MAIN_ID, SkipLink } from "../components/layout/skip-link";
import { Providers } from "../components/providers";
import { getShopSettings } from "../lib/api";
import { CONSENT_BOOTSTRAP_SCRIPT } from "../lib/consent/bootstrap";
import { archivo } from "./fonts";

// Dane z API sa pobierane przy zadaniu (cache danych Next z tagami i revalidate 300 s, docs/14 §5), wiec build
// obrazu nie wymaga dzialajacego API. Strony, ktore chca ISR, ustawia kolejne zadania.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Taktyl", template: "%s | Taktyl" },
  description:
    "Taktyl: klawiatury, myszki i podkładki. Złóż set, który pasuje do biurka i dłoni. Sklep demonstracyjny.",
  // F-244: noindex w meta (nagłówek X-Robots-Tag ustawia next.config i proxy)
  robots: { index: false, follow: false },
  // docs/09 §7: znak od wlasciciela (public/favicon.*, apple-touch-icon.png)
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  // docs/09 §7: kadr setu z gory, 1200 x 630
  openGraph: { images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
};

// Bez maximum-scale i user-scalable (docs/12 §4)
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getShopSettings();
  // GTM tylko gdy ustawiono (PUBLIC_GTM_ID z compose, zapas NEXT_PUBLIC_GTM_ID); i tak laduje sie dopiero po zgodzie
  const gtmId = process.env.PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_GTM_ID || undefined;
  return (
    <html lang="pl" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* F-240/F-242 (docs/10 §2): tryb zgody (default denied) jako pierwszy tag w <head>, przed paczkami Next */}
        <script id="tryb-zgody" dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <DemoBarScript />
        <SkipLink />
        <ConsentManager gtmId={gtmId} />
        <Providers>
          <DemoBar label={settings.demo.label} />
          <Header />
          <main id={MAIN_ID} tabIndex={-1} className="tresc">
            {children}
          </main>
          <Footer settings={settings} />
        </Providers>
      </body>
    </html>
  );
}
