// B-001...B-013 (TAKTYL-45): uwierzytelnianie, sesja, CSRF, role, tryb demo, bootstrap, konta, dziennik zmian (PostgreSQL).
import { createHash, randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { Writable } from "node:stream";
import { auditListSchema, sessionResponseSchema, problemSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService, systemAudit } from "../src/audit/audit.service.js";
import { collectAdminRoutes } from "../src/auth/admin-routes.check.js";
import { ModulesContainer } from "@nestjs/core";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, type TestEnv } from "./helpers.js";

describe.skipIf(!hasDb)("B-001..B-009 uwierzytelnianie i sesja (PostgreSQL)", () => {
  let t: TestEnv;
  let now = new Date(NOW);
  const owner = { email: "wlasciciel@taktyl.example", password: pw() };
  const editor = { email: "edytor@taktyl.example", password: pw() };
  const viewer = { email: "podglad@taktyl.example", password: pw() };

  beforeAll(async () => {
    t = await bootApp({ clock: () => now, env: { SESSION_COOKIE_SECURE: "true" } });
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });
  beforeEach(async () => {
    now = new Date(NOW);
    await resetAuth(t.prisma);
    await addUser(t.prisma, owner.email, "owner", owner.password);
    await addUser(t.prisma, editor.email, "editor", editor.password);
    await addUser(t.prisma, viewer.email, "viewer", viewer.password);
  });

  it("B-001/B-002: poprawne logowanie ustawia ciasteczko HttpOnly; Secure; SameSite=Strict, w bazie tylko skrot SHA-256 tokenu", async () => {
    const res = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: owner.email, password: owner.password });
    expect(res.status).toBe(200);
    const body = sessionResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: owner.email, role: "owner" });
    expect(body.demo).toBeUndefined();
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0] as string;
    expect(cookie).toMatch(/^taktyl_session=[A-Za-z0-9_-]{43};/);
    for (const attr of ["HttpOnly", "SameSite=Strict", "Secure", "Path=/", "Max-Age=43200"])
      expect(cookie).toContain(attr);
    const token = /taktyl_session=([^;]+)/.exec(cookie)?.[1] as string;
    const sessions = await t.prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sessions[0]?.id).not.toBe(token);
    expect((sessions[0]?.expiresAt.getTime() ?? 0) - now.getTime()).toBe(12 * 3_600_000);
    expect(res.headers["cache-control"]).toBe("no-store");
    const me = await t.http().get("/v1/admin/auth/me").set("Cookie", `taktyl_session=${token}`);
    expect(me.status).toBe(200);
    expect(sessionResponseSchema.parse(me.body).csrf_token).toBe(body.csrf_token);
    const alias = await t
      .http()
      .get("/v1/admin/auth/session")
      .set("Cookie", `taktyl_session=${token}`);
    expect(alias.status).toBe(200);
  });

  it("B-001: zle haslo i nieistniejace konto daja ten sam komunikat i ten sam status (brak enumeracji)", async () => {
    const wrongPw = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: owner.email, password: pw() });
    const unknown = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: "nikt@taktyl.example", password: pw() });
    const otherAccount = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: viewer.email, password: pw() });
    for (const r of [wrongPw, unknown, otherAccount]) {
      expect(r.status).toBe(401);
      expect(r.headers["content-type"]).toContain("application/problem+json");
      expect(problemSchema.parse(r.body)).toMatchObject({
        code: "unauthorized",
        detail: "Nieprawidlowy e-mail lub haslo.",
      });
    }
    const strip = (b: { instance?: string }) => ({ ...b, instance: undefined });
    expect(strip(unknown.body)).toEqual(strip(wrongPw.body));
    expect(strip(otherAccount.body)).toEqual(strip(wrongPw.body));
    expect(wrongPw.headers["set-cookie"]).toBeUndefined();
    expect(await t.prisma.session.count()).toBe(0);
  });

  it("B-001: konto wylaczone nie zaloguje sie (ten sam komunikat)", async () => {
    await t.prisma.adminUser.update({ where: { email: editor.email }, data: { active: false } });
    const r = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: editor.email, password: editor.password });
    expect(r.status).toBe(401);
    expect(r.body.detail).toBe("Nieprawidlowy e-mail lub haslo.");
  });

  it("B-004: po 5 nieudanych probach szosta jest zablokowana (429 + Retry-After), takze z poprawnym haslem; blokada mija po 15 min", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await t
        .http()
        .post("/v1/admin/auth/login")
        .send({ email: owner.email, password: pw() });
      expect(r.status).toBe(401);
    }
    const sixth = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: owner.email, password: owner.password });
    expect(sixth.status).toBe(429);
    expect(problemSchema.parse(sixth.body)).toMatchObject({ code: "rate_limited" });
    expect(sixth.body.detail).toMatch(/Sprobuj za 15 min/);
    expect(Number(sixth.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(sixth.headers["retry-after"])).toBeLessThanOrEqual(900);
    // Nieistniejace konto blokuje sie tak samo (blokada nie zdradza, ktore konta istnieja).
    for (let i = 0; i < 5; i++)
      await t
        .http()
        .post("/v1/admin/auth/login")
        .send({ email: "duch@taktyl.example", password: pw() });
    const ghost = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: "duch@taktyl.example", password: pw() });
    expect(ghost.status).toBe(429);
    now = new Date(now.getTime() + 15 * 60_000 + 1000);
    const ok = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: owner.email, password: owner.password });
    expect(ok.status).toBe(200);
    // Blokada i nieudane proby sa w dzienniku jako zdarzenia bezpieczenstwa.
    const actions = (await t.prisma.auditLog.findMany()).map((a) => a.action);
    expect(actions).toContain("auth.login_failed");
    expect(actions).toContain("auth.login_locked");
    expect(actions).toContain("auth.login");
  });

  it("B-004: limit na adres IP obejmuje rozne konta z jednego IP; inny IP nie jest blokowany", async () => {
    const t2 = await bootApp({
      seed: false,
      clock: () => now,
      env: { LOGIN_IP_MAX_ATTEMPTS: "3" },
    });
    try {
      for (let i = 0; i < 3; i++) {
        await t2
          .http()
          .post("/v1/admin/auth/login")
          .set("X-Forwarded-For", "10.9.9.9")
          .send({ email: `x${i}@taktyl.example`, password: pw() });
      }
      const blocked = await t2
        .http()
        .post("/v1/admin/auth/login")
        .set("X-Forwarded-For", "10.9.9.9")
        .send({ email: owner.email, password: owner.password });
      expect(blocked.status).toBe(429);
      const other = await t2
        .http()
        .post("/v1/admin/auth/login")
        .set("X-Forwarded-For", "10.8.8.8")
        .send({ email: owner.email, password: owner.password });
      expect(other.status).toBe(200);
    } finally {
      await t2.close();
    }
  });

  it("B-002: sesja wygasa po 30 min bezczynnosci, aktywnosc ja przedluza, po 12 h wygasa bezwzglednie", async () => {
    const s = await login(t, owner.email, owner.password);
    now = new Date(now.getTime() + 20 * 60_000);
    expect((await t.http().get("/v1/admin/auth/me").set("Cookie", s.cookie)).status).toBe(200);
    now = new Date(now.getTime() + 20 * 60_000); // 40 min od logowania, ale 20 min od ostatniej aktywnosci
    expect((await t.http().get("/v1/admin/auth/me").set("Cookie", s.cookie)).status).toBe(200);
    now = new Date(now.getTime() + 31 * 60_000);
    const idle = await t.http().get("/v1/admin/auth/me").set("Cookie", s.cookie);
    expect(idle.status).toBe(401);
    expect(idle.body.errors[0]).toMatchObject({
      path: "session",
      code: "session_expired",
      message: "Sesja wygasla. Zaloguj sie ponownie.",
    });
    expect(String(idle.headers["set-cookie"])).toMatch(/taktyl_session=;.*Max-Age=0/);
    expect(await t.prisma.session.count()).toBe(0);

    now = new Date(NOW);
    const s2 = await login(t, owner.email, owner.password);
    for (let i = 0; i < 24; i++) {
      now = new Date(now.getTime() + 29 * 60_000);
      expect((await t.http().get("/v1/admin/auth/me").set("Cookie", s2.cookie)).status).toBe(200);
    }
    now = new Date(now.getTime() + 29 * 60_000); // > 12 h od logowania mimo ciaglej aktywnosci
    const absolute = await t.http().get("/v1/admin/auth/me").set("Cookie", s2.cookie);
    expect(absolute.status).toBe(401);
    expect(absolute.body.errors[0].code).toBe("session_expired");
  });

  it("B-002: brak lub falszywe ciasteczko = 401 no_session", async () => {
    const none = await t.http().get("/v1/admin/auth/me");
    expect(none.status).toBe(401);
    expect(none.body.errors[0].code).toBe("no_session");
    const fake = await t
      .http()
      .get("/v1/admin/auth/me")
      .set("Cookie", `taktyl_session=${randomBytes(32).toString("base64url")}`);
    expect(fake.status).toBe(401);
  });

  it("B-003: mutacja bez tokenu CSRF lub z cudzym tokenem = 403 csrf_invalid; z poprawnym przechodzi", async () => {
    const s = await login(t, owner.email, owner.password);
    const body = { email: "nowy@taktyl.example", role: "editor", initial_password: pw() };
    const missing = await t.http().post("/v1/admin/users").set("Cookie", s.cookie).send(body);
    expect(missing.status).toBe(403);
    expect(problemSchema.parse(missing.body).code).toBe("csrf_invalid");
    const other = await login(t, editor.email, editor.password);
    const wrong = await t
      .http()
      .post("/v1/admin/users")
      .set("Cookie", s.cookie)
      .set("X-CSRF-Token", other.csrf)
      .send(body);
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe("csrf_invalid");
    expect(await t.prisma.adminUser.count({ where: { email: body.email } })).toBe(0);
    const ok = await t
      .http()
      .post("/v1/admin/users")
      .set("Cookie", s.cookie)
      .set("X-CSRF-Token", s.csrf)
      .send(body);
    expect(ok.status).toBe(201);
    const logout = await t.http().post("/v1/admin/auth/logout").set("Cookie", s.cookie);
    expect(logout.status).toBe(403);
  });

  it("B-009: wylogowanie uniewaznia sesje po stronie serwera (stare ciasteczko nie dziala) i zapisuje zdarzenie", async () => {
    const s = await login(t, editor.email, editor.password);
    const out = await t
      .http()
      .post("/v1/admin/auth/logout")
      .set("Cookie", s.cookie)
      .set("X-CSRF-Token", s.csrf);
    expect(out.status).toBe(204);
    expect(String(out.headers["set-cookie"])).toMatch(/Max-Age=0/);
    expect(await t.prisma.session.count()).toBe(0);
    expect((await t.http().get("/v1/admin/auth/me").set("Cookie", s.cookie)).status).toBe(401);
    expect((await t.prisma.auditLog.findMany({ where: { action: "auth.logout" } })).length).toBe(1);
  });

  it("B-006: macierz rol x trasa (viewer tylko odczyt, editor bez uzytkownikow, owner wszystko)", async () => {
    const sessions = {
      owner: await login(t, owner.email, owner.password, "10.2.0.1"),
      editor: await login(t, editor.email, editor.password, "10.2.0.2"),
      viewer: await login(t, viewer.email, viewer.password, "10.2.0.3"),
    };
    const call = (
      role: keyof typeof sessions,
      method: "get" | "post",
      path: string,
      body?: object,
    ) => {
      const s = sessions[role];
      const req = t.http()[method](path).set("Cookie", s.cookie);
      return (
        method === "get" ? req : req.set("X-CSRF-Token", s.csrf).send(body ?? {})
      ) as Promise<{ status: number }>;
    };
    const newUser = () => ({
      email: `u${randomBytes(4).toString("hex")}@taktyl.example`,
      role: "viewer",
      initial_password: pw(),
    });
    const matrix: [
      string,
      "get" | "post",
      string,
      () => object | undefined,
      [number, number, number],
    ][] = [
      // trasa, metoda, sciezka, cialo, oczekiwane statusy (owner, editor, viewer)
      ["users: odczyt", "get", "/v1/admin/users", () => undefined, [200, 403, 403]],
      ["users: utworzenie", "post", "/v1/admin/users", newUser, [201, 403, 403]],
      ["audit: odczyt", "get", "/v1/admin/audit", () => undefined, [200, 200, 200]],
      ["me: odczyt", "get", "/v1/admin/auth/me", () => undefined, [200, 200, 200]],
    ];
    for (const [name, method, path, body, expected] of matrix) {
      for (const [i, role] of (["owner", "editor", "viewer"] as const).entries()) {
        const res = await call(role, method, path, body());
        expect(res.status, `${name} jako ${role}`).toBe(expected[i]);
      }
    }
    // viewer na mutacji: 403 forbidden (nie csrf_invalid) mimo poprawnego tokenu
    const v = (await call("viewer", "post", "/v1/admin/users", newUser())) as unknown as {
      body: { code: string };
    };
    expect(v.body.code).toBe("forbidden");
  });

  it("B-006: kazda trasa admina ma @Roles/@AdminPublic; mutacje na poziomie viewer to wylacznie wylogowanie", () => {
    const routes = collectAdminRoutes(t.app.get(ModulesContainer));
    expect(routes.length).toBeGreaterThanOrEqual(8);
    expect(routes.filter((r) => r.access === undefined)).toEqual([]);
    const GET = 0;
    const viewerMutations = routes
      .filter((r) => r.httpMethod !== GET && r.access === "viewer")
      .map((r) => `${r.controller}.${r.handler}`);
    expect(viewerMutations).toEqual(["AuthController.logout"]);
  });

  it("B-011: logowanie i wylogowanie to wpisy audit_log; w audycie nie ma hasel, hashy ani tokenow", async () => {
    const password = pw();
    await t.prisma.adminUser.update({
      where: { email: owner.email },
      data: { passwordHash: await hash(password) },
    });
    const s = await login(t, owner.email, password);
    await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: owner.email, password: "zle-haslo-do-sprawdzenia" });
    await t
      .http()
      .post("/v1/admin/users")
      .set("Cookie", s.cookie)
      .set("X-CSRF-Token", s.csrf)
      .send({
        email: "kolejny@taktyl.example",
        role: "editor",
        initial_password: "Haslo-poczatkowe-0987",
      });
    const dump = JSON.stringify(
      await t.prisma.auditLog.findMany({
        select: {
          action: true,
          entity: true,
          entityId: true,
          before: true,
          after: true,
          requestId: true,
          ipHash: true,
        },
      }),
    );
    for (const secret of [
      password,
      "zle-haslo-do-sprawdzenia",
      "Haslo-poczatkowe-0987",
      "argon2",
      s.csrf,
      s.cookie.split("=")[1] as string,
    ]) {
      expect(dump).not.toContain(secret);
    }
    expect(dump).not.toMatch(/password|passwordHash|csrf/i);
    // IP jest zhashowany (HMAC), nie jawny
    const rows = await t.prisma.auditLog.findMany({ where: { action: "auth.login" } });
    expect(rows[0]?.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(dump).not.toContain("127.0.0.1");
  });

  it("B-011: withAudit zapisuje wpis i zmiane w jednej transakcji (wyjatek wycofuje oba)", async () => {
    const audit = t.app.get(AuditService);
    const failing = audit.withAudit(systemAudit("test-rollback"), async (tx, record) => {
      await tx.adminUser.create({ data: { email: "rollback@taktyl.example", role: "viewer" } });
      await record({
        action: "user.create",
        entity: "user",
        entityId: "x",
        after: { email: "rollback@taktyl.example" },
      });
      throw new Error("blad po zapisie");
    });
    await expect(failing).rejects.toThrow("blad po zapisie");
    expect(await t.prisma.adminUser.count({ where: { email: "rollback@taktyl.example" } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { requestId: "test-rollback" } })).toBe(0);
    await audit.withAudit(systemAudit("test-commit"), async (tx, record) => {
      await tx.adminUser.create({ data: { email: "commit@taktyl.example", role: "viewer" } });
      await record({
        action: "user.create",
        entity: "user",
        entityId: "y",
        after: { email: "commit@taktyl.example", password: "tajne", token: "tajne" },
      });
    });
    const row = await t.prisma.auditLog.findFirstOrThrow({ where: { requestId: "test-commit" } });
    expect(row.after).toEqual({ email: "commit@taktyl.example" });
  });

  it("B-011: tabela audit_log jest tylko do dopisywania (UPDATE i DELETE odrzucone przez baze)", async () => {
    await login(t, owner.email, owner.password);
    await expect(
      t.prisma.$executeRawUnsafe(`UPDATE "audit_log" SET action = 'x.y'`),
    ).rejects.toThrow(/tylko do dopisywania/);
    await expect(t.prisma.$executeRawUnsafe(`DELETE FROM "audit_log"`)).rejects.toThrow(
      /tylko do dopisywania/,
    );
  });
});

describe.skipIf(!hasDb)("B-013 konta backpanelu i B-012 dziennik zmian (PostgreSQL)", () => {
  let t: TestEnv;
  let now = new Date(NOW);
  const owner = { email: "wlasciciel@taktyl.example", password: pw() };
  const editor = { email: "edytor@taktyl.example", password: pw() };
  let s: LoggedIn;

  beforeAll(async () => {
    t = await bootApp({ clock: () => now });
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });
  beforeEach(async () => {
    now = new Date(NOW);
    await resetAuth(t.prisma);
    await addUser(t.prisma, owner.email, "owner", owner.password);
    await addUser(t.prisma, editor.email, "editor", editor.password);
    s = await login(t, owner.email, owner.password);
  });
  const mut = (method: "post" | "patch", path: string, body: object, who = s) =>
    t.http()[method](path).set("Cookie", who.cookie).set("X-CSRF-Token", who.csrf).send(body);

  it("owner tworzy editor/viewer; duplikat e-maila = 409; slabe haslo = 422; adres demo zarezerwowany", async () => {
    const created = await mut("post", "/v1/admin/users", {
      email: "Nowy@Taktyl.example",
      role: "editor",
      initial_password: pw(),
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      email: "nowy@taktyl.example",
      role: "editor",
      active: true,
    });
    expect(created.body.password_hash).toBeUndefined();
    const hashRow = await t.prisma.adminUser.findUniqueOrThrow({
      where: { email: "nowy@taktyl.example" },
    });
    expect(hashRow.passwordHash).toMatch(/^\$argon2id\$/);
    expect(
      (
        await mut("post", "/v1/admin/users", {
          email: "nowy@taktyl.example",
          role: "viewer",
          initial_password: pw(),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await mut("post", "/v1/admin/users", {
          email: "krotkie@taktyl.example",
          role: "viewer",
          initial_password: "short",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await mut("post", "/v1/admin/users", {
          email: "viewer@taktyl.example",
          role: "viewer",
          initial_password: pw(),
        })
      ).status,
    ).toBe(409);
    const list = await t.http().get("/v1/admin/users").set("Cookie", s.cookie);
    expect(list.body.items.map((u: { email: string }) => u.email)).toContain("nowy@taktyl.example");
    expect(JSON.stringify(list.body)).not.toMatch(/argon2|password/);
  });

  it("zmiana roli i dezaktywacja koncza sesje konta, a wpis audit_log ma stan przed i po", async () => {
    const e = await login(t, editor.email, editor.password, "10.3.0.1");
    const user = await t.prisma.adminUser.findUniqueOrThrow({ where: { email: editor.email } });
    const res = await mut("patch", `/v1/admin/users/${user.id}`, { role: "viewer" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("viewer");
    expect((await t.http().get("/v1/admin/auth/me").set("Cookie", e.cookie)).status).toBe(401);
    const entry = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: "user.update", entityId: user.id },
    });
    expect(entry.before).toEqual({ email: editor.email, role: "editor", active: true });
    expect(entry.after).toEqual({ email: editor.email, role: "viewer", active: true });
    expect(entry.actorRole).toBe("owner");
    expect(entry.requestId).toBeTruthy();

    await mut("patch", `/v1/admin/users/${user.id}`, { active: false });
    const denied = await t
      .http()
      .post("/v1/admin/auth/login")
      .send({ email: editor.email, password: editor.password });
    expect(denied.status).toBe(401);
    expect((await mut("patch", "/v1/admin/users/nie-ma-takiego", { active: false })).status).toBe(
      404,
    );
    expect((await mut("patch", `/v1/admin/users/${user.id}`, {})).status).toBe(422);
  });

  it("B-013: ostatniego aktywnego owner nie da sie zdegradowac ani wylaczyc (409); z drugim ownerem juz tak", async () => {
    const me = await t.prisma.adminUser.findUniqueOrThrow({ where: { email: owner.email } });
    expect((await mut("patch", `/v1/admin/users/${me.id}`, { role: "editor" })).status).toBe(409);
    expect((await mut("patch", `/v1/admin/users/${me.id}`, { active: false })).status).toBe(409);
    expect((await t.prisma.adminUser.findUniqueOrThrow({ where: { id: me.id } })).role).toBe(
      "owner",
    );
    const second = await addUser(t.prisma, "drugi@taktyl.example", "owner", pw());
    expect((await mut("patch", `/v1/admin/users/${second.id}`, { active: false })).status).toBe(
      200,
    );
    expect((await mut("patch", `/v1/admin/users/${me.id}`, { role: "editor" })).status).toBe(409);
  });

  it("reset hasla: haslo tymczasowe zwracane raz, stare przestaje dzialac, nie trafia do dziennika", async () => {
    const user = await t.prisma.adminUser.findUniqueOrThrow({ where: { email: editor.email } });
    const res = await mut("patch", `/v1/admin/users/${user.id}`, { reset_password: true });
    expect(res.status).toBe(200);
    const temp = res.body.temporary_password as string;
    expect(temp.length).toBeGreaterThanOrEqual(12);
    expect(
      (
        await t
          .http()
          .post("/v1/admin/auth/login")
          .send({ email: editor.email, password: editor.password })
      ).status,
    ).toBe(401);
    expect(
      (await t.http().post("/v1/admin/auth/login").send({ email: editor.email, password: temp }))
        .status,
    ).toBe(200);
    const dump = JSON.stringify(
      await t.prisma.auditLog.findMany({ select: { action: true, before: true, after: true } }),
    );
    expect(dump).not.toContain(temp);
    expect(dump).toContain("credentials_reset");
  });

  it("B-012: GET /v1/admin/audit - filtry (uzytkownik, encja, zakres dat), paginacja; viewer ma pola osobowe zamaskowane", async () => {
    await mut("post", "/v1/admin/users", {
      email: "audytowany@taktyl.example",
      role: "editor",
      initial_password: pw(),
    });
    const all = await t.http().get("/v1/admin/audit").set("Cookie", s.cookie);
    expect(all.status).toBe(200);
    const parsed = auditListSchema.parse(all.body);
    expect(parsed.total).toBeGreaterThanOrEqual(2);
    expect(parsed.items[0]?.action).toBe("user.create");
    expect(parsed.items[0]?.after).toEqual({
      email: "audytowany@taktyl.example",
      role: "editor",
      active: true,
    });

    const byEntity = await t.http().get("/v1/admin/audit?entity=session").set("Cookie", s.cookie);
    expect(byEntity.body.total).toBe(0);
    const ownerRow = await t.prisma.adminUser.findUniqueOrThrow({ where: { email: owner.email } });
    const byActor = await t
      .http()
      .get(`/v1/admin/audit?actor_id=${ownerRow.id}&entity=user`)
      .set("Cookie", s.cookie);
    expect(
      byActor.body.items.every(
        (i: { actor_id: string; entity: string }) =>
          i.actor_id === ownerRow.id && i.entity === "user",
      ),
    ).toBe(true);
    const future = encodeURIComponent("2030-01-01T00:00:00+01:00");
    expect(
      (await t.http().get(`/v1/admin/audit?from=${future}`).set("Cookie", s.cookie)).body.total,
    ).toBe(0);
    const paged = await t.http().get("/v1/admin/audit?per_page=1&page=2").set("Cookie", s.cookie);
    expect(paged.body).toMatchObject({ page: 2, per_page: 1 });
    expect(paged.body.items).toHaveLength(1);
    expect(
      (await t.http().get("/v1/admin/audit?per_page=500").set("Cookie", s.cookie)).status,
    ).toBe(400);

    await t.prisma.adminUser.create({
      data: {
        email: "podglad@taktyl.example",
        role: "viewer",
        passwordHash: await hash("Aa1-viewer-haslo-testowe"),
      },
    });
    const v = await login(t, "podglad@taktyl.example", "Aa1-viewer-haslo-testowe", "10.4.0.1");
    const masked = await t.http().get("/v1/admin/audit?entity=user").set("Cookie", v.cookie);
    expect(masked.status).toBe(200);
    expect(JSON.stringify(masked.body)).not.toContain("audytowany@taktyl.example");
    expect(JSON.stringify(masked.body)).toContain("a***@taktyl.example");
  });
});

describe.skipIf(!hasDb)("B-005 bootstrap konta owner i B-007 tryb demo (PostgreSQL)", () => {
  it("B-005: bez zmiennych nie tworzy konta (ostrzezenie), ze zmiennymi tworzy owner tylko gdy brak ownera; haslo nie trafia do logow", async () => {
    const lines: string[] = [];
    const sink = new Writable({ write: (chunk, _e, cb) => (lines.push(String(chunk)), cb()) });
    const password = pw();
    let t = await bootApp({ clock: () => NOW, logSink: sink });
    await resetAuth(t.prisma);
    await t.close();

    t = await bootApp({ seed: false, logSink: sink });
    expect(await t.prisma.adminUser.count()).toBe(0);
    expect(lines.join("")).toMatch(/Brak konta owner/);
    await t.close();

    t = await bootApp({
      seed: false,
      logSink: sink,
      env: { ADMIN_BOOTSTRAP_EMAIL: "start@taktyl.example", ADMIN_BOOTSTRAP_PASSWORD: password },
    });
    const owners = await t.prisma.adminUser.findMany();
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ email: "start@taktyl.example", role: "owner", active: true });
    expect(owners[0]?.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect((await login(t, "start@taktyl.example", password)).csrf.length).toBeGreaterThan(16);
    expect(await t.prisma.auditLog.count({ where: { action: "user.bootstrap" } })).toBe(1);
    await t.close();

    // Ponowny start z inna zmienna nie tworzy ani nie zmienia konta (jest juz owner).
    t = await bootApp({
      seed: false,
      logSink: sink,
      env: { ADMIN_BOOTSTRAP_EMAIL: "inny@taktyl.example", ADMIN_BOOTSTRAP_PASSWORD: pw() },
    });
    expect((await t.prisma.adminUser.findMany()).map((u) => u.email)).toEqual([
      "start@taktyl.example",
    ]);
    await resetAuth(t.prisma);
    await t.close();
    const logs = lines.join("");
    expect(logs).not.toContain(password);
    expect(logs).not.toContain("argon2");
  });

  it("B-007: demo-viewer to 404 bez DEMO_MODE; z DEMO_MODE=true tworzy sesje viewer bez hasla, ktora niczego nie zmieni", async () => {
    let t = await bootApp({ clock: () => NOW });
    await resetAuth(t.prisma);
    const off = await t.http().post("/v1/admin/auth/demo-viewer");
    expect(off.status).toBe(404);
    expect(off.headers["set-cookie"]).toBeUndefined();
    expect(await t.prisma.adminUser.count()).toBe(0);
    await t.close();

    const lines: string[] = [];
    t = await bootApp({
      seed: false,
      clock: () => NOW,
      env: { DEMO_MODE: "true" },
      logSink: new Writable({ write: (c, _e, cb) => (lines.push(String(c)), cb()) }),
    });
    try {
      // konto systemowe istnieje od startu, bez hasla
      const sys = await t.prisma.adminUser.findUniqueOrThrow({
        where: { email: "viewer@taktyl.example" },
      });
      expect(sys).toMatchObject({ role: "viewer", passwordHash: null, active: true });
      const demo = await t.http().post("/v1/admin/auth/demo-viewer");
      expect(demo.status).toBe(200);
      expect(demo.body).toMatchObject({
        user: { email: "viewer@taktyl.example", role: "viewer" },
        demo: true,
      });
      const cookie = ((demo.headers["set-cookie"] as unknown as string[])[0] as string).split(
        ";",
      )[0] as string;
      const csrf = demo.body.csrf_token as string;
      expect((await t.http().get("/v1/admin/audit").set("Cookie", cookie)).status).toBe(200);
      const write = await t
        .http()
        .post("/v1/admin/users")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrf)
        .send({ email: "x@taktyl.example", role: "viewer", initial_password: pw() });
      expect(write.status).toBe(403);
      // na konto systemowe nie da sie zalogowac haslem (zadnym)
      for (const guess of ["", "viewer", "viewer@taktyl.example", pw()]) {
        const r = await t
          .http()
          .post("/v1/admin/auth/login")
          .send({ email: "viewer@taktyl.example", password: guess || "x" });
        expect(r.status).toBe(401);
      }
      expect(
        (await t.prisma.auditLog.findMany({ where: { action: "auth.demo_login" } })).length,
      ).toBe(1);
      // wylogowanie dziala tez dla viewera
      expect(
        (
          await t
            .http()
            .post("/v1/admin/auth/logout")
            .set("Cookie", cookie)
            .set("X-CSRF-Token", csrf)
        ).status,
      ).toBe(204);
    } finally {
      await resetAuth(t.prisma);
      await t.close();
    }
  });
});
