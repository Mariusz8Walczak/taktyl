// F-250..F-254 (ADR-0011): strona konfiguratora kolorow /konfigurator/[model]. Serwer pobiera slowniki z API i
// odtwarza wybory z `?sku=`; scena 3D (three.js) laduje sie dopiero w przegladarce. Strona ma noindex.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseConfigurationSku, resolveConfiguration } from "@taktyl/domain";
import "../../../styles/konfigurator.css";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { Configurator } from "../../../components/configurator/configurator";
import { getConfiguratorData } from "../../../lib/configurator/data";
import { findModelById, toDomainData } from "../../../lib/configurator/model";

type Props = {
  params: Promise<{ model: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CATEGORY_OF: Record<string, string> = { k: "klawiatury", m: "myszki", p: "podkladki" };
const CATEGORY_LABEL: Record<string, string> = {
  klawiatury: "Klawiatury",
  myszki: "Myszki",
  podkladki: "Podkładki",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { model } = await params;
  const data = await getConfiguratorData();
  const m = findModelById(data, model);
  return {
    title: m ? `Dostosuj kolory: ${m.name}` : "Konfigurator",
    description: "Dobierz kolory i wykończenia części, obejrzyj produkt w 3D i sprawdź cenę.",
    robots: { index: false, follow: false },
  };
}

export default async function ConfiguratorPage({ params, searchParams }: Props) {
  const [{ model: modelId }, sp, data] = await Promise.all([
    params,
    searchParams,
    getConfiguratorData(),
  ]);
  const model = findModelById(data, modelId);
  if (!model) notFound();

  const domainData = toDomainData(data);
  const skuParam = Array.isArray(sp.sku) ? sp.sku[0] : sp.sku;
  const parsed = skuParam ? parseConfigurationSku(domainData, skuParam) : null;
  const initial =
    parsed && parsed.model === model.id
      ? resolveConfiguration(domainData, parsed)
      : resolveConfiguration(domainData, { model: model.id, parts: {}, print: null });

  const category = CATEGORY_OF[model.product.charAt(0)] ?? "klawiatury";
  const slug = model.product.slice(2);
  const name = model.size ? `${model.name} ${model.size.toUpperCase()}` : model.name;

  return (
    <div className="kontener strona strona--konfigurator">
      <Breadcrumbs
        items={[
          { label: "Strona główna", href: "/" },
          { label: CATEGORY_LABEL[category] ?? category, href: `/${category}` },
          { label: model.name, href: `/${category}/${slug}` },
          { label: "Dostosuj kolory" },
        ]}
      />
      <h1>Dostosuj kolory: {name}</h1>
      <p className="wstep">
        Wybierz kolor i wykończenie każdej części. Podgląd obracasz myszą, palcem albo przyciskami
        pod modelem. Cenę i kod zestawienia liczy sklep.
      </p>
      <Configurator
        data={data}
        model={model}
        productName={name}
        productHref={`/${category}/${slug}`}
        initial={initial.config}
      />
    </div>
  );
}
