"use client";
// B-400..B-408 (docs/15 par. 10.1): ekran /ustawienia - zakladki (Radix Tabs), odczyt dla wszystkich, zapis tylko owner.
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { useSettings } from "../../lib/queries";
import { DemoResetPanel } from "./demo-reset";
import { PageHeader } from "../ui/page-header";
import { QueryBoundary } from "../ui/query-state";
import {
  CompanyTab,
  DiscountsTab,
  DispatchTab,
  PaymentsTab,
  PickupTab,
  ShippingTab,
} from "./settings-tabs";

const TABS = [
  ["dostawa", "Dostawa"],
  ["platnosci", "Płatności"],
  ["rabaty", "Rabaty i kody"],
  ["punkty", "Punkty odbioru"],
  ["wysylka", "Wysyłka"],
  ["firma", "Firma i etykiety"],
] as const;

export function SettingsView({ demoMode = false }: { demoMode?: boolean }) {
  const query = useSettings();
  const [tab, setTab] = useState<string>("dostawa");
  return (
    <div className="adm-strona">
      <PageHeader title="Ustawienia sklepu" />
      <QueryBoundary query={query} errorText="Nie udało się pobrać ustawień.">
        {(settings) => (
          <Tabs.Root value={tab} onValueChange={setTab}>
            <Tabs.List className="adm-zakladki__lista" aria-label="Sekcje ustawień">
              {TABS.map(([value, label]) => (
                <Tabs.Trigger key={value} className="adm-zakladki__wyzwalacz" value={value}>
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content className="adm-zakladki__tresc" value="dostawa">
              <ShippingTab settings={settings} />
            </Tabs.Content>
            <Tabs.Content className="adm-zakladki__tresc" value="platnosci">
              <PaymentsTab settings={settings} />
            </Tabs.Content>
            <Tabs.Content className="adm-zakladki__tresc" value="rabaty">
              <DiscountsTab settings={settings} />
            </Tabs.Content>
            <Tabs.Content className="adm-zakladki__tresc" value="punkty">
              <PickupTab settings={settings} />
            </Tabs.Content>
            <Tabs.Content className="adm-zakladki__tresc" value="wysylka">
              <DispatchTab settings={settings} />
            </Tabs.Content>
            <Tabs.Content className="adm-zakladki__tresc" value="firma">
              <CompanyTab settings={settings} />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </QueryBoundary>
      <DemoResetPanel demoMode={demoMode} />
    </div>
  );
}
