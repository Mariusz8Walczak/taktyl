// B-230, B-231, B-232, B-233 (TAKTYL-22): healthchecki, OpenAPI, helmet, CORS, requestId, limity zadan.
import { RequestMethod } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import { problemSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { ROUTES } from "../src/openapi/routes.js";
import { bootApp, hasDb, type TestEnv } from "./helpers.js";

/** Trasy zarejestrowane w Nest (metoda + sciezka OpenAPI) odczytane z metadanych kontrolerow. */
function registeredRoutes(t: TestEnv): string[] {
  const out: string[] = [];
  const modules = t.app.get(ModulesContainer);
  const unversioned = ["health", "ready", "docs", "openapi.json", "v1/openapi.json"];
  for (const mod of modules.values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new (...a: never[]) => object) | null;
      if (!ctrl) continue;
      const base = (Reflect.getMetadata("path", ctrl) as string | string[]) ?? "";
      const bases = Array.isArray(base) ? base : [base];
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const fn = (ctrl.prototype as Record<string, unknown>)[name];
        if (typeof fn !== "function") continue;
        const method = Reflect.getMetadata("method", fn) as number | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata("path", fn) as string | string[];
        for (const b of bases) {
          for (const s of Array.isArray(sub) ? sub : [sub]) {
            const joined = [b, s]
              .filter((x) => x && x !== "/")
              .join("/")
              .replace(/\/+/g, "/");
            const route = `/${joined.replace(/^\//, "")}`.replace(/:([A-Za-z]+)/g, "{$1}");
            const bare = route.slice(1);
            const prefixed =
              unversioned.includes(bare) || bare === "health/ready" ? route : `/v1${route}`;
            out.push(`${RequestMethod[method]?.toLowerCase()} ${prefixed}`);
          }
        }
      }
    }
  }
  return out.sort();
}

describe.skipIf(!hasDb)("B-230..B-233 platforma API (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("/health (liveness) i /health/ready oraz /ready (baza, migracje, outbox)", async () => {
    expect((await t.http().get("/health").expect(200)).body).toEqual({ status: "ok" });
    for (const path of ["/health/ready", "/ready"]) {
      const res = await t.http().get(path).expect(200);
      expect(res.body).toEqual({
        status: "ok",
        checks: { database: "ok", migrations: "ok", outbox_pending: 0 },
      });
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });

  it("readiness: awaria bazy = 503 problem+json", async () => {
    const prisma = t.app.get(PrismaService);
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("db down"));
    const res = await t.http().get("/health/ready").expect(503);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(problemSchema.parse(res.body)).toMatchObject({ status: 503, code: "internal_error" });
    spy.mockRestore();
    await t.http().get("/health/ready").expect(200);
  });

  it("naglowki: helmet, noindex, brak x-powered-by, X-Request-Id", async () => {
    const res = await t.http().get("/v1/switches").expect(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-robots-tag"]).toBe("noindex");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("requestId: poprawny X-Request-Id jest przekazywany i trafia do problem+json (instance), zly jest wymieniany", async () => {
    const ok = await t
      .http()
      .get("/v1/nie-ma-takiej-trasy")
      .set("X-Request-Id", "req-12345678")
      .expect(404);
    expect(ok.headers["x-request-id"]).toBe("req-12345678");
    expect(problemSchema.parse(ok.body)).toMatchObject({
      code: "not_found",
      instance: "req-12345678",
    });
    const bad = await t
      .http()
      .get("/v1/switches")
      .set("X-Request-Id", "zly id z <spacjami>")
      .expect(200);
    expect(bad.headers["x-request-id"]).not.toContain(" ");
  });

  it("CORS ograniczony do hostow z konfiguracji (preflight i odczyt)", async () => {
    const allowed = await t
      .http()
      .get("/v1/switches")
      .set("Origin", "http://taktyl.localhost")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://taktyl.localhost");
    const denied = await t
      .http()
      .get("/v1/switches")
      .set("Origin", "http://evil.example")
      .expect(200);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    const pre = await t
      .http()
      .options("/v1/orders")
      .set("Origin", "http://taktyl.localhost")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,idempotency-key,x-order-token");
    expect(pre.status).toBe(204);
    expect(pre.headers["access-control-allow-headers"]?.toLowerCase()).toContain("idempotency-key");
    const preEvil = await t
      .http()
      .options("/v1/orders")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(preEvil.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("OpenAPI 3.1 pod /openapi.json, /v1/openapi.json i /docs generowane ze schematow contracts", async () => {
    const res = await t.http().get("/openapi.json").expect(200);
    const spec = res.body as {
      openapi: string;
      paths: Record<string, Record<string, Record<string, unknown>>>;
      components: { schemas: Record<string, unknown> };
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.components.schemas["Problem"]).toBeTruthy();
    const orders = spec.paths["/v1/orders"]?.["post"] as {
      requestBody: {
        content: {
          "application/json": {
            schema: { additionalProperties?: boolean; properties: Record<string, unknown> };
          };
        };
      };
      parameters: { name: string }[];
    };
    const schema = orders.requestBody.content["application/json"].schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).not.toEqual(expect.arrayContaining(["card_number"]));
    expect(orders.parameters.map((p) => p.name)).toContain("Idempotency-Key");
    const products = spec.paths["/v1/products"]?.["get"] as {
      parameters: { name: string; required: boolean }[];
    };
    expect(products.parameters.find((p) => p.name === "category")?.required).toBe(true);
    const same = await t.http().get("/v1/openapi.json").expect(200);
    expect(same.body).toEqual(res.body);
    const docs = await t.http().get("/docs").expect(200);
    expect(docs.headers["content-type"]).toContain("text/html");
    expect(docs.text).toContain("/v1/cart/quote");
    expect(docs.text).not.toContain("<script");
  });

  it("rejestr OpenAPI pokrywa dokladnie trasy zarejestrowane w Nest (obie strony)", () => {
    const documented = ROUTES.map((r) => `${r.method} ${r.path}`).sort();
    // Trasy samej dokumentacji (/docs, /openapi.json) nie opisuja siebie w kontrakcie.
    const meta = ["get /docs", "get /openapi.json", "get /v1/openapi.json"];
    expect(registeredRoutes(t).filter((r) => !meta.includes(r))).toEqual(documented);
  });
});

describe.skipIf(!hasDb)("B-232 limity zadan (@nestjs/throttler)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp({ rateLimit: true, seed: false });
  });
  afterAll(async () => {
    await t.close();
  });

  it("POST /v1/orders: 11. zadanie w minucie = 429 rate_limited z Retry-After (zaostrzony limit 10/min)", async () => {
    const statuses: number[] = [];
    let last: Awaited<ReturnType<ReturnType<TestEnv["http"]>["post"]>> | undefined;
    for (let i = 0; i < 11; i++) {
      last = await t.http().post("/v1/orders").send({});
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 422)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(last?.headers["retry-after"]).toBeTruthy();
    expect(last?.headers["content-type"]).toContain("application/problem+json");
    expect(problemSchema.parse(last?.body)).toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("limity sa osobne per endpoint: wycena (60/min) dalej odpowiada, payment/simulate ma wlasny licznik", async () => {
    const quote = await t.http().post("/v1/cart/quote").send({});
    expect(quote.status).toBe(422);
    const token = "t".repeat(43);
    const sim: number[] = [];
    for (let i = 0; i < 21; i++) {
      const r = await t
        .http()
        .post("/v1/orders/TK-261007-ABCD/payment/simulate")
        .set("X-Order-Token", token)
        .send({ outcome: "paid" });
      sim.push(r.status);
    }
    expect(sim.slice(0, 20).every((s) => s === 404)).toBe(true);
    expect(sim[20]).toBe(429);
  });

  it("health nie jest limitowany", async () => {
    for (let i = 0; i < 130; i++) {
      const res = await t.http().get("/health");
      if (res.status !== 200) throw new Error(`health zwrocil ${res.status} w iteracji ${i}`);
    }
  });
});
