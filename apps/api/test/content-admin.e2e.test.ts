// B-300..B-309 (TAKTYL-61): tresci w backpanelu na PostgreSQL - strony i poradnik (sanityzacja XSS, tresci prawne, If-Match, wersje),
// FAQ, opisy produktow (zakazane slowa jako ostrzezenia), opinie demo, zgloszenia (maskowanie), role, audyt, znaczniki outbox.
import { adminContentResponseSchema, adminFaqSchema, REVIEWS_LABEL } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

type Role = "owner" | "editor" | "viewer";
type Method = "get" | "post" | "patch" | "put" | "delete";

const BRAND = "MarkaTestowa";
const words = (n: number, prefix = "slowo"): string =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

describe.skipIf(!hasDb)("B-300..B-309 tresci w backpanelu (PostgreSQL)", () => {
  let t: TestEnv;
  const accounts: Record<Role, { email: string; password: string }> = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<Role, LoggedIn>;

  beforeAll(async () => {
    t = await bootApp({ env: { FORBIDDEN_BRANDS: BRAND } });
    await resetAuth(t.prisma);
    let n = 0;
    for (const [role, a] of Object.entries(accounts) as [Role, (typeof accounts)[Role]][]) {
      await addUser(t.prisma, a.email, role, a.password);
      sessions[role] = await login(t, a.email, a.password, `10.9.0.${++n}`);
    }
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });
  beforeEach(async () => {
    await reseed(t.prisma);
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
  });

  const call = (
    role: Role,
    method: Method,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    let r = t.http()[method](path).set("Cookie", sessions[role].cookie);
    if (method !== "get") r = r.set("X-CSRF-Token", sessions[role].csrf);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return body === undefined ? r : r.send(body as object);
  };
  const ifMatch = (v: number) => ({ "If-Match": `"${v}"` });
  const outbox = () => t.prisma.outbox.findMany({ orderBy: { id: "asc" } });
  const audits = (action: string) =>
    t.prisma.auditLog.findMany({ where: { action }, orderBy: { id: "asc" } });
  const page = (slug: string) => t.prisma.contentPage.findUniqueOrThrow({ where: { slug } });
  const patchPage = async (slug: string, body: object, version?: number, role: Role = "editor") => {
    const p = await page(slug);
    return call(role, "patch", `/v1/admin/content/${p.id}`, body, ifMatch(version ?? p.version));
  };

  // ------------------------------------------------------------------ role

  it("viewer czyta tresci, opinie, FAQ i zgloszenia, ale kazdy zapis daje 403; editor nie usuwa (owner tak)", async () => {
    for (const path of [
      "/v1/admin/content",
      "/v1/admin/faq",
      "/v1/admin/reviews",
      "/v1/admin/messages",
    ]) {
      expect((await call("viewer", "get", path)).status, path).toBe(200);
    }
    const p = await page("regulamin");
    const writes: [Method, string, unknown?, Record<string, string>?][] = [
      ["post", "/v1/admin/content", { slug: "nowa", type: "guide", title: "Tytul", body_md: "x" }],
      ["patch", `/v1/admin/content/${p.id}`, { title: "Inny" }, ifMatch(1)],
      ["put", "/v1/admin/faq", { items: [] }],
      ["put", "/v1/admin/products/m-wrobel/description", { description: "x" }, ifMatch(1)],
      ["put", "/v1/admin/products/m-wrobel/reviews", { items: [] }],
      ["patch", "/v1/admin/messages/abcdef", { handled: true }],
      ["delete", `/v1/admin/content/${p.id}`],
      ["delete", "/v1/admin/messages/abcdef"],
    ];
    for (const [m, path, b, h] of writes) {
      const res = await call("viewer", m, path, b, h);
      expect(res.status, `${m} ${path}`).toBe(403);
    }
    expect((await call("editor", "delete", `/v1/admin/content/${p.id}`)).status).toBe(403);
    expect((await call("editor", "delete", "/v1/admin/messages/abcdef")).status).toBe(403);
    expect(await outbox()).toHaveLength(0);
  });

  // ------------------------------------------------------------------ strony i artykuly

  it("lista i szczegoly stron z seeda: 8 stron (5 prawnych i 3 informacyjne) i 4 poradniki, ETag = wersja", async () => {
    const list = await call("viewer", "get", "/v1/admin/content?type=page");
    expect(list.body.items.map((i: { slug: string }) => i.slug).sort()).toEqual([
      "cookies",
      "dostawa-i-platnosci",
      "kontakt",
      "o-sklepie",
      "polityka-prywatnosci",
      "regulamin",
      "zuzyty-sprzet",
      "zwroty-i-reklamacje",
    ]);
    expect(list.body.items.every((i: { type: string }) => i.type === "page")).toBe(true);
    const guides = await call("viewer", "get", "/v1/admin/content?type=guide");
    expect(guides.body.items.map((i: { slug: string }) => i.slug).sort()).toEqual([
      "jak-dobrac-mysz-do-dloni",
      "jak-wybrac-przelaczniki",
      "jaka-podkladka",
      "rozmiary-klawiatur",
    ]);
    const p = await page("regulamin");
    const one = await call("viewer", "get", `/v1/admin/content/${p.id}`);
    expect(one.status).toBe(200);
    expect(one.headers["etag"]).toBe('"1"');
    expect(adminContentResponseSchema.parse(one.body)).toMatchObject({
      slug: "regulamin",
      demo_notice: true,
      status: "published",
    });
    expect((await call("viewer", "get", "/v1/admin/content/nieistnieje1")).status).toBe(404);
  });

  it("B-305: edycja strony - wersja, If-Match (412, 428), znaczniki content:{slug}, audyt, historia wersji; naglowek demo nieusuwalny", async () => {
    const before = await page("regulamin");
    const body = `${before.bodyMd}\n\nDopisek redakcji.`;
    const res = await patchPage("regulamin", { body_md: body, title: "Regulamin sklepu" }, 1);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.headers["etag"]).toBe('"2"');
    expect(res.body).toMatchObject({ title: "Regulamin sklepu", version: 2, warnings: [] });

    expect((await patchPage("regulamin", { title: "Inny" }, 1)).status).toBe(412);
    const p = await page("regulamin");
    expect(
      (await call("editor", "patch", `/v1/admin/content/${p.id}`, { title: "Inny" })).status,
    ).toBe(428);

    const out = await outbox();
    expect(out).toHaveLength(1);
    expect(out[0]!.tags).toEqual(["content:regulamin"]);
    const [a] = await audits("content.update");
    expect(a).toMatchObject({
      entity: "content",
      entityId: p.id,
      actorRole: "editor",
      before: { title: "Regulamin", body_md_chars: before.bodyMd.length },
      after: { title: "Regulamin sklepu", body_md_chars: body.length },
    });
    const revisions = await t.prisma.contentRevision.findMany({ where: { pageId: p.id } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ title: "Regulamin", bodyMd: before.bodyMd });

    // naglowek "Wzor tresci..." jest nieusuwalny
    const lock = await patchPage("regulamin", { demo_notice: false });
    expect(lock.status).toBe(422);
    expect(lock.body.errors[0].code).toBe("demo_notice_locked");
    // identyczne wartosci: brak podbicia wersji, audytu i outboxa
    const same = await patchPage("regulamin", { title: "Regulamin sklepu" });
    expect(same.status).toBe(200);
    expect(same.body.version).toBe(2);
    expect(await audits("content.update")).toHaveLength(1);
    expect(await outbox()).toHaveLength(1);
  });

  it("historia wersji: zachowuje ostatnie 20", async () => {
    for (let i = 0; i < 23; i++) {
      const r = await patchPage("cookies", { body_md: `Wersja ${i}` });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    const p = await page("cookies");
    expect(await t.prisma.contentRevision.count({ where: { pageId: p.id } })).toBe(20);
    expect(p.version).toBe(24);
  });

  it("sanityzacja XSS: skrypty, ramki, obrazy, zdarzenia on*, javascript: i data: nie trafiaja do bazy; ostrzezenie content_sanitized", async () => {
    const dirty = [
      "<script>alert(1)</script>Akapit.",
      '<img src=x onerror="alert(1)">',
      '<a href="javascript:alert(1)">klik</a> i <a href="https://evil.example/x">obcy</a>',
      "[md](javascript:alert(1)) ![obraz](https://evil.example/x.png)",
      '<iframe src="//evil.example"></iframe><svg onload=alert(1)>',
      '<p onclick="alert(1)" style="x:y">tekst</p>',
      "**pogrubione** i [zwroty](/zwroty-i-reklamacje)",
    ].join("\n\n");
    const res = await patchPage("regulamin", {
      body_md: dirty,
      title: "<b>Regulamin</b><script>x()</script>",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.title).toBe("Regulamin");
    expect(res.body.warnings).toEqual([
      expect.objectContaining({ code: "content_sanitized", details: ["title", "body_md"] }),
    ]);
    const stored = (await page("regulamin")).bodyMd;
    for (const bad of [
      /<script/i,
      /<iframe/i,
      /<img/i,
      /<svg/i,
      /onerror/i,
      /onclick/i,
      /javascript:/i,
      /evil\.example/i,
      /style=/i,
      /!\[/,
    ]) {
      expect(stored).not.toMatch(bad);
    }
    expect(stored).toContain("Akapit.");
    expect(stored).toContain("**pogrubione**");
    expect(stored).toContain("[zwroty](/zwroty-i-reklamacje)");
    expect(stored).toContain("<p>tekst</p>");
    // odczyt zwraca to samo, co w bazie
    const p = await page("regulamin");
    expect((await call("viewer", "get", `/v1/admin/content/${p.id}`)).body.body_md).toBe(stored);
  });

  it("B-306: tresc prawna z ODR, numerem NIP/KRS, obcym e-mailem lub marka jest odrzucona ze wskazaniem linii; wartosci nie zapisane", async () => {
    const cases: [string, string][] = [
      ["Wstep\nPlatforma ODR: https://ec.europa.eu/consumers/odr", "odr_link"],
      ["Wstep\nNIP: 123-456-78-90", "forbidden_identifier"],
      ["Wstep\nKRS 0000123456", "forbidden_identifier"],
      ["Wstep\nPisz: biuro@firma.com", "invalid_domain"],
      ["Wstep\nDzwon: 601 234 567", "real_phone"],
      [`Wstep\nSprzedaje ${BRAND} sp. z o.o.`, "real_brand"],
    ];
    for (const [body_md, code] of cases) {
      const r = await patchPage("regulamin", { body_md });
      expect(r.status, code).toBe(422);
      const e = r.body.errors.find((x: { code: string }) => x.code === code);
      expect(e, JSON.stringify(r.body.errors)).toBeTruthy();
      if (code !== "real_brand") expect(e.message).toContain("linia 2");
    }
    expect((await patchPage("regulamin", { title: `${BRAND} - regulamin` })).status).toBe(422);
    expect((await page("regulamin")).version).toBe(1);
    expect(await outbox()).toHaveLength(0);
    expect(await audits("content.update")).toHaveLength(0);
  });

  it("B-304: artykul poradnika - profil kreatora wymagany do publikacji, ostrzezenie o dlugosci, znaczniki content:{slug} i content:guide, usuwanie przez ownera", async () => {
    const draft = await call("editor", "post", "/v1/admin/content", {
      slug: "jak-wybrac-przelacznik",
      type: "guide",
      title: "Jak wybrać przełącznik",
      lead: "Cztery typy, jedna decyzja.",
      body_md: `## Wstep\n\n${words(100)}`,
    });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect(draft.body).toMatchObject({
      status: "draft",
      published_at: null,
      version: 1,
      demo_notice: false,
    });
    expect(draft.body.warnings.map((w: { code: string }) => w.code)).toEqual(["guide_length"]);
    expect((await outbox())[0]!.tags).toEqual(["content:guide", "content:jak-wybrac-przelacznik"]);

    // zajety slug i FAQ jako typ strony
    expect(
      (
        await call("editor", "post", "/v1/admin/content", {
          slug: "jak-wybrac-przelacznik",
          type: "guide",
          title: "Inny",
          body_md: "x",
        })
      ).status,
    ).toBe(409);
    const faqType = await call("editor", "post", "/v1/admin/content", {
      slug: "faq-2",
      type: "faq",
      title: "FAQ",
      body_md: "x",
    });
    expect(faqType.status).toBe(422);
    expect(faqType.body.errors[0].code).toBe("faq_separate");

    // publikacja bez profilu: 422; z profilem: ustawia published_at
    const id = draft.body.id as string;
    const noProfile = await call(
      "editor",
      "patch",
      `/v1/admin/content/${id}`,
      { status: "published" },
      ifMatch(1),
    );
    expect(noProfile.status).toBe(422);
    expect(noProfile.body.errors[0].code).toBe("guide_profile_required");
    const pub = await call(
      "editor",
      "patch",
      `/v1/admin/content/${id}`,
      { status: "published", guide_profile: "programowanie", body_md: `## Wstep\n\n${words(700)}` },
      ifMatch(1),
    );
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);
    expect(pub.body).toMatchObject({
      status: "published",
      guide_profile: "programowanie",
      version: 2,
      warnings: [],
    });
    expect(pub.body.published_at).toBe(NOW.toISOString());
    const out = await outbox();
    expect(out[1]!.tags).toEqual(["content:guide", "content:jak-wybrac-przelacznik"]);
    expect((await audits("content.create"))[0]).toMatchObject({ entity: "content", entityId: id });

    // owner usuwa artykul; znaczniki tez
    const del = await call("owner", "delete", `/v1/admin/content/${id}`);
    expect(del.status).toBe(204);
    expect(await t.prisma.contentPage.count({ where: { id } })).toBe(0);
    expect((await outbox()).at(-1)!.tags).toEqual([
      "content:guide",
      "content:jak-wybrac-przelacznik",
    ]);
    expect((await call("owner", "delete", `/v1/admin/content/${id}`)).status).toBe(404);
  });

  it("B-305: strony informacyjne i prawne nie sa usuwane (409 system_page), tylko archiwizowane", async () => {
    const p = await page("cookies");
    const del = await call("owner", "delete", `/v1/admin/content/${p.id}`);
    expect(del.status).toBe(409);
    expect(del.body.errors[0].code).toBe("system_page");
    expect(await t.prisma.contentPage.count({ where: { slug: "cookies" } })).toBe(1);
    const arch = await patchPage("cookies", { status: "archived" });
    expect(arch.status).toBe(200);
    expect(arch.body.status).toBe("archived");
    expect((await outbox())[0]!.tags).toEqual(["content:cookies"]);
  });

  // ------------------------------------------------------------------ FAQ

  it("B-307: FAQ - zapis uporzadkowanej listy, zmiana kolejnosci, usuwanie pominietych, sanityzacja, znacznik content:faq", async () => {
    expect((await call("viewer", "get", "/v1/admin/faq")).body.items.length).toBeGreaterThanOrEqual(
      8,
    );
    await t.prisma.faqItem.deleteMany();
    expect((await call("viewer", "get", "/v1/admin/faq")).body.items).toEqual([]);
    const put = (items: object[]) => call("editor", "put", "/v1/admin/faq", { items });
    const first = await put([
      { question: "Jak dlugo trwa dostawa?", answer_md: "Kurier dowozi w **1 dzien roboczy**." },
      {
        question: "Czy mozna zwrocic towar?",
        answer_md: "Tak, w 30 dni. <script>alert(1)</script>",
      },
      {
        question: "Czy to prawdziwy sklep?",
        answer_md: "Nie, to sklep demonstracyjny.",
        status: "draft",
      },
    ]);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const parsed = adminFaqSchema.parse(first.body);
    expect(parsed.items.map((i) => [i.position, i.status])).toEqual([
      [1, "published"],
      [2, "published"],
      [3, "draft"],
    ]);
    expect(parsed.items[1]!.answer_md).toBe("Tak, w 30 dni.");
    expect(parsed.warnings.map((w) => w.code)).toEqual(["content_sanitized"]);
    expect((await outbox())[0]!.tags).toEqual(["content:faq"]);

    // kolejnosc: ostatnie pytanie na gore, srodkowe usuniete
    const [a, b, c] = parsed.items;
    const reorder = await put([
      { id: c!.id, question: c!.question, answer_md: c!.answer_md, status: "published" },
      { id: a!.id, question: a!.question, answer_md: a!.answer_md },
    ]);
    expect(reorder.status, JSON.stringify(reorder.body)).toBe(200);
    expect(reorder.body.items.map((i: { id: string }) => i.id)).toEqual([c!.id, a!.id]);
    expect(reorder.body.items[0]).toMatchObject({ position: 1, status: "published" });
    expect(await t.prisma.faqItem.count({ where: { id: b!.id } })).toBe(0);
    expect(await outbox()).toHaveLength(2);

    // bez zmian: brak nowego wpisu
    const again = await put(
      reorder.body.items.map(
        (i: { id: string; question: string; answer_md: string; status: string }) => ({
          id: i.id,
          question: i.question,
          answer_md: i.answer_md,
          status: i.status,
        }),
      ),
    );
    expect(again.status).toBe(200);
    expect(await outbox()).toHaveLength(2);
    expect(await audits("faq.replace")).toHaveLength(2);

    // bledy: nieznane id, powtorzone id, za krotkie pytanie, marka, e-mail spoza domeny
    expect(
      (await put([{ id: "nieznany123", question: "Pytanie jakies?", answer_md: "Odpowiedz." }]))
        .status,
    ).toBe(422);
    const dupe = await put([
      { id: a!.id, question: "Pytanie jedno?", answer_md: "Odpowiedz jedna." },
      { id: a!.id, question: "Pytanie drugie?", answer_md: "Odpowiedz druga." },
    ]);
    expect(dupe.status).toBe(422);
    expect((await put([{ question: "x", answer_md: "Odpowiedz." }])).status).toBe(422);
    expect((await put([{ question: "Kto sprzedaje?", answer_md: `Firma ${BRAND}.` }])).status).toBe(
      422,
    );
    expect(
      (await put([{ question: "Jak sie skontaktowac?", answer_md: "Napisz: x@firma.com" }])).status,
    ).toBe(422);
    expect((await call("viewer", "get", "/v1/admin/faq")).body.items).toHaveLength(2);
  });

  // ------------------------------------------------------------------ opisy produktow

  it("B-301: opis produktu - zakazane slowa i dlugosc to OSTRZEZENIA, zapis przechodzi; tagi product:{slug}; wersja produktu rosnie", async () => {
    const put = (description: string | null, version: number) =>
      call(
        "editor",
        "put",
        "/v1/admin/products/m-wrobel/description",
        { description },
        ifMatch(version),
      );
    const bad = await put("To najlepsza, rewolucyjna mysz. Ultra-lekka i idealna.", 1);
    expect(bad.status, JSON.stringify(bad.body)).toBe(200);
    expect(bad.headers["etag"]).toBe('"2"');
    const codes = bad.body.warnings.map((w: { code: string }) => w.code);
    expect(codes).toEqual([
      "description_length",
      "description_paragraphs",
      "description_forbidden_words",
    ]);
    expect(bad.body.warnings[2].details).toEqual(["najlepsza", "rewolucyjna", "ultra-", "idealna"]);
    expect(bad.body.stats).toEqual({ words: 7, paragraphs: 1 });
    const stored = await t.prisma.product.findUniqueOrThrow({ where: { id: "m-wrobel" } });
    expect(stored.description).toBe("To najlepsza, rewolucyjna mysz. Ultra-lekka i idealna.");
    expect(stored.version).toBe(2);
    expect((await t.http().get("/v1/products/wrobel")).body.description).toBe(stored.description);
    const out = await outbox();
    expect(out[0]!.tags).toEqual(["product:wrobel"]);
    expect((await audits("product.description.update"))[0]).toMatchObject({
      entity: "product",
      entityId: "m-wrobel",
      before: { description: expect.stringContaining("Wróbel") },
    });
    // 409/412 przy starej wersji, 428 bez naglowka
    expect((await put("Inny opis.", 1)).status).toBe(412);
    expect(
      (await call("editor", "put", "/v1/admin/products/m-wrobel/description", { description: "x" }))
        .status,
    ).toBe(428);

    // poprawny opis: 70 slow, 2 akapity, bez zakazanych slow = brak ostrzezen
    const good = await put(`${words(35)}\n\n${words(35)}`, 2);
    expect(good.status).toBe(200);
    expect(good.body.warnings).toEqual([]);
    expect(good.body.stats).toEqual({ words: 70, paragraphs: 2 });
    // tagi i skrypty znikaja, marka z listy = 422, null czysci opis
    const html = await put("<script>x()</script><b>Tekst</b> bez znacznikow.", 3);
    expect(html.status).toBe(200);
    expect(html.body.description).toBe("Tekst bez znacznikow.");
    expect((await put(`Mysz ${BRAND} jest lekka.`, 4)).status).toBe(422);
    const cleared = await put(null, 4);
    expect(cleared.status).toBe(200);
    expect(cleared.body.description).toBeNull();
    expect(
      (
        await call(
          "editor",
          "put",
          "/v1/admin/products/m-nie-ma/description",
          { description: "x" },
          ifMatch(1),
        )
      ).status,
    ).toBe(404);
  });

  // ------------------------------------------------------------------ opinie demo

  const review = (over: Record<string, unknown> = {}) => ({
    author: "Ola K.",
    date: "2026-09-14",
    rating: 5,
    variant_label: "Grafit",
    text: "Lekka i cicha. Pasuje do mniejszej dloni.",
    demo: true,
    ...over,
  });
  const reviewSet = (n = 4) =>
    Array.from({ length: n }, (_, i) =>
      review({
        author: ["Ola K.", "Jan P.", "Ewa M.", "Piotr S.", "Ala B.", "Tomek R."][i],
        rating: 3 + (i % 3),
        variant_label: i % 2 === 0 ? "Grafit" : "Mgła",
        date: `2026-09-${10 + i}`,
      }),
    );
  const putReviews = (items: unknown[], id = "m-wrobel") =>
    call("editor", "put", `/v1/admin/products/${id}/reviews`, { items });

  it("B-302/B-303: opinie - zapis 3-6, srednia i liczba, stala etykieta, demo=true w bazie, znaczniki reviews:{slug} i product:{slug}", async () => {
    const seeded = await call("viewer", "get", "/v1/admin/reviews?product_id=m-wrobel");
    expect(seeded.body.items[0].count).toBeGreaterThanOrEqual(3);
    await t.prisma.review.deleteMany({ where: { productId: "m-wrobel" } });
    const empty = await call("viewer", "get", "/v1/admin/reviews?product_id=m-wrobel");
    expect(empty.body).toMatchObject({ label: REVIEWS_LABEL });
    expect(empty.body.items[0]).toMatchObject({ slug: "wrobel", count: 0, avg: null });
    expect((await call("viewer", "get", "/v1/admin/reviews")).body.items).toHaveLength(18);
    expect((await call("viewer", "get", "/v1/admin/reviews?product_id=m-nie-ma")).status).toBe(404);

    const res = await putReviews(reviewSet(4));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ product_id: "m-wrobel", slug: "wrobel", count: 4, avg: 3.8 });
    expect(res.body.items.map((r: { date: string }) => r.date)).toEqual([
      "2026-09-13",
      "2026-09-12",
      "2026-09-11",
      "2026-09-10",
    ]);
    expect(res.body.items.every((r: { demo: boolean }) => r.demo === true)).toBe(true);
    const rows = await t.prisma.review.findMany({ where: { productId: "m-wrobel" } });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.demo === true)).toBe(true);
    // baza nie przyjmie opinii bez flagi demo
    await expect(
      t.prisma.review.create({
        data: {
          productId: "m-wrobel",
          author: "X Y.",
          date: NOW,
          rating: 4,
          variantLabel: "Grafit",
          text: "x",
          demo: false,
        },
      }),
    ).rejects.toThrow();
    const out = await outbox();
    expect(out).toHaveLength(1);
    expect(out[0]!.tags).toEqual(["product:wrobel", "reviews:wrobel"]);
    expect((await audits("review.replace"))[0]).toMatchObject({
      entity: "review",
      entityId: "m-wrobel",
      before: { count: 0, avg: null },
      after: { count: 4, avg: 3.8 },
    });
    // identyczny zestaw: bez nowego wpisu; zamiana zestawu na 3 opinie dziala
    expect((await putReviews(reviewSet(4))).status).toBe(200);
    expect(await outbox()).toHaveLength(1);
    const three = await putReviews(reviewSet(3));
    expect(three.status).toBe(200);
    expect(three.body.count).toBe(3);
    expect(await t.prisma.review.count({ where: { productId: "m-wrobel" } })).toBe(3);
  });

  it("B-302: walidacja opinii - liczba 3-6, ocena 3-5, demo=true, autor, data (do 6 miesiecy), wariant, dlugosc, autentycznosc, marka", async () => {
    const bad = async (items: unknown[], code?: string) => {
      const r = await putReviews(items);
      expect(r.status, JSON.stringify(items).slice(0, 120)).toBe(422);
      if (code) expect(JSON.stringify(r.body.errors)).toContain(code);
    };
    const seededReviews = await t.prisma.review.count();
    await bad(reviewSet(2));
    await bad([...reviewSet(6), review()]);
    await bad(reviewSet(3).map((r, i) => (i === 0 ? { ...r, rating: 2 } : r)));
    await bad(reviewSet(3).map((r, i) => (i === 0 ? { ...r, rating: 6 } : r)));
    await bad(reviewSet(3).map((r, i) => (i === 0 ? { ...r, demo: false } : r)));
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, author: "ola" } : r)),
      "invalid_author",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, date: "2026-10-08" } : r)),
      "future_date",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, date: "2026-03-01" } : r)),
      "too_old",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, variant_label: "Zielony" } : r)),
      "unknown_variant_label",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, text: "Raz. Dwa. Trzy. Cztery. Piec." } : r)),
      "invalid_length",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, text: "Zweryfikowany zakup, polecam." } : r)),
      "claims_authenticity",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, text: `Mysz ${BRAND} jest lekka.` } : r)),
      "real_brand",
    );
    await bad(
      reviewSet(3).map((r, i) => (i === 0 ? { ...r, text: "Pisz do mnie: a@firma.com" } : r)),
      "invalid_domain",
    );
    expect((await putReviews(reviewSet(3), "m-nie-ma")).status).toBe(404);
    expect(await t.prisma.review.count()).toBe(seededReviews);
    expect(await outbox()).toHaveLength(0);
  });

  // ------------------------------------------------------------------ zgloszenia

  it("B-308/B-309: zgloszenia - viewer widzi dane zamaskowane, editor pelne i oznacza jako obsluzone, owner usuwa; audyt bez danych osobowych", async () => {
    const c1 = await t.prisma.contactMessage.create({
      data: {
        email: "jan.kowalski@taktyl.example",
        subject: "Pytanie o zwrot",
        body: "Moj numer telefonu to 500000123.",
        createdAt: new Date("2026-10-06T10:00:00Z"),
      },
    });
    await t.prisma.contactMessage.create({
      data: {
        email: "ewa@taktyl.example",
        subject: "Dostawa",
        body: "Kiedy paczka?",
        createdAt: new Date("2026-10-05T10:00:00Z"),
      },
    });
    const n1 = await t.prisma.newsletterSignup.create({
      data: { email: "anna@taktyl.example", createdAt: new Date("2026-10-07T08:00:00Z") },
    });

    const viewer = await call("viewer", "get", "/v1/admin/messages");
    expect(viewer.status).toBe(200);
    expect(viewer.body.total).toBe(3);
    expect(viewer.body.items.map((m: { kind: string }) => m.kind)).toEqual([
      "newsletter",
      "contact",
      "contact",
    ]);
    expect(viewer.body.items[0]).toMatchObject({
      email: "a***@taktyl.example",
      subject: null,
      body: null,
      handled: null,
    });
    expect(viewer.body.items[1]).toMatchObject({
      email: "j***@taktyl.example",
      body: "[ukryte]",
      handled: false,
    });
    expect(JSON.stringify(viewer.body)).not.toContain("500000123");

    const editor = await call("editor", "get", "/v1/admin/messages?kind=contact");
    expect(editor.body.total).toBe(2);
    expect(editor.body.items[0]).toMatchObject({
      email: "jan.kowalski@taktyl.example",
      body: "Moj numer telefonu to 500000123.",
    });
    expect(
      (await call("editor", "get", "/v1/admin/messages?kind=newsletter&per_page=1")).body.items,
    ).toHaveLength(1);

    const handled = await call("editor", "patch", `/v1/admin/messages/${c1.id}`, { handled: true });
    expect(handled.status).toBe(204);
    expect(
      (await t.prisma.contactMessage.findUniqueOrThrow({ where: { id: c1.id } })).handled,
    ).toBe(true);
    expect(
      (await call("editor", "patch", `/v1/admin/messages/${n1.id}`, { handled: true })).status,
    ).toBe(422);
    expect(
      (await call("editor", "patch", "/v1/admin/messages/nieistnieje1", { handled: true })).status,
    ).toBe(404);

    expect((await call("owner", "delete", `/v1/admin/messages/${c1.id}`)).status).toBe(204);
    expect((await call("owner", "delete", `/v1/admin/messages/${n1.id}`)).status).toBe(204);
    expect(await t.prisma.contactMessage.count()).toBe(1);
    expect(await t.prisma.newsletterSignup.count()).toBe(0);
    expect((await call("owner", "delete", `/v1/admin/messages/${c1.id}`)).status).toBe(404);

    const log = JSON.stringify(
      await t.prisma.auditLog.findMany({ where: { entity: "message" } }),
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );
    expect(log).toContain("message.delete");
    expect(log).not.toContain("jan.kowalski");
    expect(log).not.toContain("500000123");
    expect(log).not.toContain("anna@");
    // zgloszenia nie powoduja rewalidacji sklepu
    expect(await outbox()).toHaveLength(0);
  });

  it("S29: wpisy audytu tresci widoczne w dzienniku (kto, co, przed -> po), viewer czyta bez maskowania nazw produktow i tytulow", async () => {
    await patchPage("regulamin", { title: "Regulamin sklepu" });
    const put = await call(
      "editor",
      "put",
      "/v1/admin/products/m-wrobel/description",
      { description: "Krotki opis." },
      ifMatch(1),
    );
    expect(put.status).toBe(200);
    const res = await call("viewer", "get", "/v1/admin/audit?per_page=50");
    expect(res.status).toBe(200);
    const actions = res.body.items.map((i: { action: string }) => i.action).sort();
    expect(actions).toEqual(["content.update", "product.description.update"]);
    expect(
      res.body.items.find((i: { action: string }) => i.action === "content.update"),
    ).toMatchObject({
      actor_role: "editor",
      before: { title: "Regulamin" },
      after: { title: "Regulamin sklepu" },
    });
  });
});
