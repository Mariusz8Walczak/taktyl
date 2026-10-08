// TAKTYL-54: S30 (webhook propagacji, ADR-0003), S34 (noindex na sklepie, panelu i API) i S35 (bezposrednie POST /v1/orders)
// z docs/12 par. 7. Wszystko na poziomie HTTP (request), bez przegladarki. Sekret webhooka pochodzi ze zmiennej srodowiskowej
// kontenera (REVALIDATE_SECRET z .env stosu), nie z repozytorium.
import { expect, test } from "@playwright/test";
import {
  ADMIN_URL,
  AdminApi,
  API_URL,
  createOrder,
  getVariant,
  nodeContext,
  revalidateSecret,
  shopContext,
  signRevalidate,
} from "../../helpers/admin";
import { SITE_URL } from "../../playwright.config";

test.describe("S30: webhook POST /api/revalidate sklepu", () => {
  const body = JSON.stringify({ tags: ["product:wrobel"] });

  async function call(headers: Record<string, string>, payload = body) {
    const shop = await shopContext();
    try {
      const res = await shop.post("/api/revalidate", {
        headers: { "content-type": "application/json", ...headers },
        data: payload,
      });
      return { status: res.status(), text: await res.text() };
    } finally {
      await shop.dispose();
    }
  }

  const signed = (secret: string, ts: number, payload = body) => ({
    "x-taktyl-timestamp": String(ts),
    "x-taktyl-signature": signRevalidate(secret, ts, payload),
  });

  test("S30: bledny podpis HMAC, brak podpisu, powtorzenie spoza okna 5 min i zmieniona tresc daja 401 bez odswiezenia", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const wrong = await call(signed("zly-sekret-zly-sekret-zly-sekret-12", ts));
    expect(wrong.status).toBe(401);
    expect(wrong.text).not.toContain("revalidated");

    expect((await call({})).status).toBe(401);

    // poprawny podpis, ale znacznik czasu poza oknem 5 minut (powtorzenie zadania)
    expect((await call(signed(revalidateSecret(), ts - 3_600))).status).toBe(401);

    // podpis pod inna trescia niz wyslana
    const tampered = await call(
      signed(revalidateSecret(), ts),
      JSON.stringify({ tags: ["catalog"] }),
    );
    expect(tampered.status).toBe(401);
  });

  test("S30: poprawny podpis jest przyjety (200 z lista znacznikow), nieznany znacznik to 422", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = await call(signed(revalidateSecret(), ts));
    expect(good.status).toBe(200);
    expect(JSON.parse(good.text)).toEqual({ revalidated: ["product:wrobel"] });

    const badBody = JSON.stringify({ tags: ["nie-ma-takiego-znacznika!"] });
    const unknownTag = await call(signed(revalidateSecret(), ts, badBody), badBody);
    expect(unknownTag.status).toBe(422);
  });

  // Czesc "wylacz sklep, zmien cene, wlacz sklep" wymaga stop/start kontenera `web`, czego kontener e2e nie moze zrobic
  // (brak gniazda Dockera). Pokrywa ja scripts/smoke-outbox.sh na hoscie (make smoke-outbox, job CI `e2e-demo`), TAKTYL-71;
  // ponawianie outboxu (5 s * 3^(n-1), po 8 probach `failed`) pokrywaja tez testy jednostkowe OutboxWorker w apps/api.
});

test.describe("S34: noindex", () => {
  test("S34: sklep, panel i API odpowiadaja X-Robots-Tag noindex, nofollow; sklep ma meta robots i robots.txt blokujacy", async () => {
    for (const [name, url, path] of [
      ["sklep", SITE_URL, "/"],
      ["panel", ADMIN_URL, "/logowanie"],
      ["API", API_URL, "/v1/categories"],
    ] as const) {
      const ctx = await nodeContext(url);
      const res = await ctx.get(path);
      expect(res.status(), name).toBe(200);
      expect(res.headers()["x-robots-tag"], `${name}: X-Robots-Tag`).toBe("noindex, nofollow");
      if (name === "sklep") {
        // robots.txt jest czescia sklepu (docs/14 par. 5); panel i API chronia sie naglowkiem.
        const robots = await ctx.get("/robots.txt");
        expect(robots.status(), "sklep: robots.txt").toBe(200);
        expect(await robots.text(), "sklep: robots.txt").toMatch(/Disallow:\s*\/\s*$/m);
        expect(await res.text()).toMatch(
          /<meta[^>]+name="robots"[^>]+content="noindex, nofollow"|<meta[^>]+content="noindex, nofollow"[^>]+name="robots"/,
        );
      }
      await ctx.dispose();
    }
  });
});

test.describe("S35: bezposrednie POST /v1/orders", () => {
  test("S35: nieistniejacy SKU to 422 z lista, kwota z klienta nie wplywa na cene, ten sam Idempotency-Key zwraca to samo zamowienie bez drugiego zmniejszenia stanu", async () => {
    test.setTimeout(150_000); // limit 429 na POST /v1/orders: czekanie na Retry-After (retryOn429)
    const owner = await AdminApi.as("owner");
    const SKU = "M-MEW-KOB";

    // poprawnie zbudowany, ale nieistniejacy SKU
    const unknown = await createOrder("M-ZZZ-GRF", crypto.randomUUID(), 100);
    expect(unknown.status).toBe(422);
    expect(JSON.stringify(unknown.body.errors)).toContain("M-ZZZ-GRF");
    expect(JSON.stringify(unknown.body.errors)).toContain("unknown_sku");

    // zanizona kwota z klienta (1,00 zl): serwer nie przyjmuje jej jako ceny
    const stock0 = (await getVariant(owner, "m-mewa", SKU)).stock;
    const low = await createOrder(SKU, crypto.randomUUID(), 100);
    expect(low.status, JSON.stringify(low.body)).toBe(409);
    expect(low.body.code).toBe("price_changed");
    expect((await getVariant(owner, "m-mewa", SKU)).stock).toBe(stock0);

    // idempotencja: dwa zadania z tym samym kluczem to jedno zamowienie i jedno zmniejszenie stanu
    const key = crypto.randomUUID();
    const a = await createOrder(SKU, key);
    expect(a.status).toBe(201);
    expect(a.body.total_gr).toBe(27_900);
    const stock1 = (await getVariant(owner, "m-mewa", SKU)).stock;
    const b = await createOrder(SKU, key);
    expect([200, 201]).toContain(b.status);
    expect(b.body.number).toBe(a.body.number);
    expect(b.body.total_gr).toBe(a.body.total_gr);
    expect((await getVariant(owner, "m-mewa", SKU)).stock).toBe(stock1);
    expect(stock0 - stock1).toBeLessThanOrEqual(1);
    await owner.dispose();
  });
});
