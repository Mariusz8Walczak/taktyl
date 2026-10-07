// F-009, F-247, wzorzec: stopka szablonu (4 kolumny), sekcja ciemna .sekcja--mod. Metody platnosci i dostawy
// TEKSTEM z ustawien sklepu, bez logotypow i bez odnosnika do platformy ODR (docs/11 §1.3). Dane kontaktowe
// tylko fikcyjne, w domenie z ustawien (taktyl.example).
import type { PublicShopSettings } from "@taktyl/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { FOOTER_HELP, FOOTER_LEGAL, FOOTER_SHOP } from "../../lib/nav";
import type { NavItem } from "../../lib/nav";
import { CookieSettingsButton } from "../consent/cookie-settings-button";
import { Newsletter } from "../forms/newsletter";

function LinkColumn({
  title,
  items,
  extra,
}: {
  title: string;
  items: readonly NavItem[];
  extra?: ReactNode | ReactNode[];
}) {
  const extras = Array.isArray(extra) ? extra : extra ? [extra] : [];
  return (
    <div className="stopka__kolumna">
      <h2 className="stopka__tytul">{title}</h2>
      <ul className="lista">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="stopka__link">
              {item.label}
            </Link>
          </li>
        ))}
        {extras.map((node, i) => (
          <li key={i}>{node}</li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ settings }: { settings: PublicShopSettings }) {
  const { demo, shipping_methods, payment_methods, company } = settings;
  const pickupAddress = shipping_methods.find((m) => m.address)?.address ?? null;
  const email = `kontakt@${demo.email_domain}`;
  const phoneHref = `tel:${demo.phone.replace(/[^\d+]/g, "")}`;
  return (
    <footer className="stopka sekcja--mod">
      <div className="kontener">
        <div className="stopka__siatka">
          <LinkColumn title="Sklep" items={FOOTER_SHOP} />
          <LinkColumn title="Pomoc" items={FOOTER_HELP} />
          <LinkColumn
            title="Informacje prawne"
            items={FOOTER_LEGAL}
            extra={[
              <CookieSettingsButton key="cookies" />,
              // F-010: otwiera liste skrotow (delegacja w ShortcutsHost), takze po ich wylaczeniu (WCAG 2.1.4)
              <button
                key="skroty"
                type="button"
                className="stopka__link stopka__link--przycisk"
                data-otworz-skroty=""
              >
                Skróty klawiszowe
              </button>,
            ]}
          />
          <div className="stopka__kolumna">
            <h2 className="stopka__tytul">Kontakt</h2>
            <address className="stopka__adres">
              <p>{company.name ?? "Taktyl (podmiot fikcyjny)"}</p>
              {pickupAddress ? <p>{pickupAddress}</p> : null}
              <p>
                <a className="stopka__link" href={`mailto:${email}`}>
                  {email}
                </a>
              </p>
              <p>
                <a className="stopka__link" href={phoneHref}>
                  {demo.phone}
                </a>
              </p>
              <p>Nr BDO: — (sklep fikcyjny)</p>
            </address>
          </div>
        </div>
        {/* F-223, TAKTYL-58: zapis do newslettera (znaczniki z serwera, logika leniwie) */}
        <Newsletter />
        <div className="stopka__dol">
          <p className="stopka__demo">{demo.label}</p>
          <p className="stopka__info">
            <span className="stopka__etykieta">Płatności:</span>{" "}
            {payment_methods.map((m) => m.label).join(", ")}.
          </p>
          <p className="stopka__info">
            <span className="stopka__etykieta">Dostawa:</span>{" "}
            {shipping_methods.map((m) => m.label).join(", ")}.
          </p>
        </div>
      </div>
    </footer>
  );
}
