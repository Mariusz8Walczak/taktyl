// B-300, B-301, B-402, B-408 (CLAUDE.md regula 5, docs/15): kontrola nazw prawdziwych marek w tekstach wpisywanych w panelu.
// Lista marek NIE moze byc w repozytorium (ADR-0008): pochodzi ze zmiennej srodowiskowej FORBIDDEN_BRANDS (lokalnie, z .env;
// jedna nazwa lub kilka po przecinku). Pusta lista = kontrola wylaczona (strukturalne reguly walidatorow dzialaja dalej).
import { Inject, Injectable } from "@nestjs/common";
import { normalizeSearchText } from "@taktyl/domain";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Czysta funkcja: zwraca znalezione nazwy z listy (bez rozrozniania wielkosci liter i polskich znakow, jako cale slowa). */
export function findBrands(text: string, brands: readonly string[]): string[] {
  const haystack = ` ${normalizeSearchText(text)} `;
  const found: string[] = [];
  for (const brand of brands) {
    const needle = normalizeSearchText(brand.trim());
    if (needle.length < 2) continue;
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escape(needle)}(?![\\p{L}\\p{N}])`, "u").test(haystack)) {
      found.push(brand.trim());
    }
  }
  return found;
}

@Injectable()
export class BrandGuard {
  private readonly brands: readonly string[];

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.brands = config.FORBIDDEN_BRANDS;
  }

  get active(): boolean {
    return this.brands.length > 0;
  }

  find(text: string): string[] {
    return this.brands.length === 0 ? [] : findBrands(text, this.brands);
  }
}
