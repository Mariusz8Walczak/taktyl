// F-001, F-002, F-004, F-009, F-241, F-244, F-245 (TAKTYL-23): uklad bazowy sklepu.
// Kolejnosc CSS (docs/06 §6): tokens.css -> taktyl.css -> style komponentow @taktyl/ui -> style ukladu.
import "@taktyl/tokens/tokens.css";
import "@taktyl/tokens/taktyl.css";
import "@taktyl/ui/ui.css";
import "../styles/rozmiary.css";
import "../styles/baza.css";
import "../styles/naglowek.css";
import "../styles/stopka.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DemoBar } from "../components/layout/demo-bar";
import { DemoBarScript } from "../components/layout/demo-bar-script";
import { Footer } from "../components/layout/footer";
import { Header } from "../components/layout/header";
import { MAIN_ID, SkipLink } from "../components/layout/skip-link";
import { Providers } from "../components/providers";
import { getShopSettings } from "../lib/api";
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
};

// Bez maximum-scale i user-scalable (docs/12 §4)
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getShopSettings();
  return (
    <html lang="pl" className={archivo.variable} suppressHydrationWarning>
      <body>
        <DemoBarScript />
        <SkipLink />
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
