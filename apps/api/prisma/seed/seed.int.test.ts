// B-102 (docs/17 par. 7, 10): test integracyjny seeda na prawdziwym PostgreSQL (kontener).
// Wymaga TEST_DATABASE_URL (baza po `prisma migrate deploy`); test CZYSCI te baze. Bez zmiennej jest pomijany.
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "../../src/prisma/create-client.js";
import { priceSet } from "@taktyl/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runSeed } from "./run.js";

const url = process.env.TEST_DATABASE_URL;
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const NOW = new Date("2026-10-07T10:00:00Z");

describe.skipIf(!url)("B-102 seed (PostgreSQL)", () => {
  const prisma = createPrismaClient(url ?? "postgresql://invalid");
  let first: Record<string, number> = {};

  const counts = async (): Promise<Record<string, number>> => ({
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.variant.count(),
    switches: await prisma.switch.count(),
    colors: await prisma.color.count(),
    presets: await prisma.preset.count(),
    presetItems: await prisma.presetItem.count(),
    priceHistory: await prisma.priceHistory.count(),
    stockMovements: await prisma.stockMovement.count(),
    productImages: await prisma.productImage.count(),
    facets: await prisma.facetDefinition.count(),
    pages: await prisma.contentPage.count(),
    shipping: await prisma.shippingMethod.count(),
    payments: await prisma.paymentMethod.count(),
    codes: await prisma.discountCode.count(),
    pickup: await prisma.pickupPoint.count(),
  });

  beforeAll(async () => {
    first = (await runSeed(prisma, { root, now: NOW, reset: true })).inserted;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("liczby kontrolne (docs/17 par. 6)", async () => {
    expect(await counts()).toMatchObject({
      categories: 3,
      products: 18,
      variants: 99,
      switches: 4,
      colors: 4,
      presets: 4,
      presetItems: 12,
      productImages: 190,
      shipping: 3,
      payments: 4,
      codes: 2,
      pickup: 6,
    });
    expect(await prisma.productImage.count({ where: { priority: "P0" } })).toBe(76);
    expect(first.variants).toBe(99);
  });

  it("opisy i strony z tresci trafiaja do bazy, wariant domyslny ustawiony", async () => {
    expect(await prisma.product.count({ where: { description: null } })).toBe(0);
    expect(await prisma.product.count({ where: { defaultVariantSku: null } })).toBe(0);
    expect(
      await prisma.contentPage.count({ where: { status: "published", demoNotice: true } }),
    ).toBeGreaterThanOrEqual(5);
  });

  it("stany pokazowe z JSON (docs/04 par. 2)", async () => {
    const stock = async (sku: string): Promise<number | undefined> =>
      (await prisma.variant.findUnique({ where: { sku } }))?.stock;
    expect(await stock("K-BZL75-KOB-SZP")).toBe(0);
    expect(await stock("P-LOD-L-MGL")).toBe(0);
    expect(await stock("K-KRD98-GRF-TRZ")).toBe(3);
    expect(await stock("M-JRZ-MGL")).toBe(2);
  });

  it("niezmiennik: SUM(stock_movements.delta) = variants.stock", async () => {
    const bad = await prisma.$queryRaw<{ sku: string }[]>`
      SELECT v.sku FROM variants v
      LEFT JOIN (SELECT sku, SUM(delta) AS s FROM stock_movements GROUP BY sku) m ON m.sku = v.sku
      WHERE COALESCE(m.s, 0) <> v.stock`;
    expect(bad).toEqual([]);
  });

  it("niezmiennik: price_gr = otwarty wiersz price_history, jeden otwarty wiersz na SKU", async () => {
    const mismatch = await prisma.$queryRaw<{ sku: string }[]>`
      SELECT v.sku FROM variants v
      LEFT JOIN price_history h ON h.sku = v.sku AND h.valid_to IS NULL
      WHERE h.price_gr IS DISTINCT FROM v.price_gr`;
    expect(mismatch).toEqual([]);
    const dup = await prisma.$queryRaw<{ sku: string }[]>`
      SELECT sku FROM price_history WHERE valid_to IS NULL GROUP BY sku HAVING COUNT(*) > 1`;
    expect(dup).toEqual([]);
  });

  /** Algorytm z docs/17 par. 5 (kroki 1-2) wzgledem T_cut najnowszej obnizki. */
  async function lowest30d(sku: string): Promise<number | null> {
    const rows = await prisma.$queryRaw<{ lowest: number | null }[]>`
      WITH cut AS (
        SELECT valid_from AS t FROM price_history
        WHERE sku = ${sku} AND valid_to IS NULL
      )
      SELECT MIN(h.price_gr)::int AS lowest
      FROM price_history h, cut
      WHERE h.sku = ${sku}
        AND h.valid_from < cut.t
        AND (h.valid_to IS NULL OR h.valid_to > cut.t - interval '30 days')`;
    return rows[0]?.lowest ?? null;
  }

  it("Granit TKL: najnizsza z 30 dni = 699 zl, cena 599 zl; Wrobel: 139 zl, cena 129 zl", async () => {
    for (const sku of ["K-GRNTKL-GRF-SLZ", "K-GRNTKL-MGL-SZP"]) {
      expect(await lowest30d(sku)).toBe(69900);
      expect((await prisma.variant.findUniqueOrThrow({ where: { sku } })).priceGr).toBe(59900);
    }
    for (const sku of ["M-WRB-GRF", "M-WRB-MGL"]) {
      expect(await lowest30d(sku)).toBe(13900);
      const v = await prisma.variant.findUniqueOrThrow({ where: { sku } });
      expect(v.priceGr).toBe(12900);
      expect(v.regularPriceGr).toBe(14900);
    }
  });

  it("warianty bez promocji nie maja obnizki (lowest_30d nie wyzsze od ceny)", async () => {
    expect(await lowest30d("K-KWR60-GRF-SLZ")).toBeNull();
    const promo = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(DISTINCT sku)::int AS n FROM price_history WHERE valid_to IS NOT NULL`;
    expect(promo[0]?.n).toBe(10);
  });

  it("ceny 4 presetow co do grosza (docs/03 par. 6): 1203,30 / 798,30 / 906,30 / 771,30", async () => {
    const shop = await prisma.shopSettings.findUniqueOrThrow({ where: { id: "default" } });
    const totals: Record<string, number> = {};
    for (const p of await prisma.preset.findMany({
      include: { items: { include: { variant: true } } },
    })) {
      const price = priceSet(
        p.items.map((i) => ({ sku: i.sku, category: i.categoryId, price: i.variant.priceGr })),
        { percent: shop.setDiscountPercent, requiresCategories: shop.setDiscountCategories },
      );
      totals[p.id] = price.total;
    }
    expect(totals).toEqual({ programista: 120330, fps: 79830, "open-space": 90630, kobalt: 77130 });
  });

  it("ustawienia sklepu w groszach", async () => {
    const shop = await prisma.shopSettings.findUniqueOrThrow({ where: { id: "default" } });
    expect(shop.freeShippingThresholdGr).toBe(29900);
    expect(shop.setDiscountPercent).toBe(10);
    const ship = await prisma.shippingMethod.findMany({ orderBy: { position: "asc" } });
    expect(ship.map((s) => [s.id, s.priceGr])).toEqual([
      ["automat", 1299],
      ["kurier", 1699],
      ["odbior", 0],
    ]);
  });

  it("nie tworzy kont admina (robi to TAKTYL-45)", async () => {
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it("idempotencja: drugi przebieg nic nie dodaje i nie nadpisuje edycji", async () => {
    const before = await counts();
    await prisma.variant.update({ where: { sku: "M-JRZ-MGL" }, data: { stock: 7 } });
    await prisma.product.update({
      where: { id: "k-kwarc-60" },
      data: { name: "Edycja z backpanelu" },
    });
    const second = (await runSeed(prisma, { root, now: new Date("2026-11-01T10:00:00Z") }))
      .inserted;
    expect(await counts()).toEqual(before);
    expect(Object.values(second).every((n) => n === 0)).toBe(true);
    expect((await prisma.variant.findUniqueOrThrow({ where: { sku: "M-JRZ-MGL" } })).stock).toBe(7);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "k-kwarc-60" } })).name).toBe(
      "Edycja z backpanelu",
    );
  });

  it("reset-demo: czysci zamowienia i dane osobowe, zostawia konta, seeduje od nowa", async () => {
    const user = await prisma.adminUser.create({
      data: { email: "owner@taktyl.example", role: "owner" },
    });
    await prisma.newsletterSignup.create({ data: { email: "klient@taktyl.example" } });
    const before = await counts();
    await runSeed(prisma, { root, now: NOW, reset: true });
    expect(await counts()).toEqual(before);
    expect(await prisma.newsletterSignup.count()).toBe(0);
    expect(await prisma.adminUser.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "k-kwarc-60" } })).name).toBe(
      "Kwarc 60",
    );
    await prisma.adminUser.delete({ where: { id: user.id } });
  });

  it("ograniczenia bazy: marka, stan, jeden otwarty wiersz ceny, tylko-dopisywanie", async () => {
    await expect(
      prisma.product.update({ where: { id: "k-kwarc-60" }, data: { brand: "Inna" } }),
    ).rejects.toThrow();
    await expect(
      prisma.variant.update({ where: { sku: "M-JRZ-MGL" }, data: { stock: -1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.priceHistory.create({ data: { sku: "M-JRZ-MGL", priceGr: 100, validFrom: NOW } }),
    ).rejects.toThrow();
    await expect(prisma.priceHistory.deleteMany({ where: { sku: "M-JRZ-MGL" } })).rejects.toThrow(
      /tylko do dopisywania/,
    );
    await expect(
      prisma.priceHistory.updateMany({
        where: { sku: "M-JRZ-MGL", validTo: null },
        data: { priceGr: 1 },
      }),
    ).rejects.toThrow(/tylko do dopisywania/);
    const jrz = await prisma.variant.findUniqueOrThrow({ where: { sku: "M-JRZ-MGL" } });
    await expect(
      prisma.variant.create({
        data: {
          sku: "M-JRZ-GRF",
          productId: jrz.productId,
          colorId: jrz.colorId,
          priceGr: 1,
          stock: 1,
          imagesKey: "mgla",
        },
      }),
    ).rejects.toThrow(); // ta sama kombinacja produkt+kolor+przelacznik+rozmiar (NULLS NOT DISTINCT)
  });

  it("audit_log tylko do dopisywania; numer zamowienia z alfabetu bez 0/O/1/I", async () => {
    const row = await prisma.auditLog.create({
      data: { actorRole: "system", action: "test", entity: "test", entityId: "1", requestId: "r1" },
    });
    await expect(
      prisma.auditLog.update({ where: { id: row.id }, data: { action: "x" } }),
    ).rejects.toThrow(/dopisywania/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/dopisywania/);
    await prisma.$executeRaw`TRUNCATE TABLE audit_log CASCADE`;
    const order = (number: string) =>
      prisma.order.create({
        data: {
          number,
          status: "pending_payment",
          orderTokenHash: "h",
          idempotencyKey: `k-${number}`,
          shippingMethodId: "odbior",
          paymentType: "blik",
          itemsGr: 100,
          setDiscountGr: 0,
          couponDiscountGr: 0,
          shippingGr: 0,
          totalGr: 100,
          consents: { terms: true },
        },
      });
    await expect(order("TK-261007-A1B2")).rejects.toThrow();
    await expect(order("TK-261007-A7B2")).resolves.toMatchObject({ number: "TK-261007-A7B2" });
    await prisma.$executeRaw`TRUNCATE TABLE orders CASCADE`;
  });
});
