// F-200, F-201 (docs/05 §1): wspolny naglowek strony konta demo. Tresc i bramka logowania demo: wyspy klienckie.
import type { ReactNode } from "react";
import "../../styles/konto.css";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">Konto</h1>
      <p className="wstep">
        Konto demonstracyjne: bez hasła i bez prawdziwych danych. Pokazuje to, co zapisano w tej
        przeglądarce.
      </p>
      {children}
    </div>
  );
}
