// F-070...F-073 (docs/05 §4 pkt 12): tresc zakladek karty - opis, specyfikacja (<table> z naglowkami wierszy),
// "W zestawie" (ukryta, gdy pusta), "Bezpieczenstwo produktu" (GPSR z danych), "Dostawa i zwroty" (z ustawien).
// Komponenty serwerowe; jedyny element zalezny od wariantu to wartosci wierszy z VariantSpecValue.
import type { Product, PublicShopSettings } from "@taktyl/contracts";
import { applyNbsp, formatPLN, pluralize } from "@taktyl/domain";
import { SpecTable } from "@taktyl/ui";
import { specRows, variantSpecRows, type SwitchLike } from "../../lib/catalog/attributes";
import { formatPLNShort } from "../../lib/format";
import type { TabSection } from "./product-tabs";
import { VariantSpecValue } from "./variant-spec-value";

const DAYS = { one: "dzień roboczy", few: "dni robocze", many: "dni roboczych" } as const;

function Description({ product }: { product: Product }) {
  const text = product.description?.trim() ? product.description : product.short;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="tekst-produktu">
      {paragraphs.map((p, i) => (
        <p key={i}>{applyNbsp(p)}</p>
      ))}
    </div>
  );
}

function Specification({
  product,
  switches,
}: {
  product: Product;
  switches: readonly SwitchLike[];
}) {
  const defaultVariant =
    product.variants.find((v) => v.sku === product.default_variant_sku) ?? product.variants[0];
  const variantLabels = defaultVariant
    ? variantSpecRows(
        {
          category: product.category,
          ...(product.category === "podkladki" ? { sizes: product.attributes.sizes } : {}),
        },
        defaultVariant,
        switches,
      ).map((r) => r.label)
    : [];
  const rows = [
    ...specRows(product).map((r) => ({ label: r.label, value: r.value })),
    ...variantLabels.map((label) => ({ label, value: <VariantSpecValue label={label} /> })),
  ];
  return <SpecTable caption={`Specyfikacja: ${product.name}`} rows={rows} />;
}

function Delivery({ settings }: { settings: PublicShopSettings }) {
  return (
    <div className="tekst-produktu">
      <ul className="lista dostawa-lista">
        {settings.shipping_methods.map((m) => (
          <li key={m.id}>
            <strong>{m.label}</strong>
            {": "}
            {m.price_gr === 0 ? "bezpłatnie" : formatPLN(m.price_gr)}
            {m.eta_business_days > 0
              ? `, dostawa w ${m.eta_business_days}\u00A0${pluralize(m.eta_business_days, DAYS)}`
              : ""}
            {m.address ? `, ${m.address}` : ""}
          </li>
        ))}
      </ul>
      <p>
        Darmowa dostawa od {formatPLNShort(settings.free_shipping_threshold_gr)}. Ceny są cenami
        brutto.
      </p>
      <p>
        {`Ustawowo masz ${settings.statutory_withdrawal_days} dni na odstąpienie od umowy. W Taktylu — ${settings.returns_days}.`}
      </p>
    </div>
  );
}

function Safety({ product }: { product: Product }) {
  const g = product.gpsr;
  return (
    <dl className="gpsr">
      <div>
        <dt>Producent</dt>
        <dd>{g.manufacturer}</dd>
      </div>
      <div>
        <dt>Adres</dt>
        <dd>{g.address}</dd>
      </div>
      <div>
        <dt>Kontakt</dt>
        <dd>
          <a className="tk-link" href={`mailto:${g.contact}`}>
            {g.contact}
          </a>
        </dd>
      </div>
      <div>
        <dt>Ostrzeżenia</dt>
        <dd>{g.warnings}</dd>
      </div>
    </dl>
  );
}

export function buildSections(
  product: Product,
  settings: PublicShopSettings,
  switches: readonly SwitchLike[],
): TabSection[] {
  const sections: TabSection[] = [
    { id: "opis", title: "Opis", content: <Description product={product} /> },
    {
      id: "specyfikacja",
      title: "Specyfikacja",
      content: <Specification product={product} switches={switches} />,
    },
  ];
  if (product.in_box.length > 0) {
    sections.push({
      id: "w-zestawie",
      title: "W zestawie",
      content: (
        <ul className="tekst-produktu">
          {product.in_box.map((item) => (
            <li key={item}>{applyNbsp(item)}</li>
          ))}
        </ul>
      ),
    });
  }
  sections.push(
    {
      id: "bezpieczenstwo",
      title: "Bezpieczeństwo produktu",
      content: <Safety product={product} />,
    },
    { id: "dostawa", title: "Dostawa i zwroty", content: <Delivery settings={settings} /> },
  );
  return sections;
}
