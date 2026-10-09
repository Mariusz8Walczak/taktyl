// F-250..F-256 (ADR-0011): slowniki konfiguratora i wycena konfiguracji wlasnej.
// Kolory z bazy (jak reszta katalogu), pozostale slowniki z data/*.json (wlasciciel, ADR-0011). Cena liczona wylacznie tu.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import {
  configuratorDataSchema,
  configuratorQuoteSchema,
  type ConfigurationInput,
} from "@taktyl/contracts";
import {
  configurationSku,
  configurationSurcharge,
  findModel,
  resolveConfiguration,
  type ConfData,
} from "@taktyl/domain";
import { findSeedRoot } from "../../prisma/seed/root.js";
import { CatalogLoader } from "../catalog/catalog.loader.js";
import { respond } from "../common/zod.pipe.js";

type StaticData = Omit<ConfData, "colors">;

@Injectable()
export class ConfiguratorService {
  private staticData: StaticData | null = null;

  constructor(@Inject(CatalogLoader) private readonly loader: CatalogLoader) {}

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

  private withColors(colors: ConfData["colors"]): ConfData {
    return { ...this.files(), colors };
  }

  async dictionaries() {
    const d = this.withColors((await this.loader.load()).colors);
    return respond(configuratorDataSchema, {
      colors: d.colors,
      finishes: d.finishes,
      palettes: d.palettes,
      models: d.models,
      prints: d.prints,
    });
  }

  async quote(input: ConfigurationInput) {
    const snap = await this.loader.load();
    const d = this.withColors(snap.colors);
    const model = findModel(d, input.model);
    const resolved = resolveConfiguration(d, {
      model: input.model,
      parts: input.parts,
      print: input.print ?? null,
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
      },
      sku: usable ? configurationSku(d, resolved.config) : null,
      base_price_gr: base,
      surcharge_gr: usable ? configurationSurcharge(d, resolved.config) : 0,
      total_gr: usable ? base + configurationSurcharge(d, resolved.config) : 0,
      made_to_order: true,
    });
  }
}
