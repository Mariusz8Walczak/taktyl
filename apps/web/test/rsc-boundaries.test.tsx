// TAKTYL-59 priorytet 0 (regresja): karta produktu /klawiatury/bazalt-75 zwrocila HTTP 500 "Event handlers cannot be
// passed to Client Component props" - handler przekazany do komponentu z serwera. Dwa zabezpieczenia:
//  1) blok "Dokoncz set" (komponent serwerowy, Field as="select") renderuje sie po stronie serwera (SSR) na danych z data/*.json;
//  2) zaden plik BEZ "use client" w src/components i src/app nie przekazuje handlerow zdarzen (onClick, onChange...).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompleteSetStatic } from "../src/components/product/complete-set-static";
import { toBuilderProduct } from "../src/lib/builder/catalog";
import type { CompleteSetProps } from "../src/lib/builder/complete-view";
import { RULES, SHOP, builderData } from "./builder-fixtures";
import { productFixture, SWITCHES } from "./catalog-fixtures";

const props: CompleteSetProps = {
  profile: "programowanie",
  skus: { k: "K-BZL75-GRF-PRG", m: "M-PST-GRF", p: "P-SZR-XL-GRF" },
  products: [productFixture("bazalt-75"), productFixture("pustulka"), productFixture("szron")].map(
    toBuilderProduct,
  ),
  anchor: "k",
  colors: builderData().colors,
  switches: SWITCHES.map((s) => ({ ...s, sound: "" })),
  rules: RULES,
  setDiscount: {
    percent: SHOP.set_discount.percent,
    categories: SHOP.set_discount.requires_categories,
  },
};

describe("SSR karty produktu: blok Dokoncz set", () => {
  it("renderuje sie po stronie serwera z nieaktywnymi listami wariantow (bez handlerow)", () => {
    const html = renderToString(<CompleteSetStatic {...props} />);
    expect(html).toContain("<select");
    expect(html).toContain("Wariant: ");
    expect(html).not.toMatch(/onChange|onClick/);
  });
});

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(name) ? [p] : [];
  });
}

describe("granica serwer/klient", () => {
  const serverFiles = [...files(join(SRC, "components")), ...files(join(SRC, "app"))].filter(
    (f) => !/^\s*["']use client["']/.test(readFileSync(f, "utf8").trimStart()),
  );

  it("pliki bez 'use client' nie przekazuja handlerow zdarzen w JSX", () => {
    const offenders: string[] = [];
    for (const f of serverFiles) {
      const code = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (/<[A-Za-z][^<>]*\s(on[A-Z][A-Za-z]+)=\{/.test(code)) offenders.push(relative(SRC, f));
    }
    expect(offenders).toEqual([]);
  });
});
