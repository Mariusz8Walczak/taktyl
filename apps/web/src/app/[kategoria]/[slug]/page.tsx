// F-060...F-073, F-078, F-008 (docs/05 §4): karta produktu /{kategoria}/{slug}. Wzorzec: `product-detail` (docs/08 §3).
// Komponent serwerowy pobiera produkt, slowniki, ustawienia i termin wysylki z API (tagi product:{slug},
// category:{kategoria}, catalog, shop-settings); wybor wariantu, galeria i zakup to wyspy klienckie w jednym
// dostawcy. Adres kanoniczny bez parametru, `?sku=` wybiera wariant. Dane strukturalne Product bez aggregateRating.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../../styles/produkt.css";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { ConditionsBar } from "../../../components/conditions-bar";
import { CompleteSet } from "../../../components/product/complete-set";
import { BuyColumn } from "../../../components/product/buy-column";
import { Gallery } from "../../../components/product/gallery";
import { ProductProvider } from "../../../components/product/product-context";
import { buildSections } from "../../../components/product/product-sections";
import { ProductTabs } from "../../../components/product/product-tabs";
import { StickyBar } from "../../../components/product/sticky-bar";
import {
  getCategoryBySlug,
  getColors,
  getProduct,
  getShippingEstimate,
  getShopSettings,
  getSwitches,
} from "../../../lib/api";
import { dispatchTexts, type DispatchTexts } from "../../../lib/catalog/dispatch";
import { productJsonLd, toClientProduct } from "../../../lib/catalog/product-view";
import { jsonLdString } from "../../../lib/json-ld";
import { absoluteUrl } from "../../../lib/site";

type Props = {
  params: Promise<{ kategoria: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategoria, slug } = await params;
  const category = await getCategoryBySlug(kategoria);
  const product = category ? await getProduct(slug, category.id) : null;
  if (!category || !product || product.category !== category.id) {
    return { title: "Nie ma takiej strony", robots: { index: false, follow: false } };
  }
  return {
    title: product.name,
    description: product.short,
    alternates: { canonical: absoluteUrl(`/${category.slug}/${product.slug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { kategoria, slug } = await params;
  const sp = await searchParams;
  const category = await getCategoryBySlug(kategoria);
  if (!category) notFound();
  const product = await getProduct(slug, category.id);
  if (!product || product.category !== category.id) notFound();

  const [colors, switches, settings, estimate] = await Promise.all([
    getColors(),
    getSwitches(),
    getShopSettings(),
    getShippingEstimate("kurier").catch(() => null), // termin to dodatek: brak API nie psuje karty
  ]);

  const skuParam = Array.isArray(sp.sku) ? sp.sku[0] : sp.sku;
  const initialSku = product.variants.some((v) => v.sku === skuParam) ? (skuParam ?? null) : null;
  const dispatch: DispatchTexts | null = estimate
    ? dispatchTexts(estimate, {
        cutoffHour: settings.dispatch_cutoff_hour,
        timeZone: settings.timezone,
      })
    : null;
  const defaultVariant =
    product.variants.find((v) => v.sku === product.default_variant_sku) ?? product.variants[0];

  return (
    <div className="kontener strona strona--produkt">
      <Breadcrumbs
        items={[
          { label: "Strona główna", href: "/" },
          { label: category.name, href: `/${category.slug}` },
          { label: product.name },
        ]}
      />
      <ProductProvider
        product={toClientProduct(product)}
        colors={colors.map((c) => ({ id: c.id, label: c.label, swatch: c.swatch }))}
        switches={switches.map((s) => ({
          id: s.id,
          name: s.name,
          type_label: s.type_label,
          force_g: s.force_g,
        }))}
        initialSku={initialSku}
        categoryName={category.name}
      >
        <div className="produkt">
          <div className="produkt__galeria">
            <Gallery />
          </div>
          <div className="produkt__zakup">
            <BuyColumn conditions={<ConditionsBar settings={settings} />} dispatch={dispatch} />
          </div>
        </div>

        {/* F-069, TAKTYL-38: "Dokończ set" - dane z GET /v1/products/{slug}/complete-set; ukryty bez kompletu */}
        <CompleteSet
          product={product}
          sku={initialSku ?? product.default_variant_sku}
          colors={colors.map((c) => ({
            id: c.id,
            label: c.label,
            swatch: c.swatch,
            harmony: c.harmony,
            code: c.code,
          }))}
          switches={switches.map((s) => ({
            id: s.id,
            name: s.name,
            type_label: s.type_label,
            force_g: s.force_g,
            sound: s.sound,
          }))}
          settings={settings}
        />

        <ProductTabs sections={buildSections(product, settings, switches)} />
        <StickyBar />
      </ProductProvider>

      {defaultVariant ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd(product, defaultVariant)) }}
        />
      ) : null}
    </div>
  );
}
