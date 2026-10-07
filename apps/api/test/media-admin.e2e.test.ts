// B-500..B-508 (TAKTYL-63): media w backpanelu na PostgreSQL - lista manifestu z licznikiem P0, wgrywanie WebP (wymiary co do
// piksela, typ, rozmiar, path traversal), status brak -> gotowe, usuniecie, role, audit_log i znaczniki outbox.
// Obrazy testowe sklada w locie `fakeWebp` (dane testowe, nie grafika; zero plikow graficznych w repo).
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mediaListSchema, mediaUploadResponseSchema, problemSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, reseed, type TestEnv } from "./helpers.js";
import { fakeWebp } from "./webp-fixture.js";

type Role = "owner" | "editor" | "viewer";

const TOP = "k-kwarc-60_grafit_top"; // topdown 293 x 102 (1x), 586 x 204 (2x)
const TOP_1X = "img/top/k-kwarc-60_grafit_top@1x.webp";
const TOP_2X = "img/top/k-kwarc-60_grafit_top@2x.webp";
const PACK = "k-kwarc-60_grafit_01-34"; // packshot 400/800/1600
const TEXTURE = "p-tafla_grafit_tekstura"; // 200 x 200, 400 x 400
const MAX_BYTES = 4096;

describe.skipIf(!hasDb)("B-500..B-508 media w backpanelu (PostgreSQL)", () => {
  let t: TestEnv;
  let dir: string;
  const accounts: Record<Role, { email: string; password: string }> = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<Role, LoggedIn>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "taktyl-media-"));
    t = await bootApp({ env: { MEDIA_DIR: dir, MEDIA_MAX_BYTES: String(MAX_BYTES) } });
    await resetAuth(t.prisma);
    let n = 0;
    for (const [role, a] of Object.entries(accounts) as [Role, (typeof accounts)[Role]][]) {
      await addUser(t.prisma, a.email, role, a.password);
      sessions[role] = await login(t, a.email, a.password, `10.7.0.${++n}`);
    }
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
    rmSync(dir, { recursive: true, force: true });
  });
  beforeEach(async () => {
    rmSync(join(dir, "img"), { recursive: true, force: true });
    await reseed(t.prisma);
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
  });

  const get = (role: Role, path: string) => t.http().get(path).set("Cookie", sessions[role].cookie);
  const upload = (
    role: Role,
    key: string,
    parts: { field: string; data: Buffer; type?: string; filename?: string }[],
    fields: Record<string, string> = {},
  ) => {
    let r = t
      .http()
      .post(`/v1/admin/media/${key}`)
      .set("Cookie", sessions[role].cookie)
      .set("X-CSRF-Token", sessions[role].csrf);
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    for (const p of parts) {
      r = r.attach(p.field, p.data, {
        filename: p.filename ?? "plik.webp",
        contentType: p.type ?? "image/webp",
      });
    }
    return r;
  };
  const remove = (role: Role, key: string) =>
    t
      .http()
      .delete(`/v1/admin/media/${key}`)
      .set("Cookie", sessions[role].cookie)
      .set("X-CSRF-Token", sessions[role].csrf);
  const row = (key: string) => t.prisma.productImage.findUniqueOrThrow({ where: { key } });
  const outbox = () => t.prisma.outbox.findMany({ orderBy: { id: "asc" } });

  it("B-500, B-501: po seedzie 190 wpisow, 76 w P0, wszystkie brak; filtry i licznik z danych", async () => {
    const res = await get("viewer", "/v1/admin/media?per_page=200");
    expect(res.status).toBe(200);
    const body = mediaListSchema.parse(res.body);
    expect(body.total).toBe(190);
    expect(body.items).toHaveLength(190);
    expect(body.progress).toEqual({ p0_ready: 0, p0_total: 76, total_ready: 0, total: 190 });
    expect(body.items.every((e) => e.status === "brak")).toBe(true);

    const top = body.items.find((e) => e.key === TOP);
    expect(top?.slots.map((s) => [s.slot, s.file_name, s.width, s.height, s.present])).toEqual([
      ["1x", "k-kwarc-60_grafit_top@1x.webp", 293, 102, false],
      ["2x", "k-kwarc-60_grafit_top@2x.webp", 586, 204, false],
    ]);

    const topdown = mediaListSchema.parse(
      (await get("viewer", "/v1/admin/media?kind=topdown")).body,
    );
    expect(topdown.total).toBe(26);
    const p0 = mediaListSchema.parse(
      (await get("viewer", "/v1/admin/media?priority=P0&kind=texture")).body,
    );
    expect(p0.total).toBe(12);
    const missing = mediaListSchema.parse(
      (await get("viewer", "/v1/admin/media?status=gotowe")).body,
    );
    expect(missing.total).toBe(0);
    expect(missing.progress.p0_total).toBe(76);
  });

  it("B-502, B-506: poprawny plik zapisuje sie pod nazwa z manifestu; status gotowe dopiero po komplecie", async () => {
    // Nazwa z uploadu (z probą traversal) nie ma znaczenia: sciezka wynika z manifestu.
    const r1 = await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102), filename: "../../../etc/passwd.webp" },
    ]);
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    const b1 = mediaUploadResponseSchema.parse(r1.body);
    expect(b1.uploaded).toEqual(["1x"]);
    expect(b1.missing).toEqual(["2x"]);
    expect(b1.entry.status).toBe("brak");
    expect(b1.entry.slots[0]?.url).toBe(`http://taktyl.localhost/media/${TOP_1X}`);
    expect(existsSync(join(dir, TOP_1X))).toBe(true);
    expect(existsSync(join(dir, "..", "etc"))).toBe(false);
    expect((await row(TOP)).status).toBe("brak");

    const r2 = await upload("editor", TOP, [{ field: "2x", data: fakeWebp(586, 204) }]);
    expect(r2.status, JSON.stringify(r2.body)).toBe(201);
    const b2 = mediaUploadResponseSchema.parse(r2.body);
    expect(b2.missing).toEqual([]);
    expect(b2.entry.status).toBe("gotowe");
    expect(b2.progress.p0_ready).toBe(1);
    expect(existsSync(join(dir, TOP_2X))).toBe(true);
    expect((await row(TOP)).status).toBe("gotowe");
  });

  it("B-502: komplet rozmiarow w jednym zadaniu; B-506: znaczniki outbox i wpis audytu", async () => {
    const res = await upload("owner", TOP, [
      { field: "1x", data: fakeWebp(293, 102) },
      { field: "2x", data: fakeWebp(586, 204) },
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mediaUploadResponseSchema.parse(res.body).entry.status).toBe("gotowe");

    const ob = await outbox();
    expect(ob).toHaveLength(1);
    const product = await t.prisma.product.findUniqueOrThrow({ where: { id: "k-kwarc-60" } });
    expect(ob[0]?.tags).toEqual(
      expect.arrayContaining([
        `product:${product.slug}`,
        `category:${product.categoryId}`,
        "catalog",
        "presets",
      ]),
    );
    const audit = await t.prisma.auditLog.findMany({ where: { action: "media.upload" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entity: "media", entityId: TOP, actorRole: "owner" });
    expect((audit[0]?.before as { status: string }).status).toBe("brak");
    expect((audit[0]?.after as { status: string }).status).toBe("gotowe");
    expect(ob[0]?.auditId).toBe(audit[0]?.id);
  });

  it("B-503, B-S7: zle wymiary topdown - 422, komunikat z wymiarami, nic nie zapisane", async () => {
    const res = await upload("editor", TOP, [{ field: "1x", data: fakeWebp(330, 102) }]);
    expect(res.status).toBe(422);
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("validation_failed");
    expect(p.errors?.[0]).toMatchObject({
      path: "1x",
      code: "dimensions_mismatch",
      message: "Plik ma 330 × 102 px. Ten wpis wymaga 293 × 102 px (1 px = 1 mm).",
    });
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
    expect((await row(TOP)).status).toBe("brak");
    expect(await outbox()).toHaveLength(0);
    expect(await t.prisma.auditLog.count({ where: { action: "media.upload" } })).toBe(0);
  });

  it("B-503: @2x liczy 2 px = 1 mm; jeden zly plik w komplecie odrzuca caly komplet", async () => {
    const res = await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102) },
      { field: "2x", data: fakeWebp(293, 102) },
    ]);
    expect(res.status).toBe(422);
    expect(problemSchema.parse(res.body).errors?.[0]?.message).toBe(
      "Plik ma 293 × 102 px. Ten wpis wymaga 586 × 204 px (2 px = 1 mm).",
    );
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
  });

  it("B-504: tekstura 200 x 200 i 400 x 400, bez analizy obrazu", async () => {
    const bad = await upload("editor", TEXTURE, [{ field: "1x", data: fakeWebp(200, 201) }]);
    expect(bad.status).toBe(422);
    expect(problemSchema.parse(bad.body).errors?.[0]?.message).toBe(
      "Plik ma 200 × 201 px. Ten wpis wymaga 200 × 200 px.",
    );
    const ok = await upload("editor", TEXTURE, [
      { field: "1x", data: fakeWebp(200, 200, { alpha: false }) },
      { field: "2x", data: fakeWebp(400, 400, { alpha: false }) },
    ]);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    const body = mediaUploadResponseSchema.parse(ok.body);
    expect(body.entry.status).toBe("gotowe");
    expect(body.warnings).toEqual([]);
  });

  it("B-502: packshot kwadrat 400/800/1600; B-505: brak alfy to ostrzezenie, nie blokada", async () => {
    const res = await upload("editor", PACK, [
      { field: "400", data: fakeWebp(400, 400, { alpha: false }) },
    ]);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const body = mediaUploadResponseSchema.parse(res.body);
    expect(body.warnings).toEqual([
      { code: "no_alpha", slot: "400", message: "Plik nie ma przezroczystego tła." },
    ]);
    expect(body.missing).toEqual(["800", "1600"]);
    expect(body.entry.status).toBe("brak");

    const notSquare = await upload("editor", PACK, [{ field: "800", data: fakeWebp(800, 600) }]);
    expect(notSquare.status).toBe(422);
    const rest = await upload("editor", PACK, [
      { field: "800", data: fakeWebp(800, 800) },
      { field: "1600", data: fakeWebp(1600, 1600) },
    ]);
    expect(mediaUploadResponseSchema.parse(rest.body).entry.status).toBe("gotowe");
  });

  it("B-502: zly typ - 415 'Wgraj plik WebP.' (typ MIME i zawartosc)", async () => {
    const png = await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102), type: "image/png", filename: "a.png" },
    ]);
    expect(png.status).toBe(415);
    const p = problemSchema.parse(png.body);
    expect(p.code).toBe("unsupported_media_type");
    expect(p.errors?.[0]).toMatchObject({ code: "unsupported_type", message: "Wgraj plik WebP." });

    const fake = await upload("editor", TOP, [
      {
        field: "1x",
        data: Buffer.from("<svg>to nie jest obraz webp, tylko tekst</svg>"),
        type: "image/webp",
      },
    ]);
    expect(fake.status).toBe(415);
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
  });

  it("B-502: za duzy plik - 413 z limitem z MEDIA_MAX_BYTES", async () => {
    const res = await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102, { padBytes: MAX_BYTES + 100 }) },
    ]);
    expect(res.status).toBe(413);
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("payload_too_large");
    expect(p.errors?.[0]?.code).toBe("file_too_large");
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
  });

  it("nieznane miejsce, brak pliku i podwojone miejsce - 422", async () => {
    const unknown = await upload("editor", TOP, [{ field: "3x", data: fakeWebp(293, 102) }]);
    expect(unknown.status).toBe(422);
    expect(problemSchema.parse(unknown.body).errors?.[0]?.code).toBe("unknown_slot");
    const none = await t
      .http()
      .post(`/v1/admin/media/${TOP}`)
      .set("Cookie", sessions.editor.cookie)
      .set("X-CSRF-Token", sessions.editor.csrf)
      .field("x", "y");
    expect(none.status).toBe(422);
    expect(problemSchema.parse(none.body).errors?.[0]?.code).toBe("no_file");
    // pole `file` z polem `slot` jako alternatywa
    const viaSlot = await upload("editor", TOP, [{ field: "file", data: fakeWebp(293, 102) }], {
      slot: "1x",
    });
    expect(viaSlot.status, JSON.stringify(viaSlot.body)).toBe(201);
  });

  it("path traversal w kluczu i nieznany klucz - 404, nic poza MEDIA_DIR nie powstaje", async () => {
    for (const key of [
      "..%2F..%2Fetc%2Fpasswd",
      "..%2f..%2ftmp%2fx",
      "%2e%2e%2f%2e%2e%2fx",
      "nie-ma-takiego-klucza",
    ]) {
      const res = await upload("owner", key, [{ field: "1x", data: fakeWebp(293, 102) }]);
      expect(res.status, key).toBe(404);
      const del = await remove("owner", key);
      expect(del.status, key).toBe(404);
    }
    expect(existsSync(join(dir, "..", "etc"))).toBe(false);
    expect(await t.prisma.auditLog.count({ where: { entity: "media" } })).toBe(0);
  });

  it("role: viewer 403 na POST i DELETE, editor 403 na DELETE, brak CSRF 403, bez sesji 401", async () => {
    const v = await upload("viewer", TOP, [{ field: "1x", data: fakeWebp(293, 102) }]);
    expect(v.status).toBe(403);
    expect((await remove("viewer", TOP)).status).toBe(403);
    expect((await remove("editor", TOP)).status).toBe(403);
    const noCsrf = await t
      .http()
      .post(`/v1/admin/media/${TOP}`)
      .set("Cookie", sessions.editor.cookie)
      .attach("1x", fakeWebp(293, 102), { filename: "a.webp", contentType: "image/webp" });
    expect(noCsrf.status).toBe(403);
    expect((await t.http().get("/v1/admin/media")).status).toBe(401);
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
    expect(await outbox()).toHaveLength(0);
  });

  it("B-506: DELETE (owner) usuwa pliki, status wraca do brak, outbox i audyt", async () => {
    await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102) },
      { field: "2x", data: fakeWebp(586, 204) },
    ]);
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
    const res = await remove("owner", TOP);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = mediaUploadResponseSchema.parse(res.body);
    expect(body.entry.status).toBe("brak");
    expect(body.missing).toEqual(["1x", "2x"]);
    expect(body.progress.p0_ready).toBe(0);
    expect(existsSync(join(dir, TOP_1X))).toBe(false);
    expect(existsSync(join(dir, TOP_2X))).toBe(false);
    expect((await row(TOP)).status).toBe("brak");
    expect((await outbox())[0]?.tags).toContain("catalog");
    expect(await t.prisma.auditLog.count({ where: { action: "media.delete" } })).toBe(1);
  });

  it("ponowne wgranie nadpisuje plik (wymiana zdjecia) i znowu zapisuje audyt i znaczniki", async () => {
    await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102) },
      { field: "2x", data: fakeWebp(586, 204) },
    ]);
    const again = await upload("editor", TOP, [
      { field: "1x", data: fakeWebp(293, 102, { alpha: false }) },
    ]);
    expect(again.status).toBe(201);
    const b = mediaUploadResponseSchema.parse(again.body);
    expect(b.entry.status).toBe("gotowe");
    expect(b.warnings).toHaveLength(1);
    expect(await t.prisma.auditLog.count({ where: { action: "media.upload" } })).toBe(2);
  });
});
