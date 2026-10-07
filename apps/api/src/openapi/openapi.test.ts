// B-231, B-213: testy jednostkowe dokumentacji OpenAPI (bramka produkcyjna, generowanie ze schematow) i middleware logow.
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AppException } from "../common/app-exception.js";
import { requestContext } from "../common/request-context.js";
import type { AppConfig } from "../config/env.js";
import { buildOpenApi } from "./builder.js";
import { OpenApiController } from "./openapi.controller.js";

const cfg = (over: Partial<AppConfig>): AppConfig =>
  ({ NODE_ENV: "production", OPENAPI_ENABLED: false, ...over }) as AppConfig;

describe("B-231 OpenApiController", () => {
  it("w produkcji bez flagi dokumentacja zwraca 404", () => {
    const c = new OpenApiController(cfg({}));
    expect(() => c.json()).toThrow(AppException);
    expect(() => c.docs()).toThrow(AppException);
  });

  it("w produkcji z OPENAPI_ENABLED=true i poza produkcja dokumentacja jest dostepna", () => {
    expect(new OpenApiController(cfg({ OPENAPI_ENABLED: true })).json()["openapi"]).toBe("3.1.0");
    expect(new OpenApiController(cfg({ NODE_ENV: "development" })).json()["openapi"]).toBe("3.1.0");
  });

  it("dokument opisuje kwoty w groszach jako liczby calkowite i bledy jako problem+json", () => {
    const spec = buildOpenApi() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const quote = spec.paths["/v1/cart/quote"]?.["post"];
    expect(Object.keys(quote?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "422", "429", "500"]),
    );
    expect(JSON.stringify(spec.paths["/v1/cart/quote"])).toContain('"total_gr":{"type":"integer"');
    expect(JSON.stringify(spec)).toContain("application/problem+json");
  });
});

describe("B-213 requestContext (logi strukturalne)", () => {
  function run(headers: Record<string, string>) {
    const logged: { fields: Record<string, unknown>; msg: string }[] = [];
    const logger = {
      info: (fields: Record<string, unknown>, msg: string) => logged.push({ fields, msg }),
    };
    const set: Record<string, string> = {};
    let finish: () => void = () => undefined;
    const req = {
      header: (n: string) => headers[n.toLowerCase()],
      path: "/v1/orders/TK-261007-ABCD",
      method: "GET",
      baseUrl: "",
      route: undefined,
    } as unknown as Request;
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => (set[k] = v),
      on: (_e: string, cb: () => void) => (finish = cb),
    } as unknown as Response;
    const next = vi.fn();
    requestContext(logger as never)(req, res, next);
    finish();
    return { logged, set, next, req: req as Request & { id?: string } };
  }

  it("loguje requestId, trase bez query, status i czas; bez danych osobowych", () => {
    const { logged, set, next } = run({ "x-request-id": "abc-12345678" });
    expect(next).toHaveBeenCalled();
    expect(set["X-Request-Id"]).toBe("abc-12345678");
    expect(set["Cache-Control"]).toBe("no-store");
    expect(logged).toHaveLength(1);
    expect(logged[0]?.fields).toMatchObject({
      requestId: "abc-12345678",
      method: "GET",
      status: 200,
      route: "/v1/orders/TK-261007-ABCD",
    });
    expect(typeof logged[0]?.fields["durationMs"]).toBe("number");
    expect(JSON.stringify(logged)).not.toMatch(/@|token/i);
  });

  it("generuje requestId, gdy brak lub niepoprawny", () => {
    expect(run({}).set["X-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(run({ "x-request-id": "a b" }).set["X-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
