// B-060, B-061 (TAKTYL-46, ADR-0003): worker outboxa na PostgreSQL - agregacja, podpis HMAC, retry z backoffem (ruchomy zegar),
// FOR UPDATE SKIP LOCKED, awaria odbiornika (wiersz zostaje pending), S30 po stronie API (zly podpis odrzucony).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OutboxWorker } from "../src/outbox/outbox.worker.js";
import { addUser, login, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, type TestEnv } from "./helpers.js";
import { startReceiver, type Receiver } from "./receiver.js";

const SECRET = "r".repeat(40);
let clockMs = NOW.getTime();
const clock = () => new Date(clockMs);

describe.skipIf(!hasDb)("B-060 OutboxWorker (PostgreSQL)", () => {
  let t: TestEnv;
  let receiver: Receiver;
  let worker: OutboxWorker;

  beforeAll(async () => {
    receiver = await startReceiver(SECRET, () => clockMs);
    t = await bootApp({
      clock,
      env: { REVALIDATE_URL: receiver.url, OUTBOX_WORKER_ENABLED: "false" },
    });
    worker = t.app.get(OutboxWorker);
  });
  afterAll(async () => {
    await t.close();
    await receiver.close();
  });
  beforeEach(async () => {
    clockMs = NOW.getTime();
    receiver.calls.length = 0;
    receiver.mode = "ok";
    receiver.delayMs = 0;
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox" RESTART IDENTITY`);
  });

  const add = (tags: string[]) =>
    t.prisma.outbox.create({
      data: { tags, status: "pending", createdAt: clock(), nextAttemptAt: clock() },
    });

  it("laczy i deduplikuje znaczniki wielu wierszy w jedno podpisane wywolanie", async () => {
    await add(["product:wrobel", "catalog"]);
    await add(["catalog", "category:myszki", "product:wrobel"]);
    const r = await worker.runOnce();
    expect(r).toEqual({ picked: 2, sent: 2, retried: 0, failed: 0 });
    expect(receiver.calls).toHaveLength(1);
    expect(receiver.calls[0]?.signature).toBe("ok");
    expect(receiver.calls[0]?.tags).toEqual(["catalog", "category:myszki", "product:wrobel"]);
    const rows = await t.prisma.outbox.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((x) => [x.status, x.attempts, x.lastError])).toEqual([
      ["sent", 1, null],
      ["sent", 1, null],
    ]);
    expect(rows[0]?.sentAt?.getTime()).toBe(clockMs);
  });

  it("brak wierszy: zadnego wywolania; wiersz z przyszlym next_attempt_at nie jest brany", async () => {
    expect((await worker.runOnce()).picked).toBe(0);
    await t.prisma.outbox.create({
      data: { tags: ["catalog"], createdAt: clock(), nextAttemptAt: new Date(clockMs + 60_000) },
    });
    expect((await worker.runOnce()).picked).toBe(0);
    expect(receiver.calls).toHaveLength(0);
  });

  it("awaria odbiornika: wiersz zostaje pending, rosnie attempts, backoff 5 s / 15 s, potem sukces", async () => {
    await add(["product:wrobel"]);
    receiver.mode = "fail500";

    expect(await worker.runOnce()).toMatchObject({ picked: 1, sent: 0, retried: 1, failed: 0 });
    let row = await t.prisma.outbox.findFirstOrThrow();
    expect([row.status, row.attempts, row.lastError]).toEqual([
      "pending",
      1,
      "Sklep odpowiedzial HTTP 500",
    ]);
    expect(row.nextAttemptAt.getTime()).toBe(clockMs + 5_000);

    // przed uplywem opoznienia worker nie ponawia
    clockMs += 4_000;
    expect((await worker.runOnce()).picked).toBe(0);
    expect(receiver.calls).toHaveLength(1);

    clockMs += 1_000;
    await worker.runOnce();
    row = await t.prisma.outbox.findFirstOrThrow();
    expect([row.status, row.attempts]).toEqual(["pending", 2]);
    expect(row.nextAttemptAt.getTime()).toBe(clockMs + 15_000);

    // odbiornik wraca: ponowienie konczy sie sukcesem i czysci blad
    receiver.mode = "ok";
    clockMs += 15_000;
    expect(await worker.runOnce()).toMatchObject({ sent: 1 });
    row = await t.prisma.outbox.findFirstOrThrow();
    expect([row.status, row.attempts, row.lastError]).toEqual(["sent", 3, null]);
    expect(receiver.calls).toHaveLength(3);
  });

  it("po 8 nieudanych probach wiersz ma status failed i last_error", async () => {
    await add(["catalog"]);
    receiver.mode = "fail500";
    for (let i = 0; i < 8; i++) {
      await worker.runOnce();
      clockMs += 5 * 60_000;
    }
    const row = await t.prisma.outbox.findFirstOrThrow();
    expect([row.status, row.attempts]).toEqual(["failed", 8]);
    expect(row.lastError).toContain("HTTP 500");
    expect(receiver.calls).toHaveLength(8);
    // failed nie jest ponawiany
    expect((await worker.runOnce()).picked).toBe(0);
  });

  it("niedostepny odbiornik (polaczenie odrzucone): pending + blad bez sekretu", async () => {
    const dead = await startReceiver(SECRET, () => clockMs);
    const deadUrl = dead.url;
    await dead.close();
    const t2 = await bootApp({
      seed: false,
      clock,
      env: {
        REVALIDATE_URL: deadUrl,
        OUTBOX_WORKER_ENABLED: "false",
        REVALIDATE_TIMEOUT_MS: "1000",
      },
    });
    try {
      await add(["catalog"]);
      const r = await t2.app.get(OutboxWorker).runOnce();
      expect(r.retried).toBe(1);
      const row = await t.prisma.outbox.findFirstOrThrow();
      expect(row.status).toBe("pending");
      expect(row.lastError).toMatch(/^Brak odpowiedzi sklepu/);
      expect(row.lastError).not.toContain(SECRET);
    } finally {
      await t2.close();
    }
  });

  it("FOR UPDATE SKIP LOCKED: dwa rownolegle przebiegi nie biora tego samego wiersza", async () => {
    await add(["product:a"]);
    await add(["product:b"]);
    receiver.delayMs = 400; // pierwszy przebieg trzyma blokade, gdy startuje drugi
    const [r1, r2] = await Promise.all([
      worker.runOnce({ batchSize: 1 }),
      (async () => {
        await new Promise((r) => setTimeout(r, 100));
        return worker.runOnce({ batchSize: 1 });
      })(),
    ]);
    expect(r1.picked).toBe(1);
    expect(r2.picked).toBe(1);
    expect(receiver.calls.map((c) => c.tags?.join())).toHaveLength(2);
    expect(new Set(receiver.calls.map((c) => c.tags?.join()))).toEqual(
      new Set(["product:a", "product:b"]),
    );
    const rows = await t.prisma.outbox.findMany();
    expect(rows.every((x) => x.status === "sent" && x.attempts === 1)).toBe(true);
  });

  it("drugi przebieg w trakcie blokady jedynego wiersza nic nie wysyla (brak podwojnej wysylki)", async () => {
    await add(["product:a"]);
    receiver.delayMs = 400;
    const first = worker.runOnce();
    await new Promise((r) => setTimeout(r, 100));
    const second = await worker.runOnce();
    await first;
    expect(second.picked).toBe(0);
    expect(receiver.calls).toHaveLength(1);
  });

  it("S30 (strona API): odbiornik z innym sekretem odrzuca podpis 401, wiersz zostaje pending", async () => {
    const strict = await startReceiver("z".repeat(40), () => clockMs);
    const t2 = await bootApp({
      seed: false,
      clock,
      env: { REVALIDATE_URL: strict.url, OUTBOX_WORKER_ENABLED: "false" },
    });
    try {
      await add(["catalog"]);
      await t2.app.get(OutboxWorker).runOnce();
      expect(strict.calls).toHaveLength(1);
      expect(strict.calls[0]?.signature).toBe("bad");
      const row = await t.prisma.outbox.findFirstOrThrow();
      expect([row.status, row.lastError]).toEqual(["pending", "Sklep odpowiedzial HTTP 401"]);
    } finally {
      await t2.close();
      await strict.close();
    }
  });

  it("S30: odbiornik odrzuca zadanie bez podpisu, z podpisem bez znacznika czasu i przeterminowane", async () => {
    const post = (headers: Record<string, string>) =>
      fetch(receiver.url, { method: "POST", headers, body: JSON.stringify({ tags: ["catalog"] }) });
    expect((await post({})).status).toBe(401);
    expect((await post({ "X-Taktyl-Signature": "a".repeat(64) })).status).toBe(401);
    expect(
      (
        await post({
          "X-Taktyl-Timestamp": String(Math.floor(clockMs / 1000) - 3600),
          "X-Taktyl-Signature": "b".repeat(64),
        })
      ).status,
    ).toBe(401);
    expect(receiver.calls.every((c) => c.signature !== "ok")).toBe(true);
  });

  it("B-061: POST /v1/admin/revalidate (owner) zapisuje audyt i outbox; editor dostaje 403; zly znacznik 422", async () => {
    await resetAuth(t.prisma);
    const ownerPw = pw();
    const editorPw = pw();
    await addUser(t.prisma, "owner@taktyl.example", "owner", ownerPw);
    await addUser(t.prisma, "editor@taktyl.example", "editor", editorPw);
    const owner = await login(t, "owner@taktyl.example", ownerPw);
    const editor = await login(t, "editor@taktyl.example", editorPw, "10.1.0.2");
    const send = (s: typeof owner, tags: unknown) =>
      t
        .http()
        .post("/v1/admin/revalidate")
        .set("Cookie", s.cookie)
        .set("X-CSRF-Token", s.csrf)
        .send({ tags });

    expect((await send(editor, ["catalog"])).status).toBe(403);
    expect((await send(owner, ["nie-ma-takiego"])).status).toBe(422);
    const ok = await send(owner, ["catalog", "catalog", "product:wrobel"]);
    expect(ok.status).toBe(202);
    expect(ok.body).toEqual({ revalidated: ["catalog", "product:wrobel"] });
    const out = await t.prisma.outbox.findFirstOrThrow();
    expect(out.tags).toEqual(["catalog", "product:wrobel"]);
    expect(out.auditId).not.toBeNull();
    const audit = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: "revalidate.manual" },
    });
    expect(audit.actorRole).toBe("owner");
  });

  it("worker w tle: zapis w transakcji budzi wysylke bez czekania na interwal", async () => {
    const t2 = await bootApp({
      seed: false,
      clock,
      env: { REVALIDATE_URL: receiver.url, OUTBOX_POLL_MS: "60000" },
    });
    try {
      await resetAuth(t2.prisma);
      const ownerPw = pw();
      await addUser(t2.prisma, "owner@taktyl.example", "owner", ownerPw);
      const owner = await login(t2, "owner@taktyl.example", ownerPw, "10.1.0.9");
      receiver.calls.length = 0;
      const res = await t2
        .http()
        .post("/v1/admin/revalidate")
        .set("Cookie", owner.cookie)
        .set("X-CSRF-Token", owner.csrf)
        .send({ tags: ["rules"] });
      expect(res.status).toBe(202);
      const deadline = Date.now() + 4_000;
      while (receiver.calls.length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(receiver.calls[0]?.tags).toEqual(["rules"]);
      await new Promise((r) => setTimeout(r, 100));
      expect((await t2.prisma.outbox.findFirstOrThrow()).status).toBe("sent");
    } finally {
      await t2.close();
    }
  });
});
