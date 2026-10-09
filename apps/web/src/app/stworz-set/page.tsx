// F-255 (ADR-0011): strona „Stworz wlasny set”. Serwer pobiera slowniki z API i odtwarza wybory z adresu
// (`?k=&m=&p=` to kody zestawien); scena 3D i wycena dzialaja w przegladarce. Strona ma noindex.
import type { Metadata } from "next";
import { parseConfigurationSku, resolveConfiguration, defaultConfiguration } from "@taktyl/domain";
import "../../styles/konfigurator.css";
import { SetCreator } from "../../components/configurator/set-creator";
import { getConfiguratorData } from "../../lib/configurator/data";
import { toDomainData } from "../../lib/configurator/model";

export const metadata: Metadata = {
  title: "Stwórz własny set",
  description:
    "Klawiatura, mysz i podkładka w kolorach, jakich nie ma na półce. Złóż set na biurku w 3D, a za komplet dostaniesz rabat.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DEFAULTS = { k: "k-kwarc-60", m: "m-wrobel", p: "p-tafla_l" } as const;
const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function CreateSetPage({ searchParams }: Props) {
  const [sp, data] = await Promise.all([searchParams, getConfiguratorData()]);
  const domainData = toDomainData(data);

  const initial = {} as Parameters<typeof SetCreator>[0]["initial"];
  for (const slot of ["k", "m", "p"] as const) {
    const code = first(sp[slot]);
    const parsed = code ? parseConfigurationSku(domainData, code) : null;
    const model =
      (parsed && domainData.models.find((m) => m.id === parsed.model)) ||
      domainData.models.find((m) => m.id === DEFAULTS[slot]) ||
      domainData.models.find((m) => m.id.startsWith(`${slot}-`))!;
    const config = resolveConfiguration(
      domainData,
      parsed && parsed.model === model.id ? parsed : defaultConfiguration(model),
    ).config;
    initial[slot] = { modelId: model.id, config };
  }

  return (
    <div className="kontener strona strona--konfigurator">
      <header className="konfigurator__naglowek">
        <p className="konfigurator__nadtytul">Tylko u nas</p>
        <h1>Stwórz własny set</h1>
        <p className="wstep">
          Ty decydujesz o każdym szczególe: kolor obudowy, klawiszy i nadruków, wykończenie, wzór
          podkładki. Zobacz całość na biurku w 3D, zanim cokolwiek zamówisz.
        </p>
        <ul className="konfigurator__zalety">
          <li>
            <strong>Dowolny wygląd.</strong> Każda część w osobnym kolorze, bez gotowych zestawień.
          </li>
          <li>
            <strong>Podgląd na biurku.</strong> Klawiatura, mysz i podkładka razem, do obrócenia ze
            wszystkich stron.
          </li>
          <li>
            <strong>Rabat za komplet.</strong> Trzy elementy w jednym secie kosztują mniej niż
            osobno.
          </li>
        </ul>
      </header>
      <SetCreator data={data} initial={initial} />
    </div>
  );
}
