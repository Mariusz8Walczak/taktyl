// F-250..F-254 (ADR-0011): panel konfiguratora (jsdom nie ma WebGL, wiec scena 3D jest zastapiona komunikatem).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfiguratorData } from "@taktyl/contracts";
import { defaultConfiguration, resolveConfiguration } from "@taktyl/domain";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Configurator } from "../src/components/configurator/configurator";
import { findModelById, toDomainData } from "../src/lib/configurator/model";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
function read<T>(n: string): T {
  return JSON.parse(readFileSync(join(root, `${n}.json`), "utf8")) as T;
}
const parts = read<{ palettes: ConfiguratorData["palettes"]; models: ConfiguratorData["models"] }>("parts");
const data: ConfiguratorData = {
  colors: read("colors"),
  finishes: read("finishes"),
  palettes: parts.palettes,
  models: parts.models,
  prints: read("prints"),
};

function setup(modelId: string, name: string) {
  const model = findModelById(data, modelId)!;
  const initial = resolveConfiguration(toDomainData(data), defaultConfiguration(model as never)).config;
  return render(<Configurator data={data} model={model} productName={name} productHref="/klawiatury/kwarc-60" initial={initial} />);
}

describe("Configurator (F-250..F-254)", () => {
  const calls: { model: string; parts: Record<string, unknown> }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { model: string; parts: Record<string, unknown> };
        calls.push(body);
        const turkus = JSON.stringify(body.parts).includes("turkus");
        return new Response(
          JSON.stringify({
            ok: true,
            issues: [],
            adjustments: [],
            config: { model: body.model, parts: {}, print: null },
            sku: "K-KWR60-CFG-TEST",
            base_price_gr: 29900,
            surcharge_gr: turkus ? 3000 : 0,
            total_gr: turkus ? 32900 : 29900,
            made_to_order: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pokazuje czesci jako grupy z kolorami i bez WebGL daje komunikat zastepczy", async () => {
    setup("k-kwarc-60", "Kwarc 60");
    expect(screen.getByRole("radiogroup", { name: "Obudowa" })).toBeInTheDocument();
    expect(screen.getByText(/Podgląd 3D jest niedostępny/)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Nadruki na klawiszach alfanumerycznych" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("K-KWR60-CFG-TEST")).toBeInTheDocument());
  });

  it("wybor koloru zaznacza probke, wysyla wybory do wyceny i pokazuje kwoty z serwera", async () => {
    const user = userEvent.setup();
    setup("k-kwarc-60", "Kwarc 60");
    const group = screen.getByRole("radiogroup", { name: "Obudowa" });
    const turkus = within(group).getByRole("radio", { name: "Turkus" });
    expect(turkus).toHaveAttribute("aria-checked", "false");
    await user.click(turkus);
    expect(turkus).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(screen.getByText(/329,00/)).toBeInTheDocument());
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
    expect(calls.at(-1)?.parts).toMatchObject({ obudowa: { color: "turkus" } });
  });

  it("Auto dla nadrukow wysyla kolor auto", async () => {
    const user = userEvent.setup();
    setup("k-kwarc-60", "Kwarc 60");
    const group = screen.getByRole("radiogroup", { name: "Nadruki na modyfikatorach" });
    await user.click(within(group).getByRole("radio", { name: "Auto" }));
    await waitFor(() => expect(calls.at(-1)?.parts).toMatchObject({ legendy_mod: { color: "auto" } }));
  });

  it("podkladka: wybor wzoru ukrywa kolor wierzchu i przekazuje nadruk", async () => {
    const user = userEvent.setup();
    setup("p-tafla_m", "Tafla M");
    expect(screen.getByRole("radiogroup", { name: "Wierzch" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Paski/ }));
    expect(screen.queryByRole("radiogroup", { name: "Wierzch" })).not.toBeInTheDocument();
  });
});
