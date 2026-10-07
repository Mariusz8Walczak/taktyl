// F-076, F-220, F-221, F-223 (TAKTYL-76): publiczne API tresci, opinii i formularzy na PostgreSQL - strona prawna ze seeda, poradnik,
// FAQ, opinie demo (etykieta, srednia, brak danych strukturalnych), formularze (walidacja, strictObject, limit 5/min, brak PII w logach),
// retencja 30 dni.
import {
  contentPageSchema,
  faqSchema,
  FORM_DEMO_NOTICE,
  formAcceptedSchema,
  guideListSchema,
  problemSchema,
  REVIEWS_LABEL,
  reviewsResponseSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MessagesRetentionService } from "../src/public-content/messages-retention.service.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

const DAY = 86_400_000;
const EMAIL = "Anna.Test-Prywatna@Taktyl.example";

describe.skipIf(!hasDb)("F-076, F-220, F-221 publiczne tresci i opinie (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await reseed(t.prisma);
  });

  it("strona prawna ze seeda: schemat, naglowek wzoru, cache z ETag, brak danych strukturalnych", async () => {
    const res = await t.http().get("/v1/content/pages/regulamin").expect(200);
    const page = contentPageSchema.parse(res.body);
    expect(page).toMatchObject({ slug: "regulamin", type: "page", demo_notice: true });
    expect(page.body_md.length).toBeGreaterThan(100);
    expect(res.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    expect(res.headers["etag"]).toBeTruthy();
    const again = await t
      .http()
      .get("/v1/content/pages/regulamin")
      .set("If-None-Match", String(res.headers["etag"]));
    expect(again.status).toBe(304);
  });

  it("strony: nieznany slug, szkic, archiwum i artykul poradnika pod /pages to 404; zly slug to 400", async () => {
    const miss = await t.http().get("/v1/content/pages/nie-ma-takiej").expect(404);
    expect(problemSchema.parse(miss.body).code).toBe("not_found");
    for (const status of ["draft", "archived"]) {
      await t.prisma.contentPage.update({ where: { slug: "cookies" }, data: { status } });
      await t.http().get("/v1/content/pages/cookies").expect(404);
    }
    await t.prisma.contentPage.create({
      data: {
        slug: "jak-wybrac",
        type: "guide",
        title: "Jak wybrac",
        bodyMd: "Tresc",
        status: "published",
      },
    });
    await t.http().get("/v1/content/pages/jak-wybrac").expect(404);
    await t.http().get("/v1/content/pages/ZLY%20SLUG").expect(400);
  });

  it("seed: 4 poradniki, FAQ i opinie z plikow tresci sa dostepne w API (F-220, F-221, F-076)", async () => {
    const guides = guideListSchema.parse(
      (await t.http().get("/v1/content/guides").expect(200)).body,
    );
    expect(guides.items.map((g) => g.slug).sort()).toEqual([
      "jak-dobrac-mysz-do-dloni",
      "jak-wybrac-przelaczniki",
      "jaka-podkladka",
      "rozmiary-klawiatur",
    ]);
    for (const g of guides.items) {
      expect(g.lead).toBeTruthy();
      expect(g.guide_profile).toBeTruthy();
    }
    const guide = contentPageSchema.parse(
      (await t.http().get("/v1/content/guides/jak-wybrac-przelaczniki").expect(200)).body,
    );
    expect(guide).toMatchObject({
      type: "guide",
      guide_profile: "programowanie",
      demo_notice: true,
    });
    expect(guide.body_md).toContain("(/zbuduj-set?profil=programowanie)");
    for (const slug of ["o-sklepie", "kontakt", "zuzyty-sprzet"]) {
      const page = contentPageSchema.parse(
        (await t.http().get(`/v1/content/pages/${slug}`).expect(200)).body,
      );
      expect(page.demo_notice).toBe(true);
    }
    const faq = faqSchema.parse((await t.http().get("/v1/content/faq").expect(200)).body);
    expect(faq.items.length).toBeGreaterThanOrEqual(8);
    const reviews = reviewsResponseSchema.parse(
      (await t.http().get("/v1/products/bazalt-75/reviews").expect(200)).body,
    );
    expect(reviews.label).toBe(REVIEWS_LABEL);
    expect(reviews.count).toBeGreaterThanOrEqual(3);
    expect(reviews.count).toBeLessThanOrEqual(6);
    expect(reviews.avg).not.toBeNull();
    expect(reviews.items.every((r) => r.demo && r.rating >= 3 && r.rating <= 5)).toBe(true);
    expect(JSON.stringify(reviews)).not.toMatch(/aggregateRating|@type|schema\.org/);
  });

  it("poradnik: lista tylko opublikowanych (najnowsze pierwsze) i artykul po slugu", async () => {
    await t.prisma.contentPage.deleteMany({ where: { type: "guide" } });
    expect(
      guideListSchema.parse((await t.http().get("/v1/content/guides").expect(200)).body).items,
    ).toEqual([]);
    const base = { type: "guide", bodyMd: "Tresc artykulu", status: "published" };
    await t.prisma.contentPage.createMany({
      data: [
        {
          ...base,
          slug: "starszy",
          title: "Starszy",
          publishedAt: new Date(NOW.getTime() - 5 * DAY),
        },
        {
          ...base,
          slug: "nowszy",
          title: "Nowszy",
          lead: "Wstep",
          guideProfile: "gry",
          publishedAt: new Date(NOW.getTime() - DAY),
        },
        { ...base, slug: "szkic", title: "Szkic", status: "draft" },
      ],
    });
    const list = guideListSchema.parse((await t.http().get("/v1/content/guides").expect(200)).body);
    expect(list.items.map((i) => i.slug)).toEqual(["nowszy", "starszy"]);
    expect(list.items[0]).toMatchObject({ lead: "Wstep", guide_profile: "gry" });
    const one = contentPageSchema.parse(
      (await t.http().get("/v1/content/guides/nowszy").expect(200)).body,
    );
    expect(one).toMatchObject({ type: "guide", title: "Nowszy", guide_profile: "gry" });
    await t.http().get("/v1/content/guides/szkic").expect(404);
    await t.http().get("/v1/content/guides/regulamin").expect(404);
  });

  it("FAQ: tylko opublikowane, w ustalonej kolejnosci", async () => {
    await t.prisma.faqItem.deleteMany();
    await t.prisma.faqItem.createMany({
      data: [
        { question: "Drugie?", answerMd: "B", position: 2 },
        { question: "Pierwsze?", answerMd: "A", position: 1 },
        { question: "Szkic?", answerMd: "C", position: 3, status: "draft" },
      ],
    });
    const faq = faqSchema.parse((await t.http().get("/v1/content/faq").expect(200)).body);
    expect(faq.items.map((i) => i.question)).toEqual(["Pierwsze?", "Drugie?"]);
  });

  it("opinie: etykieta demo, srednia z liczba (1 miejsce), najnowsze pierwsze, brak aggregateRating", async () => {
    const product = await t.prisma.product.findFirstOrThrow({ where: { status: "active" } });
    await t.prisma.review.deleteMany({ where: { productId: product.id } });
    await t.prisma.review.createMany({
      data: [
        {
          productId: product.id,
          author: "Ola K.",
          date: new Date("2026-08-01"),
          rating: 5,
          variantLabel: "Grafit",
          text: "Dobrze.",
          demo: true,
        },
        {
          productId: product.id,
          author: "Jan P.",
          date: new Date("2026-09-10"),
          rating: 4,
          variantLabel: "Grafit",
          text: "Cicho.",
          demo: true,
        },
        {
          productId: product.id,
          author: "Ewa M.",
          date: new Date("2026-09-01"),
          rating: 4,
          variantLabel: "Grafit",
          text: "Lekko.",
          demo: true,
        },
      ],
    });
    const res = await t.http().get(`/v1/products/${product.slug}/reviews`).expect(200);
    const body = reviewsResponseSchema.parse(res.body);
    expect(body).toMatchObject({ label: REVIEWS_LABEL, avg: 4.3, count: 3 });
    expect(body.items.map((r) => r.author)).toEqual(["Jan P.", "Ewa M.", "Ola K."]);
    expect(body.items.every((r) => r.demo === true)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/aggregateRating|@type|schema\.org/);
    expect(res.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
  });

  it("opinie: produkt bez opinii ma avg null i count 0; nieznany lub ukryty produkt to 404", async () => {
    const product = await t.prisma.product.findFirstOrThrow({ where: { status: "active" } });
    await t.prisma.review.deleteMany({ where: { productId: product.id } });
    const empty = reviewsResponseSchema.parse(
      (await t.http().get(`/v1/products/${product.slug}/reviews`).expect(200)).body,
    );
    expect(empty).toMatchObject({ label: REVIEWS_LABEL, avg: null, count: 0, items: [] });
    await t.http().get("/v1/products/nie-ma-takiego/reviews").expect(404);
    await t.prisma.product.update({ where: { id: product.id }, data: { status: "archived" } });
    await t.http().get(`/v1/products/${product.slug}/reviews`).expect(404);
  });
});

describe.skipIf(!hasDb)("F-221, F-223 formularze i retencja (PostgreSQL)", () => {
  let t: TestEnv;
  const logs: string[] = [];
  beforeAll(async () => {
    t = await bootApp({ logSink: { write: (chunk: string) => void logs.push(chunk) } });
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await reseed(t.prisma);
    logs.length = 0;
  });

  const contact = (over: object = {}) =>
    t
      .http()
      .post("/v1/forms/contact")
      .send({ email: EMAIL, subject: "Pytanie o dostawe", message: "Kiedy wysylacie?", ...over });

  it("kontakt: 201, zapis do bazy, komunikat o braku wysylki e-maili, no-store", async () => {
    const res = await contact().expect(201);
    const body = formAcceptedSchema.parse(res.body);
    expect(body.message).toContain(FORM_DEMO_NOTICE);
    expect(res.headers["cache-control"]).toBe("no-store");
    const rows = await t.prisma.contactMessage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: EMAIL.toLowerCase(),
      subject: "Pytanie o dostawe",
      body: "Kiedy wysylacie?",
      handled: false,
    });
  });

  it("kontakt: zly e-mail, krotka tresc, brak pol i nieznane pole (strictObject) to 422 bez zapisu", async () => {
    for (const over of [
      { email: "to-nie-email" },
      { message: "x" },
      { subject: "" },
      { website: "http://spam.example" },
      { consent: true },
    ]) {
      const res = await contact(over).expect(422);
      expect(problemSchema.parse(res.body).code).toBe("validation_failed");
    }
    await t.http().post("/v1/forms/contact").send({}).expect(422);
    expect(await t.prisma.contactMessage.count()).toBe(0);
  });

  it("newsletter: 201 i zapis; ten sam e-mail drugi raz daje ta sama odpowiedz i jeden wiersz", async () => {
    const send = () => t.http().post("/v1/forms/newsletter").send({ email: EMAIL });
    const first = formAcceptedSchema.parse((await send().expect(201)).body);
    const second = formAcceptedSchema.parse((await send().expect(201)).body);
    expect(second).toEqual(first);
    expect(first.message).toContain(FORM_DEMO_NOTICE);
    expect(await t.prisma.newsletterSignup.count()).toBe(1);
  });

  it("newsletter: zly e-mail i dodatkowe pola (zgoda z gory, imie) to 422", async () => {
    for (const body of [
      { email: "zly" },
      { email: EMAIL, consent: true },
      { email: EMAIL, name: "Anna" },
      {},
    ]) {
      await t.http().post("/v1/forms/newsletter").send(body).expect(422);
    }
    expect(await t.prisma.newsletterSignup.count()).toBe(0);
  });

  it("brak danych osobowych w logach i w audit_log po zapisie formularzy", async () => {
    await contact({ message: "Tajna tresc wiadomosci 12345" }).expect(201);
    await t.http().post("/v1/forms/newsletter").send({ email: EMAIL }).expect(201);
    await contact({ email: "zly" }).expect(422);
    const all = logs.join("\n");
    expect(all).toContain("request");
    expect(all).not.toMatch(/anna|taktyl\.example|Tajna|12345/i);
    expect(await t.prisma.auditLog.count()).toBe(0);
  });

  it("retencja 30 dni: purge usuwa stare zgloszenia, zostawia swieze, audyt bez danych osobowych", async () => {
    const old = new Date(NOW.getTime() - 31 * DAY);
    const fresh = new Date(NOW.getTime() - 29 * DAY);
    await t.prisma.contactMessage.createMany({
      data: [
        { email: "stara@taktyl.example", subject: "Stara", body: "Tresc starej", createdAt: old },
        {
          email: "swieza@taktyl.example",
          subject: "Swieza",
          body: "Tresc swiezej",
          createdAt: fresh,
        },
      ],
    });
    await t.prisma.newsletterSignup.createMany({
      data: [
        { email: "stary-news@taktyl.example", createdAt: old },
        { email: "swiezy-news@taktyl.example", createdAt: fresh },
      ],
    });
    const counts = await t.app.get(MessagesRetentionService).purge();
    expect(counts).toEqual({ contact: 1, newsletter: 1 });
    expect((await t.prisma.contactMessage.findMany()).map((m) => m.subject)).toEqual(["Swieza"]);
    expect((await t.prisma.newsletterSignup.findMany()).map((m) => m.email)).toEqual([
      "swiezy-news@taktyl.example",
    ]);
    const audit = await t.prisma.auditLog.findMany({
      where: { action: "messages.retention_purge" },
    });
    expect(audit).toHaveLength(1);
    expect(
      JSON.stringify(audit, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    ).not.toMatch(/taktyl\.example|Tresc/);
    expect(await t.app.get(MessagesRetentionService).purge()).toEqual({
      contact: 0,
      newsletter: 0,
    });
  });
});

describe.skipIf(!hasDb)("F-221, F-223 limit formularzy 5/min (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp({ rateLimit: true, seed: false });
  });
  afterAll(async () => {
    await t.close();
  });

  it("6. zadanie w minucie na endpoint = 429 rate_limited z Retry-After; drugi formularz ma wlasny licznik", async () => {
    const statuses: number[] = [];
    let last: Awaited<ReturnType<ReturnType<TestEnv["http"]>["post"]>> | undefined;
    for (let i = 0; i < 6; i++) {
      last = await t.http().post("/v1/forms/contact").send({});
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 422)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(last?.headers["retry-after"]).toBeTruthy();
    expect(problemSchema.parse(last?.body)).toMatchObject({ status: 429, code: "rate_limited" });
    await t.http().post("/v1/forms/newsletter").send({}).expect(422);
  });
});
