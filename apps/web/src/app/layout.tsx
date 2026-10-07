// I-001: tymczasowy szkielet; wyglad i tresci dodaja TAKTYL-23 (sklep) i TAKTYL-50 (backpanel).
import type { ReactNode } from "react";

export const metadata = {
  title: "Taktyl (web) - szkielet techniczny",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
