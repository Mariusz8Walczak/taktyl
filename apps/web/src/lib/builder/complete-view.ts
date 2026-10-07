// F-069 (docs/05 §4 pkt 12): wspolne dla bloku "Dokoncz set" w wersji statycznej (serwer) i interaktywnej (klient):
// ksztalt wlasciwosci, model katalogu z trzech produktow i adres "Otworz w kreatorze".
import type { RulesConfig } from "@taktyl/domain";
import {
  createModel,
  type BuilderModel,
  type BuilderProduct,
  type ColorInfo,
  type SwitchInfo,
} from "./catalog";
import { toSearchParams } from "./state";
import { EMPTY_STATE, type SlotKey } from "./types";

export interface CompleteSetProps {
  profile: string;
  skus: Record<SlotKey, string>;
  /** Trzy pelne produkty: karta + dwa dobrane. */
  products: BuilderProduct[];
  /** Slot produktu, na ktorego karcie stoi blok. */
  anchor: SlotKey;
  colors: ColorInfo[];
  switches: SwitchInfo[];
  rules: RulesConfig;
  setDiscount: { percent: number; categories: string[] };
}

export function createBlockModel(p: CompleteSetProps): BuilderModel {
  return createModel({
    products: p.products,
    colors: p.colors,
    switches: p.switches,
    rules: p.rules,
    presets: [],
    setDiscount: p.setDiscount,
  });
}

/** `/zbuduj-set?profil=&k=&m=&p=&krok=podsumowanie&wejscie=pdp_complete` (docs/03 §1). */
export function openInBuilderHref(profile: string, skus: Record<SlotKey, string>): string {
  const qs = toSearchParams({
    ...EMPTY_STATE,
    profile,
    k: skus.k,
    m: skus.m,
    p: skus.p,
    step: "podsumowanie",
  });
  qs.set("wejscie", "pdp_complete");
  return `/zbuduj-set?${qs.toString()}`;
}
