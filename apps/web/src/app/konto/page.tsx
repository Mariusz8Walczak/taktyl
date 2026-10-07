// F-200, F-201 (docs/05 §1): /konto - skrot: ostatnie zamowienie, zapisane sety, ulubione.
import type { Metadata } from "next";
import { AccountGate } from "../../components/account/account-gate";
import { AccountOverview } from "../../components/account/overview";
import { getShopSettings } from "../../lib/api";

export const metadata: Metadata = { title: "Konto" };

export default async function AccountRoute() {
  const settings = await getShopSettings();
  return (
    <AccountGate current="przeglad">
      <AccountOverview timeZone={settings.timezone} />
    </AccountGate>
  );
}
