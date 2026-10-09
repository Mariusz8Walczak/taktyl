// F-255 (ADR-0011): „Stworz wlasny set” (jsdom: scena 3D zastapiona komunikatem, wycena z atrapy API).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfiguratorData } from "@taktyl/contracts";
import { defaultConfiguration, resolveConfiguration } from "@taktyl/domain";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetCreator } from "../src/components/configurator/set-creator";
import { findModelById, toDomainData } from "../src/lib/configurator/model";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
function read<T>(n: string): T {
  return JSON.parse(readFileSync(join(root, `${n}.json`), "utf8")) as T;
}
const parts = read<{ palettes: ConfiguratorData["palettes"]; models: ConfiguratorData["models"] }>(
  "parts",
);
const data: ConfiguratorData = {
  colors: read("colors"),
  finishes: read("finishes"),
  palettes: parts.palettes,
  models: parts.models,
  prints: read("prints"),
  switches: Object.fromEntries(
    read<{ id: string; code: string; name: string }[]>("switches").map((s) => [
      s.id,
      { code: s.code, name: s.name },
    ]),
  ),
};

function initialFor(id: string) {
  const model = findModelById(data, id)!;
  const config = resolveConfiguration(
    toDomainData(data),
    defaultConfiguration(model as never),
  ).config;
  return { modelId: id, config };
}

describe("SetCreator (F-255)", () => {
  const bodies: { items: { model: string }[] }[] = [];
  beforeEach(() => {
    bodies.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { items: { model: string }[] };
        bodies.push(body);
        const item = (m: string, total: number) => ({
          ok: true,
          issues: [],
          adjustments: [],
          config: { model: m, parts: {}, print: null },
          sku: `${m.toUpperCase()}-CFG-X`,
          base_price_gr: total,
          surcharge_gr: 0,
          total_gr: total,
          made_to_order: true,
        });
        return new Response(
          JSON.stringify({
            items: body.items.map((i) => item(i.model, 10000)),
            sum_gr: 30000,
            discount_gr: 3000,
            total_gr: 27000,
            percent: 10,
            complete: true,
            ok: true,
            made_to_order: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    return render(
      <SetCreator
        data={data}
        initial={{
          k: initialFor("k-kwarc-60"),
          m: initialFor("m-wrobel"),
          p: initialFor("p-tafla_l"),
        }}
      />,
    );
  }

  it("pokazuje trzy sekcje z wyborem modelu i podsumowanie z rabatem z serwera", async () => {
    setup();
    for (const t of ["Model: Klawiatura", "Model: Mysz", "Model: Podkładka"]) {
      expect(screen.getByRole("radiogroup", { name: t })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByText(/Rabat za komplet \(−10%\)/)).toBeInTheDocument());
    expect(screen.getByText(/270,00/)).toBeInTheDocument();
    expect(bodies.at(-1)?.items.map((i) => i.model)).toEqual([
      "k-kwarc-60",
      "m-wrobel",
      "p-tafla_l",
    ]);
  });

  it("zmiana modelu klawiatury wysyla nowy zestaw do wyceny", async () => {
    const user = userEvent.setup();
    setup();
    const group = screen.getByRole("radiogroup", { name: "Model: Klawiatura" });
    await user.click(within(group).getByRole("radio", { name: /Marmur 100/ }));
    await waitFor(() => expect(bodies.at(-1)?.items[0]?.model).toBe("k-marmur-100"));
    expect(bodies.at(-1)?.items.map((i) => i.model)).toEqual([
      "k-marmur-100",
      "m-wrobel",
      "p-tafla_l",
    ]);
  });
});
