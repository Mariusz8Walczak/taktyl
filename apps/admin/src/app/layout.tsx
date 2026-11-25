// B-001, B-009 (TAKTYL-50): uklad glowny backpanelu. Kolejnosc CSS (docs/06 §6): tokens -> taktyl -> ui -> arkusze panelu.
import "@taktyl/tokens/tokens.css";
import "@taktyl/tokens/taktyl.css";
import "@taktyl/ui/ui.css";
import "../styles/rozmiary.css";
import "../styles/baza.css";
import "../styles/uklad.css";
import "../styles/komponenty.css";
import "../styles/pulpit.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "../components/providers";
import { SkipLink } from "../components/skip-link";
import { THEME_BOOT_SCRIPT } from "../lib/theme-boot";
import { archivo } from "./fonts";

export const metadata: Metadata = {
  title: { default: "Backpanel Taktyl", template: "%s | Backpanel Taktyl" },
  // docs/15 §13: noindex w meta (naglowek X-Robots-Tag ustawiaja next.config i proxy)
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={archivo.variable} suppressHydrationWarning>
      <head>
        {/* B-627: motyw przed pierwszym malowaniem (CSP panelu dopuszcza skrypty inline, Q-09) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
