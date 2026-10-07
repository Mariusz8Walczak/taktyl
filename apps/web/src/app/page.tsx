// Tymczasowa strona glowna (TAKTYL-23): sam H1 i odnosnik. Wlasciwa strona glowna to TAKTYL-37 (docs/05 §2).
import { applyNbsp } from "@taktyl/domain";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">{applyNbsp("Złóż set, który pasuje do biurka i dłoni.")}</h1>
      <p className="wstep">
        <Link href="/klawiatury" className="tk-link">
          Zobacz klawiatury
        </Link>
      </p>
    </div>
  );
}
