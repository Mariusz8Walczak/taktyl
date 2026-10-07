// F-203, F-114 (docs/05 §1): /konto/sety - zapisane sety (`taktyl.sets.v1`, maks. 10). Katalog (nazwy i ceny pozycji) czyta serwer.
import type { Metadata } from "next";
import { AccountGate } from "../../../components/account/account-gate";
import { SavedSetsPage } from "../../../components/account/saved-sets";
import { getShopSettings } from "../../../lib/api";
import { loadCatalogLite } from "../../../lib/compare/load-lite";

export const metadata: Metadata = { title: "Zapisane sety" };

export default async function SetsRoute() {
  const [catalog, settings] = await Promise.all([loadCatalogLite(), getShopSettings()]);
  return (
    <AccountGate current="sety">
      <h2 className="konto__podtytul">Zapisane sety</h2>
      <SavedSetsPage catalog={catalog} timeZone={settings.timezone} />
    </AccountGate>
  );
}
