// B-060 (ADR-0003, docs/16 par. 3.6): testy odbiornika POST /api/revalidate - podpis HMAC, okno czasowe, whitelist znacznikow.
import { createHmac } from "node:crypto";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/revalidate/route";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const SECRET = "r".repeat(40);
const NOW = new Date("2026-10-07T10:00:00Z");
const TS = Math.floor(NOW.getTime() / 1000);

const sign = (body: string, ts: number | string = TS, secret = SECRET) =>
  createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

function call(
  payload: unknown,
  opts: { ts?: number | string; signature?: string; secret?: string; raw?: string } = {},
) {
  const body = opts.raw ?? JSON.stringify(payload);
  const ts = opts.ts ?? TS;
  const headers: Record<string, string> = { "content-type": "application/json" };
  headers["x-taktyl-timestamp"] = String(ts);
  headers["x-taktyl-signature"] = opts.signature ?? sign(body, ts, opts.secret);
  return POST(new Request("http://web.test/api/revalidate", { method: "POST", headers, body }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("REVALIDATE_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.mocked(revalidateTag).mockClear();
});

describe("POST /api/revalidate", () => {
  it("wektor podpisu jest ten sam co w API (apps/api/src/outbox/outbox.test.ts)", () => {
    expect(sign(JSON.stringify({ tags: ["catalog"] }), 1791367200)).toBe(
      "13858b1045a62ca1b7d0396cd008d480842872b1c3b066f15eaaf1c0bf25a031",
    );
  });

  it("poprawny podpis: revalidateTag dla kazdego znacznika, odpowiedz 200 z lista", async () => {
    const res = await call({ tags: ["product:wrobel", "category:myszki", "catalog"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      revalidated: ["product:wrobel", "category:myszki", "catalog"],
    });
    expect(vi.mocked(revalidateTag).mock.calls.map((c) => c[0])).toEqual([
      "product:wrobel",
      "category:myszki",
      "catalog",
    ]);
  });

  it("deduplikuje powtorzone znaczniki", async () => {
    const res = await call({ tags: ["catalog", "catalog", "presets"] });
    expect(await res.json()).toEqual({ revalidated: ["catalog", "presets"] });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("zly podpis: 401 i brak rewalidacji", async () => {
    const res = await call({ tags: ["catalog"] }, { secret: "x".repeat(40) });
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("podpis dla innego ciala (podmiana znacznikow): 401", async () => {
    const signature = sign(JSON.stringify({ tags: ["catalog"] }));
    const res = await call({ tags: ["presets"] }, { signature });
    expect(res.status).toBe(401);
  });

  it("brak naglowkow, podpis nie-hex i zly znacznik czasu: 401", async () => {
    const body = JSON.stringify({ tags: ["catalog"] });
    const bare = await POST(
      new Request("http://web.test/api/revalidate", { method: "POST", body }),
    );
    expect(bare.status).toBe(401);
    expect((await call({ tags: ["catalog"] }, { signature: "zz" })).status).toBe(401);
    expect((await call({ tags: ["catalog"] }, { ts: "abc" })).status).toBe(401);
  });

  it("przeterminowany znacznik czasu (replay, > 5 min) i z przyszlosci: 401", async () => {
    expect((await call({ tags: ["catalog"] }, { ts: TS - 301 })).status).toBe(401);
    expect((await call({ tags: ["catalog"] }, { ts: TS + 301 })).status).toBe(401);
    expect((await call({ tags: ["catalog"] }, { ts: TS - 299 })).status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("whitelist formatow: nieznany znacznik, pusta lista i dodatkowe pola: 422", async () => {
    for (const payload of [
      { tags: ["product:../etc"] },
      { tags: ["admin"] },
      { tags: ["product:Bazalt"] },
      { tags: [] },
      { tags: ["catalog"], extra: 1 },
    ]) {
      const res = await call(payload);
      expect(res.status, JSON.stringify(payload)).toBe(422);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("niepoprawny JSON z poprawnym podpisem: 422", async () => {
    expect((await call(null, { raw: "{nie json" })).status).toBe(422);
  });

  it("brak REVALIDATE_SECRET w srodowisku sklepu: 503 (nigdy domyslny klucz)", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await call({ tags: ["catalog"] })).status).toBe(503);
  });
});
