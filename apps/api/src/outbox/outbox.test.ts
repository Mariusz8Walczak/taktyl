// B-060 (ADR-0003): testy jednostkowe podpisu HMAC, agregacji znacznikow, backoffu i walidacji znacznikow outboxa.
import { describe, expect, it, vi } from "vitest";
import { OutboxService, stockTags } from "./outbox.service.js";
import { backoffMs, MAX_ATTEMPTS } from "./outbox.worker.js";
import { MAX_SKEW_SECONDS, signPayload, verifySignature } from "./signature.js";
import {
  aggregateTags,
  chunkTags,
  isValidTag,
  priceTags,
  productCreatedTags,
  productTags,
  reviewTags,
} from "./tags.js";

const SECRET = "r".repeat(40);
const NOW = new Date("2026-10-07T10:00:00Z");
const TS = Math.floor(NOW.getTime() / 1000);
const BODY = JSON.stringify({ tags: ["catalog"] });

describe("B-060 podpis HMAC webhooka", () => {
  it("wektor testowy jest ten sam co w odbiorniku web (apps/web/test/revalidate-route.test.ts)", () => {
    expect(signPayload(SECRET, 1791367200, BODY)).toBe(
      "13858b1045a62ca1b7d0396cd008d480842872b1c3b066f15eaaf1c0bf25a031",
    );
  });

  const check = (over: Partial<Parameters<typeof verifySignature>[0]> = {}) =>
    verifySignature({
      secret: SECRET,
      timestamp: String(TS),
      signature: signPayload(SECRET, TS, BODY),
      body: BODY,
      nowMs: NOW.getTime(),
      ...over,
    });

  it("poprawny podpis", () => expect(check()).toBe("ok"));

  it("zly podpis (inny sekret, inne cialo, nie-hex, inna dlugosc)", () => {
    expect(check({ signature: signPayload("x".repeat(40), TS, BODY) })).toBe("bad");
    expect(check({ body: JSON.stringify({ tags: ["presets"] }) })).toBe("bad");
    expect(check({ signature: "nie-hex" })).toBe("bad");
    expect(check({ signature: "ab" })).toBe("bad");
  });

  it("brak naglowkow", () => {
    expect(check({ signature: null })).toBe("missing");
    expect(check({ timestamp: undefined })).toBe("missing");
  });

  it("przeterminowany i przyszly znacznik czasu poza oknem 5 minut", () => {
    const old = TS - MAX_SKEW_SECONDS - 1;
    expect(check({ timestamp: String(old), signature: signPayload(SECRET, old, BODY) })).toBe(
      "stale",
    );
    const future = TS + MAX_SKEW_SECONDS + 1;
    expect(check({ timestamp: String(future), signature: signPayload(SECRET, future, BODY) })).toBe(
      "stale",
    );
    const edge = TS - MAX_SKEW_SECONDS;
    expect(check({ timestamp: String(edge), signature: signPayload(SECRET, edge, BODY) })).toBe(
      "ok",
    );
  });

  it("niecyfrowy znacznik czasu to blad", () => {
    expect(check({ timestamp: "12abc" })).toBe("bad");
  });
});

describe("B-060 znaczniki: agregacja, deduplikacja, paczki", () => {
  it("laczy wiersze, usuwa duplikaty, sortuje", () => {
    expect(
      aggregateTags([
        ["product:wrobel", "catalog"],
        ["catalog", "category:myszki", "product:wrobel"],
        ["presets"],
      ]),
    ).toEqual(["catalog", "category:myszki", "presets", "product:wrobel"]);
  });

  it("dzieli na paczki po 50 (limit webhooka)", () => {
    const tags = Array.from({ length: 120 }, (_, i) => `product:p-${i}`);
    expect(chunkTags(tags).map((c) => c.length)).toEqual([50, 50, 20]);
  });

  it("zestawy znacznikow z docs/14 par. 6 sa poprawnymi znacznikami", () => {
    const p = { slug: "wrobel", categoryId: "myszki" };
    expect(priceTags(p)).toEqual(["catalog", "category:myszki", "presets", "product:wrobel"]);
    expect(productTags(p)).toEqual([
      "catalog",
      "category:myszki",
      "facets:myszki",
      "presets",
      "product:wrobel",
    ]);
    expect(productCreatedTags(p)).toEqual(["catalog", "category:myszki", "facets:myszki"]);
    expect(reviewTags(p)).toEqual(["product:wrobel", "reviews:wrobel"]);
    expect(stockTags([p])).toEqual(["category:myszki", "facets:myszki", "product:wrobel"]);
    for (const t of [...priceTags(p), ...productTags(p), ...reviewTags(p), ...stockTags([p])]) {
      expect(isValidTag(t), t).toBe(true);
    }
    expect(isValidTag("product:Wrobel")).toBe(false);
    expect(isValidTag("cokolwiek")).toBe(false);
  });
});

describe("B-060 backoff wykladniczy", () => {
  it("5 s, 15 s, 45 s, 135 s, 5 min (limit), a 8 prob to maksimum", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffMs)).toEqual([
      5_000, 15_000, 45_000, 135_000, 300_000, 300_000, 300_000,
    ]);
    expect(MAX_ATTEMPTS).toBe(8);
  });
});

describe("B-060 OutboxService.enqueueTags", () => {
  const make = () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = { outbox: { create } } as never;
    return { create, tx, svc: new OutboxService(() => NOW) };
  };

  it("zapisuje posortowane, unikalne znaczniki ze stempla zegara (nextAttemptAt = teraz)", async () => {
    const { create, tx, svc } = make();
    await svc.enqueueTags(tx, ["product:a", "catalog", "product:a"], 7n);
    expect(create).toHaveBeenCalledWith({
      data: {
        tags: ["catalog", "product:a"],
        status: "pending",
        createdAt: NOW,
        nextAttemptAt: NOW,
        auditId: 7n,
      },
    });
  });

  it("pusta lista nic nie zapisuje, nieznany znacznik wycofuje transakcje bledem", async () => {
    const { create, tx, svc } = make();
    await svc.enqueueTags(tx, []);
    expect(create).not.toHaveBeenCalled();
    await expect(svc.enqueueTags(tx, ["catalog", "zly znacznik"])).rejects.toThrow(
      /Nieznany znacznik/,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
