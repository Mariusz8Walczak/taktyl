// F-250..F-256 (ADR-0011): slowniki konfiguratora i wycena konfiguracji wlasnej.
// Kolory z bazy (jak reszta katalogu), pozostale slowniki z data/*.json (wlasciciel, ADR-0011). Cena liczona wylacznie tu.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import {
  configuratorDataSchema,
  configuratorQuoteSchema,
  configuratorSetQuoteSchema,
  type ConfigurationInput,
  type ConfiguratorSetRequest,
} from "@taktyl/contracts";
import {
  configurationSku,
  configurationSurcharge,
  findModel,
  priceSet,
  resolveConfiguration,
  parseConfigurationSku,
  type ConfData,
  type Configuration,
  type Product,
  type Variant,
} from "@taktyl/domain";
import { findSeedRoot } from "../../prisma/seed/root.js";
import { CatalogLoader, type CatalogSnapshot } from "../catalog/catalog.loader.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { ShopConfigService } from "../settings/shop-config.service.js";
import { respond } from "../common/zod.pipe.js";

/** Pozycje na zamowienie nie maja stanu; wirtualny wariant dostaje zapas, ktory nigdy nie wywoluje braku towaru. */
export const MADE_TO_ORDER_STOCK = 1000;

export interface CartConfig {
  sku: string;
  baseVariantSku: string;
  surchargeGr: number;
  /** Czytelny opis wyborow, np. "Obudowa: Turkus, polysk · Klawisze alfanumeryczne: Krem, PBT". */
  label: string;
  resolved: Configuration;
  /** Produkt bazowy z nazwa "<model> (wlasne kolory)". */
  product: Product;
  /** Wirtualny wariant: SKU konfiguracji, cena = baza + doplaty, stan = na zamowienie. */
  variant: Variant;
}

function configLabel(
  d: ConfData,
  model: ConfData["models"][number],
  config: Configuration,
): string {
  const parts = model.parts
    .filter((p) => p.konfigurowalna && p.paleta && config.parts[p.id])
    .map((p) => {
      const c = config.parts[p.id]!;
      if (p.id === "wierzch" && config.print) return null;
      const color = d.colors[c.color]?.label ?? c.color;
      const finish = c.finish ? `, ${d.finishes[c.finish]?.label ?? c.finish}` : "";
      return `${p.etykieta}: ${color}${finish}`;
    })
    .filter((x): x is string => x !== null);
  if (config.print) {
    parts.unshift(`Wzór: ${d.prints.find((p) => p.id === config.print)?.nazwa ?? config.print}`);
  }
  if (config.switch && d.switches[config.switch])
    parts.push(`Przełącznik: ${d.switches[config.switch]!.name}`);
  return parts.join(" · ");
}

type StaticData = Omit<ConfData, "colors" | "switches">;

@Injectable()
export class ConfiguratorService {
  private staticData: StaticData | null = null;

  constructor(
    @Inject(CatalogLoader) private readonly loader: CatalogLoader,
    @Inject(ShopConfigService) private readonly shop: ShopConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private files(): StaticData {
    if (this.staticData) return this.staticData;
    const root = join(findSeedRoot(import.meta.url), "data");
    const read = <T>(name: string): T =>
      JSON.parse(readFileSync(join(root, `${name}.json`), "utf8")) as T;
    const parts = read<{ palettes: ConfData["palettes"]; models: ConfData["models"] }>("parts");
    this.staticData = {
      finishes: read("finishes"),
      palettes: parts.palettes,
      models: parts.models,
      prints: read("prints"),
      surcharges: read("surcharges"),
    };
    return this.staticData;
  }

  private withColors(snap: CatalogSnapshot): ConfData {
    return {
      ...this.files(),
      colors: snap.colors,
      switches: Object.fromEntries(
        snap.switches.map((s) => [s.id, { code: s.code, name: s.name }]),
      ),
    };
  }

  async dictionaries() {
    const d = this.withColors(await this.loader.load());
    return respond(configuratorDataSchema, {
      colors: d.colors,
      switches: d.switches,
      finishes: d.finishes,
      palettes: d.palettes,
      models: d.models,
      prints: d.prints,
    });
  }

  async quote(input: ConfigurationInput) {
    const snap = await this.loader.load();
    const d = this.withColors(snap);
    const model = findModel(d, input.model);
    const resolved = resolveConfiguration(d, {
      model: input.model,
      parts: input.parts,
      print: input.print ?? null,
      switch: input.switch ?? null,
    });
    let base = 0;
    if (model) {
      const product = snap.products.find((p) => p.id === model.product);
      const prices = (product?.variants ?? [])
        .filter((v) => (model.size ? v.size === model.size : true))
        .map((v) => v.price);
      base = prices.length > 0 ? Math.min(...prices) : 0;
    }
    const usable = resolved.ok && model !== undefined && base > 0;
    return respond(configuratorQuoteSchema, {
      ok: usable,
      issues: resolved.issues,
      adjustments: resolved.adjustments,
      config: {
        model: resolved.config.model,
        parts: resolved.config.parts,
        print: resolved.config.print ?? null,
        switch: resolved.config.switch ?? null,
      },
      sku: usable ? configurationSku(d, resolved.config) : null,
      base_price_gr: base,
      surcharge_gr: usable ? configurationSurcharge(d, resolved.config) : 0,
      total_gr: usable ? base + configurationSurcharge(d, resolved.config) : 0,
      made_to_order: true,
    });
  }

  /**
   * F-256: konfiguracja z koszyka. Kod musi byc kanoniczny (odtwarza sie z rozwiazanej konfiguracji), inaczej `null`
   * (ten sam wyglad = ten sam kod). Zwraca wirtualny wariant do wyceny koszyka (cena = model bazowy + doplaty, stan
   * "na zamowienie") oraz wariant bazowy z katalogu, na ktory wskazuje pozycja zamowienia.
   */
  cartConfig(snap: CatalogSnapshot, sku: string): CartConfig | null {
    const d = this.withColors(snap);
    const parsed = parseConfigurationSku(d, sku);
    if (!parsed) return null;
    const resolved = resolveConfiguration(d, parsed);
    if (!resolved.ok || configurationSku(d, resolved.config) !== sku) return null;
    const model = findModel(d, resolved.config.model);
    const product = snap.products.find((p) => p.id === model?.product);
    if (!model || !product) return null;
    const candidates = product.variants
      .filter((v) => (model.size ? v.size === model.size : true))
      .filter((v) => (resolved.config.switch ? v.switch === resolved.config.switch : true))
      .sort((a, b) => a.price - b.price || a.sku.localeCompare(b.sku));
    const baseVariant = candidates[0];
    if (!baseVariant) return null;
    const surcharge = configurationSurcharge(d, resolved.config);
    const size = model.size ? ` ${model.size.toUpperCase()}` : "";
    const name = `${model.name}${size} (własne kolory)`;
    const partColor = resolved.config.parts.obudowa?.color ?? resolved.config.parts.korpus?.color;
    return {
      sku,
      baseVariantSku: baseVariant.sku,
      surchargeGr: surcharge,
      label: configLabel(d, model, resolved.config),
      resolved: resolved.config,
      product: { ...product, name },
      variant: {
        ...baseVariant,
        sku,
        color: partColor && d.colors[partColor] ? partColor : baseVariant.color,
        price: baseVariant.price + surcharge,
        regularPrice: null,
        lowest30d: null,
        stock: MADE_TO_ORDER_STOCK,
      },
    };
  }

  /** F-255: set z trzech konfiguracji; rabat jak w koszyku (`priceSet`, procent i kategorie z ustawien sklepu). */
  async quoteSet(input: ConfiguratorSetRequest) {
    const quotes = await Promise.all(input.items.map((i) => this.quote(i)));
    const config = await this.shop.load(this.clock());
    const category = (modelId: string): string =>
      modelId.startsWith("k-") ? "klawiatury" : modelId.startsWith("m-") ? "myszki" : "podkladki";
    const usable = quotes.every((q) => q.ok);
    const distinct = new Set(quotes.map((q) => category(q.config.model))).size === quotes.length;
    const set = priceSet(
      quotes.map((q) => ({
        sku: q.sku ?? q.config.model,
        category: category(q.config.model),
        price: q.total_gr,
      })),
      config.setDiscount,
    );
    const eligible = usable && distinct;
    return respond(configuratorSetQuoteSchema, {
      items: quotes,
      sum_gr: set.sum,
      discount_gr: eligible ? set.discount : 0,
      total_gr: eligible ? set.total : set.sum,
      percent: config.setDiscount.percent,
      complete: eligible && set.complete,
      ok: eligible,
      made_to_order: true,
    });
  }
}
