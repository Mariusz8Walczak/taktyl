// F-001, F-009, docs/14 §4-6: klient API (parsowanie schematem, blad kontraktu, znaczniki cache).
import { publicShopSettingsSchema } from "@taktyl/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiContractError,
  ApiError,
  TAG,
  apiBaseUrl,
  apiGet,
  getShopSettings,
} from "../src/lib/api";
import { SHOP_SETTINGS } from "./fixtures";

const demoSchema = publicShopSettingsSchema.shape.demo;
const emptySchema = publicShopSettingsSchema.shape.company;

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

function stubFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve().then(() => impl(url, init)),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fixture", () => {
  it("jest zgodna z kontraktem /v1/shop-settings", () => {
    expect(publicShopSettingsSchema.safeParse(SHOP_SETTINGS).success).toBe(true);
  });
});

describe("apiGet", () => {
  const opts = { tags: [TAG.shopSettings], baseUrl: "http://api.test:4000" };

  it("pobiera, parsuje schematem i przekazuje znaczniki oraz revalidate 300", async () => {
    const fetchMock = stubFetch(() => json(SHOP_SETTINGS));
    const data = await apiGet("/v1/shop-settings", publicShopSettingsSchema, opts);
    expect(data.demo.label).toBe(SHOP_SETTINGS.demo.label);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test:4000/v1/shop-settings");
    expect(init).toMatchObject({ next: { tags: ["shop-settings"], revalidate: 300 } });
  });

  it("revalidate: false = cache no-store, bez znacznikow", async () => {
    const fetchMock = stubFetch(() => json(SHOP_SETTINGS.demo));
    await apiGet("/v1/x", demoSchema, { ...opts, revalidate: false });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.cache).toBe("no-store");
    expect(init).not.toHaveProperty("next");
  });

  it("dokleja parametry zapytania i pomija undefined", async () => {
    const fetchMock = stubFetch(() => json(SHOP_SETTINGS.demo));
    await apiGet("/v1/x", demoSchema, {
      ...opts,
      query: { a: 1, b: undefined, c: "z" },
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test:4000/v1/x?a=1&c=z");
  });

  it("blad kontraktu: czytelny ApiContractError ze sciezka pola, nie ciche dane", async () => {
    const broken = { ...SHOP_SETTINGS, demo: { ...SHOP_SETTINGS.demo, label: undefined } };
    stubFetch(() => json(broken));
    const err = await apiGet("/v1/shop-settings", publicShopSettingsSchema, opts).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiContractError);
    const contract = err as ApiContractError;
    expect(contract.path).toBe("/v1/shop-settings");
    expect(contract.issues.some((i) => i.startsWith("demo.label:"))).toBe(true);
    expect(contract.message).toContain("nie zgadza sie z kontraktem");
    expect(contract.message).toContain("demo.label");
  });

  it("odpowiedz 200 bez poprawnego JSON-a to ApiContractError", async () => {
    stubFetch(() => new Response("<html>", { status: 200 }));
    await expect(apiGet("/v1/x", emptySchema, opts)).rejects.toBeInstanceOf(ApiContractError);
  });

  it("status inny niz 2xx: ApiError z problem+json (kod, tytul)", async () => {
    stubFetch(() =>
      json(
        { type: "about:blank", title: "Nie znaleziono", status: 404, code: "not_found" },
        { status: 404, headers: { "content-type": "application/problem+json" } },
      ),
    );
    const err = (await apiGet("/v1/x", emptySchema, opts).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.problem?.code).toBe("not_found");
    expect(err.message).toContain("404");
  });

  it("status 5xx bez JSON-a: ApiError ze statusem", async () => {
    stubFetch(() => new Response("Bad Gateway", { status: 502 }));
    const err = (await apiGet("/v1/x", emptySchema, opts).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.problem).toBeNull();
  });

  it("brak polaczenia: ApiError bez statusu i z przyczyna", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const err = (await apiGet("/v1/x", emptySchema, opts).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBeNull();
    expect(err.cause).toBeInstanceOf(TypeError);
  });
});

describe("getShopSettings", () => {
  it("czyta /v1/shop-settings z INTERNAL_API_URL ze znacznikiem shop-settings", async () => {
    vi.stubEnv("INTERNAL_API_URL", "http://api:4000/");
    const fetchMock = stubFetch(() => json(SHOP_SETTINGS));
    const settings = await getShopSettings();
    expect(settings.payment_methods).toHaveLength(4);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api:4000/v1/shop-settings");
    expect(init).toMatchObject({ next: { tags: ["shop-settings"], revalidate: 300 } });
  });
});

describe("apiBaseUrl i znaczniki", () => {
  it("INTERNAL_API_URL ma pierwszenstwo, potem API_URL_INTERNAL, potem localhost; bez koncowego ukosnika", () => {
    expect(apiBaseUrl({ INTERNAL_API_URL: "http://a:1//", API_URL_INTERNAL: "http://b:2" })).toBe(
      "http://a:1",
    );
    expect(apiBaseUrl({ API_URL_INTERNAL: "http://b:2" })).toBe("http://b:2");
    expect(apiBaseUrl({})).toBe("http://localhost:4000");
  });

  it("znaczniki zgodne z tabela docs/14 §6", () => {
    expect(TAG.shopSettings).toBe("shop-settings");
    expect(TAG.catalog).toBe("catalog");
    expect(TAG.presets).toBe("presets");
    expect(TAG.category("klawiatury")).toBe("category:klawiatury");
    expect(TAG.product("bazalt-75")).toBe("product:bazalt-75");
    expect(TAG.content("regulamin")).toBe("content:regulamin");
    expect(TAG.facets("myszki")).toBe("facets:myszki");
  });
});
